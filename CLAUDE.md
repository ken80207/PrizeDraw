# PrizeDraw Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-25

## Active Technologies

- Kotlin 2.x / Ktor 3.x / Exposed ORM / Koin DI / kotlinx.serialization (Backend, JVM 21)
- KMP + Compose Multiplatform (Mobile: Android/iOS)
- Next.js 14 + React 18 (Web Player + Admin Dashboard, consuming KMP shared logic via JS/Wasm)
- api-contracts KMP module (shared DTOs, enums, endpoints across all platforms)
- PostgreSQL 16 + Redis 7 + S3-compatible storage (MinIO for local dev)
- K8s-native horizontal scaling architecture

## Project Structure

```text
api-contracts/    # KMP shared types (JVM + Android + iOS + JS/Wasm)
server/           # Kotlin/Ktor backend (api/application/domain/infrastructure)
mobile/           # KMP + Compose Multiplatform (composeApp + shared)
kmp-shared-js/    # KMP → JS/Wasm export for web consumption
web/              # Next.js player-facing web app
admin/            # Next.js admin dashboard
cs/               # Next.js customer service app (cs.prizedraw.tw)
infra/
  ci/             # GitHub Actions workflows (build-server.yml, build-web.yml, deploy.yml)
  docker/         # Dockerfiles + docker-compose.yml
  k8s/            # Kubernetes manifests (server/, ingress/, postgres/, redis/)
  monitoring/     # Prometheus, Grafana dashboards, Loki config
  k6/             # Load test scripts
specs/            # Feature specs, data model, API contracts, task tracking
```

## Architecture

### Backend (server/)

4-layer hexagonal (ports-and-adapters) architecture:
```
api/          → Ktor routes, plugins, request/response mappers
application/  → Use cases (input ports), domain event handlers, services
domain/       → Entities, value objects, domain services (pure, no I/O)
infrastructure/ → Exposed ORM repositories, Redis client, external APIs
```

Key patterns:
- **Auth**: OAuth2 (Google/Apple/LINE) + phone OTP via Twilio. JWT access tokens (15 min) + refresh token families (30 days) with rotation and replay detection.
- **Realtime**: Ktor WebSocket handler + Redis pub/sub for fanout across horizontal pods. `ConnectionManager` maintains per-campaign connection sets.
- **Points Ledger**: All draw-point and revenue-point mutations go through `PointsLedgerService` using optimistic locking on `Player.version` (up to 3 retries with exponential backoff). Never update balances directly.
- **Outbox pattern**: Domain events (draw result, trade, payment) are written to `outbox_events` table atomically with the business transaction. A coroutine worker polls and dispatches them via push notifications and LINE messaging.
- **Queue system**: Kuji draws use a per-box queue. Redis pub/sub notifies waiting players. Draw sessions expire after `draw_session_seconds`.
- **Cache**: `CacheService` wraps the Redis pool. Hot reads cached: active campaigns (30s TTL), prize definitions (60s TTL), feature flags (30s TTL), leaderboards (5min TTL). Cache invalidated on write operations.

### Mobile (mobile/)

KMP + Compose Multiplatform targeting Android + iOS:
- MVI pattern: `State` / `Intent` / `Effect` per screen
- Shared `domain/` and `data/` layers in `mobile/shared/`
- Platform-specific: auth providers, push notification, biometrics in `androidMain/` / `iosMain/`

### Web / Admin (web/, admin/)

Next.js 14 App Router:
- KMP shared business logic compiled to JS/Wasm via `kmp-shared-js/`
- `next-intl` for i18n with `zh-TW` default locale
- WebSocket client in `features/kuji/` for live draw board

## Commands

### Development

```bash
# Start all services (Postgres, Redis, MinIO, server, web, admin)
docker-compose -f infra/docker/docker-compose.yml up -d

# Server: build + test + lint
./gradlew build
./gradlew test
./gradlew ktlintCheck
./gradlew detekt

# Server: build only (skip tests — for fast iteration)
./gradlew build -x test

# Web + Admin + CS
pnpm install
pnpm --filter web dev          # http://localhost:3000
pnpm --filter admin dev        # http://localhost:3001
pnpm --filter cs dev           # http://localhost:3002
pnpm --filter web test
pnpm --filter web lint
pnpm --filter admin lint
pnpm --filter cs lint

# Database migrations (Flyway runs automatically on server startup)
# To run manually:
./gradlew :server:flywayMigrate -Dflyway.url=jdbc:postgresql://localhost:5432/prizedraw \
  -Dflyway.user=prizedraw -Dflyway.password=prizedraw
```

### CI / Deploy

```bash
# Build Docker images
docker build -f infra/docker/Dockerfile.server -t prizedraw/server .
docker build -f infra/docker/Dockerfile.web -t prizedraw/web web/
docker build -f infra/docker/Dockerfile.admin -t prizedraw/admin admin/
docker build -f infra/docker/Dockerfile.cs -t prizedraw/cs cs/

# Apply K8s manifests
kubectl apply -f infra/k8s/server/
kubectl apply -f infra/k8s/ingress/
kubectl apply -f infra/k8s/postgres/
kubectl apply -f infra/k8s/redis/

# Run load tests (requires k6)
k6 run --env BASE_URL=http://localhost:8080 infra/k6/load-test.js
```

## Code Style

- **Kotlin**: ktlint + detekt enforced in CI. Explicit API mode enabled on all KMP modules. KDoc required on all `public` declarations.
- **Web**: ESLint + Prettier. TypeScript strict mode.
- **Contracts first**: `api-contracts` is the canonical contract boundary. Update DTOs/enums/endpoint constants there before implementing server routes or client code.
- **Null safety**: No `!!` operator in production code. Use `?: error(...)` or `?: return` instead.
- **Coroutines**: All DB operations use `newSuspendedTransaction`. All external service calls are suspending. Never call `runBlocking` inside a request handler.

## Database Migrations

Flyway migrations live in `server/src/main/resources/db/migration/`.
Naming: `V{n}__{description}.sql` (sequential, never edit a committed migration).

Current migration history:
| Version | Description |
|---------|-------------|
| V001 | Create players |
| V002 | Create wallets and points |
| V003 | Create campaigns and tickets |
| V004 | Create prizes |
| V005 | Create trade and exchange |
| V006 | Create shipping |
| V007 | Create payments and withdrawals |
| V008 | Create coupons |
| V009 | Create support |
| V010 | Create audit and outbox |
| V011 | Create refresh token families |
| V012 | Create feature flags, queues, staff |
| V013 | Add refresh token expiry |
| V014 | Add performance indexes |

## i18n

- **Server**: `server/src/main/resources/i18n/messages_zh_TW.properties` (default) and `messages_en.properties` (fallback). Loaded via `I18nService`.
- **KMP / Mobile / Web**: `kmp-shared-js/src/commonMain/kotlin/com/prizedraw/shared/i18n/I18nKeys.kt` — canonical string constant keys shared by all platforms.
- **Web/Admin**: `next-intl` with `src/i18n/zh-TW.json` as default locale.

## Security

- Input sanitization: `InputSanitizationPlugin` rejects dangerous `Content-Type` headers. Route handlers use `sanitizeHtml()` on all free-text fields.
- Security headers: `SecurityHeadersPlugin` adds HSTS, X-Frame-Options, X-Content-Type-Options, CSP, Referrer-Policy, Permissions-Policy to every response.
- Rate limiting: 3 tiers — `auth` (5/min), `draw` (10/min per user), `default` (60/min per user) via Ktor `RateLimit` plugin.
- Response compression: Gzip + Deflate on responses > 1 KB via `Compression` plugin.

## Observability

- **Metrics**: Micrometer → Prometheus scrape at `/metrics`. Dashboards at `infra/monitoring/grafana/dashboards/`.
- **Alerts**: `infra/monitoring/prometheus/alert-rules.yml` — payment failure rate, API p95, WebSocket count, 5xx error rate, disk usage, Redis memory.
- **Logs**: Structured JSON via Logback. `traceId`, `playerId`, `campaignId` in MDC. Aggregated by Loki (`infra/monitoring/loki/loki-config.yml`).

## Performance Targets

| Operation | Target |
|-----------|--------|
| API p95 (general) | < 200ms |
| API p95 (draw endpoint) | < 500ms |
| Unlimited draw p95 | < 200ms |
| WebSocket broadcast | < 2s |
| DB connection acquisition | < 50ms |

## Recent Changes

- 001-ichiban-kuji-platform: Full Kotlin stack (Ktor + KMP + Compose Multiplatform + Next.js web)
- Phase 19: Polish & Cross-Cutting — i18n bundles, Redis cache layer, performance indexes (V014), security plugins (InputSanitization, SecurityHeaders, Compression), K8s manifests, Prometheus/Grafana/Loki observability, Kotest unit + integration tests, k6 load tests, GitHub Actions deploy workflow

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
