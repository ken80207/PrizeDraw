# Phase 0 Research Findings: Ichiban Kuji Prize Draw Platform

**Date**: 2026-03-24
**Status**: Finalized
**Scope**: Technical architecture decisions for the full-stack prize draw platform (Gradle multi-project build, Kotlin 2.x, Kotlin Multiplatform).

---

## Stack Summary

| Layer | Technology |
|---|---|
| Build | Gradle 8.x (Kotlin DSL, version catalogs) |
| Language | Kotlin 2.x (all modules) |
| Backend | Ktor 3.x + PostgreSQL 16 + Redis 7 + Exposed ORM |
| Queue / Jobs | Custom coroutine-based worker + Redis distributed lock |
| Realtime | Ktor WebSocket + Redis pub/sub adapter |
| Web (Player) | Compose Multiplatform (WASM/JS target) |
| Web (Admin) | Compose Multiplatform (WASM/JS target, separate app) |
| Mobile | Compose Multiplatform (iOS 15+ / Android 10+) |
| Shared | `:api-contracts`, `:shared`, `:shared-ui` KMP modules |

---

## 1. Realtime Architecture

**Decision**: Ktor WebSocket server with a Redis pub/sub adapter for horizontal scaling across multiple Ktor instances. Each ticket box maps to a dedicated Redis channel; all Ktor pods subscribe to the same channels, so any pod can publish board state changes (ticket removed, winner revealed, queue position updated) to all connected clients regardless of which pod holds their WebSocket connection. The Ktor `webSocket {}` DSL combined with a `SharedFlow` per channel routes incoming Redis messages to the correct connected clients.

**Rationale**: The kuji ticket board must broadcast draw state changes to all connected viewers within 2 seconds. Ktor's built-in WebSocket support is first-class and idiomatic — it integrates directly with coroutines, meaning each connection is a lightweight coroutine rather than a thread, enabling tens of thousands of concurrent connections on modest hardware. Redis pub/sub decouples the broadcast from the pod that handled the draw request, satisfying horizontal scaling without third-party managed services. A `SharedFlow` inside each pod acts as the in-process fan-out bus between the Redis subscriber coroutine and the individual WebSocket connection coroutines. Auto-reconnect with exponential backoff is implemented on the client side using Ktor's `HttpClient` WebSocket engine with a retry loop, eliminating the need for a separate reconnection library. Queue state (current player, estimated wait, position) is sent as a typed `kotlinx.serialization`-encoded event on the same connection, avoiding a second persistent connection from the client.

**Alternatives Considered**:
- **Socket.IO (via a separate Node.js sidecar)**: Rejected. Introducing a Node.js process alongside Ktor solely for Socket.IO room semantics contradicts the goal of a unified Kotlin stack. All the capabilities Socket.IO provides — room-based broadcast, reconnection negotiation, Redis adapter — are achievable with Ktor WebSockets, Redis pub/sub, and coroutine-based fan-out, with no additional runtime.
- **Server-Sent Events (SSE)**: Rejected. SSE is unidirectional (server to client only). The draw flow requires bidirectional communication — clients send draw requests, the server sends board state. SSE would require a separate REST channel for client actions, increasing complexity and introducing ordering race conditions.
- **Pusher / Ably**: Rejected. Both are managed services with per-message or per-connection pricing that becomes significant at scale. They also introduce vendor lock-in on a critical path. The cost and dependency risk are not justified when Ktor WebSockets + Redis is well-understood and self-hosted.

---

## 2. Payment Integration

**Decision**: Abstract payment gateway behind a common `PaymentGateway` interface. Initial implementations: ECPay and NewebPay (both dominant in Taiwan). All payment confirmations flow through Ktor webhook routes; incoming payloads are parsed with `kotlinx.serialization` and each webhook carries an idempotency key stored in PostgreSQL to prevent duplicate credit. Ktor's `HttpClient` (with the CIO engine) handles outbound calls to provider query and refund endpoints. When a gateway is unreachable, the top-up feature is disabled via a feature flag (see section 7); all other platform features continue to operate.

**Rationale**: Taiwan's payment landscape requires local providers. ECPay and NewebPay together cover credit card, Apple Pay, Google Pay, LINE Pay, and convenience store payment codes (CVS). A Kotlin `interface` with operations `charge`, `refund`, `queryStatus`, and `parseWebhook` means a new provider can be added without touching business logic. `kotlinx.serialization` is used for all webhook payload parsing — its sealed class support cleanly models the distinct event shapes each provider sends without reflection. Idempotency keys (UUID per transaction attempt, stored with a TTL in PostgreSQL via Exposed) prevent double-crediting caused by webhook retries from the provider. The graceful degradation approach — disabling top-up via feature flag rather than returning errors mid-checkout — protects user experience and avoids partial state in the point ledger.

**Alternatives Considered**:
- **Stripe**: Rejected for primary market. Stripe does not support convenience store payment codes, which are widely used in Taiwan. Cross-border processing fees also add unnecessary cost for a locally focused platform.
- **Single hardcoded provider**: Rejected. Binding business logic directly to one provider's SDK makes it costly to switch or add providers. Taiwan's payment market has seen providers shut down or change APIs; the interface pattern future-proofs the integration.
- **Synchronous payment confirmation (no webhooks)**: Rejected. Provider redirects and callbacks are asynchronous by nature. Polling the provider for status is fragile and rate-limited. Webhook-based confirmation is the industry standard and the approach both ECPay and NewebPay document as primary.

---

## 3. Dual Point System

**Decision**: Two separate ledger tables — `draw_point_ledger` (purchased, non-withdrawable) and `revenue_point_ledger` (earned from sales and buybacks, withdrawable to bank) — following the double-entry bookkeeping pattern. Every mutation (credit, debit, hold, release) is an immutable ledger entry; balance is always derived by summing entries for an account. All mutations go through a transactional service layer using Exposed's `transaction {}` DSL with `IsolationLevel.REPEATABLE_READ`. Optimistic locking (a `version` column on a balance summary row, incremented with each write) prevents concurrent overdraft.

**Rationale**: Separating the two point types is a regulatory and accounting requirement: draw points are a purchased game credit and cannot be converted to cash; revenue points represent earned value and may be withdrawn. Commingling them in one table would create compliance risk and complicate financial reporting. Exposed's `transaction {}` block wraps both the ledger entry insert and the summary row update in a single database transaction, ensuring a draw debit and a prize credit always succeed or fail together — there is no intermediate state. Optimistic locking on the balance summary row (via Exposed's `update { it[version] eq expectedVersion }` pattern) avoids pessimistic row-level locks and the deadlock risk they carry under concurrent draw activity; a retry on version conflict is fast and predictable. Exposed DAO and DSL layers are used together: DSL for the append-only ledger writes (performance-sensitive), DAO for the balance summary entity (readability-sensitive).

**Alternatives Considered**:
- **Single `points` column on the user record**: Rejected. Provides no audit trail. Concurrent updates cause race conditions. Does not distinguish point types for compliance purposes.
- **Single ledger table with a `type` enum**: Rejected. Queries for withdrawable balance would require filtering across the entire ledger. Separate tables enforce the separation at the schema level and make it structurally impossible to accidentally mix types in a transaction.
- **Event sourcing**: Considered but deferred. Full event sourcing is the theoretical ideal but adds significant infrastructure complexity (event store, projection rebuilds) that is not justified for MVP. The double-entry ledger approach captures the same auditability with far less operational overhead.

---

## 4. Queue System for Kuji Draw

**Decision**: Redis-backed distributed lock per ticket box using a Lua script for atomic acquire/release (matching the Redlock pattern), executed via a Kotlin coroutine-based Redis client (Lettuce via a coroutine wrapper). A custom coroutine-based timeout worker — a `CoroutineScope` with a `SupervisorJob` and `Dispatchers.IO` — manages 5-minute session expirations: on lock acquisition, a `launch { delay(5.minutes); releaseLockIfExpired(boxId) }` job is registered; if the player does not complete their draw, the coroutine fires and releases the lock. Lock state and timeout metadata are persisted in PostgreSQL via Exposed so a pod restart does not orphan locks. Queue state (current player, estimated wait time, position) is broadcast to all room subscribers via Ktor WebSocket on every state change.

**Rationale**: The requirement is strict mutual exclusion — only one player may draw from a given ticket box at a time. A Lua-script-based Redis lock satisfies this across multiple Ktor pods atomically. The custom coroutine worker replaces BullMQ entirely: Kotlin coroutines are a native concurrency primitive, `delay` is non-blocking and backed by the coroutine scheduler, and the timeout job is simply a suspended function — no external job queue process or dependency is needed. Persisting lock state to PostgreSQL via Exposed means a pod crash does not leave a box permanently locked; a startup recovery routine queries for locks whose TTL has passed and releases them. This removes BullMQ and its Node.js runtime from the dependency graph entirely, keeping the stack homogeneous.

**Alternatives Considered**:
- **Database-level lock (SELECT FOR UPDATE via Exposed)**: Rejected. A database lock held for up to 5 minutes is a significant resource and a risk to connection pool exhaustion under concurrent users. Redis is the appropriate tool for short-lived distributed locks.
- **In-process queue (single pod)**: Rejected. Does not survive pod restarts and does not work when the backend is horizontally scaled.
- **BullMQ (via a Node.js sidecar)**: Rejected. Running a Node.js process alongside Ktor solely to use BullMQ contradicts the goal of a unified Kotlin stack. The custom coroutine worker covers the required functionality — delayed execution, persistence, crash recovery — without an additional runtime.

---

## 5. Probability Engine for Unlimited Draw

**Decision**: Server-side cryptographically secure random number generation using `java.security.SecureRandom`. Weighted probability selection using a cumulative distribution function (CDF) lookup: prize probabilities (must sum to 100%) are stored as integer basis points, a CDF array is built at ticket box load time as a Kotlin `List<Int>`, and a binary search (`binarySearch` from the Kotlin standard library) against a random value in `[0, 10000)` determines the prize. Rate limiting is enforced via a Redis sliding window counter at 1 draw per second per user by default, configurable per ticket box. The probability engine runs exclusively on the server; prize probabilities are never exposed to clients.

**Rationale**: `java.security.SecureRandom` is cryptographically secure and available on the JVM without additional dependencies — it prevents prediction of upcoming prizes from prior outcomes, which `kotlin.random.Random` (which wraps a non-cryptographic PRNG) does not guarantee. The CDF approach is O(log n) on the number of prize tiers and produces exactly the configured distribution without floating-point drift. Storing probabilities as integer basis points (1/10,000 of a percent) avoids floating-point representation errors that could cause the sum to drift from 100%. The CDF list is immutable after construction and shared across coroutines without synchronization. Rate limiting via Redis sliding window is lightweight and consistent across pods. Because the engine is pure Kotlin with no platform-specific dependencies, it lives in the `:shared` KMP module and can be unit-tested on any target.

**Alternatives Considered**:
- **kotlin.random.Random**: Rejected. `kotlin.random.Random` is not cryptographically secure. While the statistical distribution may be acceptable, the predictability risk is unacceptable for a wagering-adjacent application.
- **Client-side probability selection**: Rejected. Any client-side random selection can be manipulated. The result must be authoritative from the server, with the client only receiving the outcome.
- **Third-party RNG service (e.g., random.org)**: Rejected. Introduces network latency and an external dependency on the critical draw path. `java.security.SecureRandom` is equivalent in security for this purpose and has no external dependency.

---

## 6. Authentication

**Decision**: OAuth2 social login (Google, Apple, LINE) implemented via Ktor's `Authentication` plugin with custom OAuth validation logic, combined with mandatory phone number binding enforced after first login. Phone verification uses SMS OTP (Twilio as primary; a domestic Taiwan SMS provider such as Every8d as fallback), delivered via Ktor's `HttpClient`. Sessions are managed with JWT: short-lived access tokens (15 minutes) and long-lived refresh tokens (30 days) stored as HTTP-only cookies, implemented with a custom Ktor `TokenService`. Refresh token rotation is enforced server-side; family-level revocation (invalidating all tokens in a lineage on suspected reuse) is tracked in Redis with a fallback record in PostgreSQL. Phone uniqueness is enforced at the database level with a unique index on the `phone` column of the `users` table (defined in Exposed schema).

**Rationale**: LINE login is essential for the Taiwan market — it is the dominant messaging platform and users expect it as a login option. Google and Apple are required for iOS App Store compliance (Apple Sign-In must be offered when other social logins are). Ktor's `Authentication` plugin provides the extension points needed for all three providers without prescribing a specific OAuth library, keeping the implementation fully in Kotlin. Mandatory phone binding serves two purposes: it enables SMS notifications and it provides a recovery mechanism independent of any social identity provider. Family-level refresh token revocation — where detecting a reuse of an already-rotated token invalidates the entire lineage — limits the damage window of a stolen refresh token without requiring server-side session state for every request. JWT access token validation remains stateless per request; only refresh and revocation touch Redis or PostgreSQL.

**Alternatives Considered**:
- **Session-based authentication (Ktor Sessions with server-side store)**: Rejected. Session state stored per user in Redis or PostgreSQL does not scale horizontally without shared session store complexity and adds read latency on every authenticated request. JWT with Redis-backed refresh token rotation achieves the same security properties without that constraint.
- **Magic link / passwordless email only**: Rejected. Email open rates in Taiwan are lower than in other markets. LINE and phone OTP are more reliable reach channels for this audience.
- **Firebase Authentication**: Rejected. Adds a dependency on Google infrastructure for a core security primitive. A custom Ktor implementation gives full control over token lifecycle, phone binding logic, family-level revocation, and audit logging.

---

## 7. Feature Flag System

**Decision**: Custom feature flag system implemented as a Koin-injected service in the Ktor backend, backed by Redis (primary, for read latency) and PostgreSQL (source of truth, for persistence and auditability). Flags support four dimensions: global on/off, user group targeting (list of user IDs or segments), platform targeting (web, admin, iOS, Android), and percentage rollout (deterministic hash of user ID ensures consistent assignment). A lightweight polling client in the `:shared` KMP module fetches flag state on a configurable interval (default 30 seconds) using Ktor's `HttpClient` and falls back to cached values on network failure. The Koin module is registered once at application startup and injected wherever flag evaluation is needed, avoiding a global singleton.

**Rationale**: Feature flags are used to control payment gateway availability, new animation modes, A/B experiments, and rollout of breaking changes. The Redis-backed read path keeps flag evaluation at sub-millisecond latency without adding overhead to every request. PostgreSQL persistence via Exposed means flag configuration survives Redis eviction and provides a full change history for compliance and debugging. The deterministic hash for percentage rollout ensures a user does not flip between the enabled and disabled cohorts on successive requests. Koin is used rather than a manual service locator because it integrates cleanly with Ktor's application lifecycle (modules are installed via `install(Koin)`) and supports constructor injection in Ktor route handlers without reflection overhead. Building this custom for MVP avoids the operational complexity and cost of a self-hosted flag service.

**Alternatives Considered**:
- **LaunchDarkly**: Rejected for MVP. Per-seat or per-MAU pricing is significant at scale. The feature set far exceeds what is needed at launch, and the vendor dependency on a critical runtime path (flags affect payment availability) is a concern.
- **Unleash (self-hosted)**: Rejected for MVP. Self-hosting Unleash requires maintaining an additional service, its own database, and its SDK integration. The custom Koin-injected implementation covers the required dimensions with far less operational surface area at this stage. Migrating to Unleash later is feasible if the custom implementation proves insufficient.
- **Hardcoded environment variables**: Rejected. Environment variables require a redeployment to change. The core use case — disabling payment top-up when a gateway is down — requires runtime toggling without a deployment.

---

## 8. i18n Strategy

**Decision**: Kotlin-native i18n across all surfaces. Server-side (Ktor) uses Java `ResourceBundle`-backed `.properties` files loaded through a thin Kotlin wrapper service for translated API error messages and notification templates, injected via Koin. Mobile and desktop use Compose Multiplatform's `stringResource` API with string resources defined in the `:shared-ui` KMP module (XML resource files on Android, equivalent on iOS via the Compose Multiplatform resources pipeline). Web (Compose WASM/JS) also uses Compose Multiplatform resources via the same `:shared-ui` module. All translation files live in `:shared-ui/src/commonMain/resources` organized by namespace (common, errors, notifications, prizes). Default locale is `zh-TW`. English (`en`) is the secondary locale for admin interfaces.

**Rationale**: Centralizing translation resources in the `:shared-ui` KMP module ensures terminology is consistent across web, admin, and mobile — prize names, error messages, and system labels use the same strings regardless of surface. Compose Multiplatform's resource system generates type-safe accessors (`Res.string.prize_name`) eliminating stringly-typed key lookups and making missing translations a compile error rather than a runtime blank. The server-side `ResourceBundle` approach requires zero additional dependencies on the JVM and is well-understood, with Kotlin extension functions wrapping it to provide a clean API (`i18n.t("errors.insufficient_points", locale)`). Storing all resources in the shared module means a single change propagates everywhere without per-platform translation drift.

**Alternatives Considered**:
- **Per-module translation files**: Rejected. Leads to translation drift — the same concept described differently on web versus mobile. Maintenance burden multiplies with each new locale.
- **i18next (via a JS interop layer)**: Rejected. Using i18next in a Compose Multiplatform project would require either a JS interop bridge or abandoning type-safe resource access. The Compose Multiplatform resource system is purpose-built for this use case and eliminates that complexity entirely.
- **Server-side translation only (API returns translated strings)**: Rejected. Requires a network round-trip before any UI string can render. Client-side resources with local bundles provide instant rendering and offline capability on mobile.

---

## 9. Animation System for Draw Reveal

**Decision**: Four reveal animation modes: tear (paper tear effect), scratch (scratch-card reveal), flip (card flip), and fast (instant reveal for speed draws). All platforms use Compose Multiplatform's animation APIs (`AnimatedContent`, `Transition`, `animateFloatAsState`) as the primary animation layer. Complex frame-by-frame animations (tear, flip) use Lottie via `lottie-compose` on Android and iOS; on WASM/JS targets, Lottie JSON files are played via a thin `expect/actual` wrapper that delegates to `lottie-web` on web and `lottie-compose` on native. The scratch effect uses Compose's `Canvas` API with a clip path mask driven by pointer input, running on the UI thread. A plugin architecture is defined: each animation mode is a Kotlin `object` implementing a shared `DrawAnimationPlugin` interface (`@Composable fun play(prize: Prize, onComplete: () -> Unit)`). Maximum animation duration is 3 seconds; target render performance is 60fps. The fast mode bypasses all animation.

**Rationale**: Animation quality is a primary differentiator for the draw experience. Using Compose Multiplatform's animation APIs as the foundation means all four modes share one implementation across Android, iOS, and web, eliminating platform-divergence bugs. Lottie allows designers to iterate on animations in After Effects without code changes; the JSON format is version-controlled alongside the codebase. The `expect/actual` wrapper for Lottie isolates the platform-specific playback detail from the shared animation module, keeping the plugin interface fully in `commonMain`. Compose's `Canvas` API runs on the Skia rendering pipeline on all targets, giving pixel-level control for the scratch effect without a WebGL or platform-native drawing dependency. The plugin architecture means new reveal modes can be added without touching the core draw flow — the draw screen calls `plugin.play(prize, onComplete)` and the plugin is responsible for everything else.

**Alternatives Considered**:
- **CSS animations (web only)**: Rejected. CSS transitions are insufficient for the scratch and tear effects, which require procedural geometry. Compose Canvas gives pixel-level control needed for convincing physical effects and works identically across targets.
- **Compose Animation only (no Lottie)**: Considered. Rejected for the tear and flip modes specifically because producing frame-accurate cinematic effects in pure Compose animation code is significantly more labor-intensive than authoring them in After Effects and exporting Lottie JSON. Lottie is retained for those two modes.
- **React Native Reanimated / Framer Motion**: Rejected. These are JavaScript ecosystem libraries with no path into a Compose Multiplatform project without a JS interop boundary. They would fragment the rendering pipeline across targets.

---

## 10. Observability Stack

**Decision**: OpenTelemetry for instrumentation (traces, metrics, logs) using the Ktor OpenTelemetry plugin (`io.opentelemetry.instrumentation:opentelemetry-ktor`) and Micrometer (`io.micrometer:micrometer-registry-prometheus`) for metrics export. Metrics and dashboards: Prometheus + Grafana. Log aggregation: Grafana Loki with structured JSON logs emitted via `logback` with a Loki appender. Distributed tracing: Jaeger (OpenTelemetry-compatible). Client-side traces from Compose Multiplatform apps are sent via the OpenTelemetry OTLP HTTP exporter using Ktor's `HttpClient`. Alert rules defined for: payment webhook failure rate > 1% over 5 minutes, WebSocket broadcast p99 latency > 2 seconds, application error rate spike (> 5x baseline over 1 minute), draw queue lock acquisition failure rate.

**Rationale**: OpenTelemetry is the vendor-neutral standard for instrumentation, meaning the collection backend can be swapped without changing application code. The Ktor OpenTelemetry plugin instruments all incoming HTTP requests and WebSocket connections automatically, and coroutine context propagation ensures trace IDs flow through suspended functions without manual baggage handling. Micrometer provides a metrics facade with a Prometheus registry, keeping metric collection idiomatic on the JVM. Grafana, Prometheus, Loki, and Jaeger are all open source, self-hostable, and deeply integrated with each other. Structured JSON logs from Logback feed directly into Loki without a parsing pipeline. Distributed tracing is critical for diagnosing latency in the draw flow, which crosses Ktor, Redis, PostgreSQL, and WebSocket fan-out.

**Alternatives Considered**:
- **Datadog**: Rejected. Per-host pricing at scale is significant. The open-source stack provides equivalent capability for a self-hosted deployment at a fraction of the cost. Migration to Datadog is straightforward if operational burden becomes an issue.
- **Sentry only**: Rejected as the sole observability solution. Sentry is excellent for error tracking and frontend performance but does not replace metrics (Prometheus), log aggregation (Loki), or distributed tracing (Jaeger). It may be added alongside this stack for frontend error reporting specifically.
- **ELK stack (Elasticsearch, Logstash, Kibana)**: Rejected. The operational overhead of running Elasticsearch is significantly higher than Loki for the log volume expected at launch. Loki's label-based index is sufficient for the query patterns needed (filter by service, level, trace ID).

---

## 11. Image Storage

**Decision**: S3-compatible object storage for all prize product images and user-generated content. AWS S3 for cloud deployments; MinIO for local development and self-hosted environments. A CDN layer (AWS CloudFront or Cloudflare) sits in front of the bucket for delivery. An image optimization pipeline — triggered on upload via a coroutine-based background worker (same infrastructure as section 4) — produces multiple variants: original, 800px thumbnail, 400px card, 200px icon, each converted to WebP with quality 85. All S3 and MinIO operations use the AWS SDK for Kotlin (`aws.sdk.kotlin:s3`) on JVM/server; the MinIO Kotlin client is used for local development. Variant URLs are stored in the database alongside the original via Exposed.

**Rationale**: S3-compatible storage decouples media from application servers and provides durability guarantees without custom backup logic. The S3 API is an industry standard; any provider supporting it (AWS, Cloudflare R2, Backblaze B2, MinIO) can be used without changing application code. The AWS SDK for Kotlin is coroutine-native — all S3 operations are `suspend` functions that integrate naturally with Ktor's coroutine-based request handling without blocking threads. CDN delivery ensures low-latency image loading regardless of geography. Pre-generating WebP variants at upload time avoids adding a transformation proxy to the critical read path. WebP reduces payload size by approximately 30% versus JPEG at equivalent quality, which is significant for mobile users on cellular connections.

**Alternatives Considered**:
- **Storing images in the database (bytea via Exposed)**: Rejected. Degrades database performance, inflates backup size, and prevents CDN caching. Not appropriate for any production image serving use case.
- **Cloudinary / Imgix (managed image CDN)**: Considered. Both provide on-the-fly transformation without a pre-generation step. Rejected because per-transformation pricing becomes unpredictable at scale, and the pre-generation approach with the coroutine worker is straightforward to implement. The on-the-fly option can be revisited if the set of required variants grows significantly.
- **Local filesystem storage**: Rejected. Does not work in a horizontally scaled or containerized deployment. Not suitable for production.

---

## 12. LINE Integration for Customer Service

**Decision**: LINE Official Account Messaging API integration via webhooks. Incoming LINE messages are received by a Ktor `post("/webhook/line")` route; the LINE channel secret signature is verified using HMAC-SHA256 computed with the Kotlin standard library before any payload processing. Payloads are parsed with `kotlinx.serialization` using a sealed class hierarchy that models all LINE event types. Parsed events are mapped to internal support tickets. Replies sent from the admin panel are delivered back to the user via Ktor's `HttpClient` calling the LINE Messaging API `reply` or `push` endpoints. The integration maintains a bidirectional sync: each LINE user ID is mapped to a platform user account (when bound), and all messages in both directions are stored in the ticket thread for a complete conversation history via Exposed.

**Rationale**: LINE is the primary customer communication channel in Taiwan with extremely high penetration. Users expect to contact support through LINE rather than email or a web form. `kotlinx.serialization` sealed class hierarchies cleanly model LINE's polymorphic event schema — `TextMessageEvent`, `FollowEvent`, `PostbackEvent`, etc. — exhaustively at compile time, making unhandled event types a compiler warning rather than a runtime null. Ktor's `HttpClient` with the CIO engine handles outbound LINE API calls as coroutines, naturally composing with the rest of the Ktor application without blocking. Signature verification before deserialization prevents spoofed messages from ever reaching business logic.

**Alternatives Considered**:
- **LINE Customer Chat Plugin (LIFF)**: Considered as an alternative entry point. Useful for in-app chat but does not replace direct LINE messaging, which is how most Taiwan users prefer to initiate contact. Both can coexist; the webhook integration is the higher priority.
- **Zendesk / Intercom with LINE channel**: Rejected for MVP. Third-party helpdesk platforms add cost and require data to leave the platform. A custom Ktor implementation within the admin panel is sufficient at launch and avoids sharing user PII with a third party unnecessarily.
- **Manual LINE Manager monitoring**: Rejected. Not scalable and does not create a persistent ticket record linked to the user's account. Agents would have no visibility into a user's draw history or account status when responding.

---

## Open Questions and Deferred Decisions

| Topic | Question | Target Phase |
|---|---|---|
| Payment | Specific ECPay vs NewebPay as primary provider for Phase 1 | Phase 1 |
| SMS OTP | Confirm domestic Taiwan SMS provider shortlist and pricing | Phase 1 |
| Hosting | AWS vs self-hosted Kubernetes; affects S3 and CDN provider choice | Phase 1 |
| Feature Flags | Evaluate migration path to Unleash post-MVP if team grows | Phase 2 |
| Animation | Scratch effect implementation detail (Compose Canvas clip mask vs custom Skia path shader) | Phase 2 |
| i18n | Japanese locale requirement and timeline (potential market expansion) | Phase 3 |
