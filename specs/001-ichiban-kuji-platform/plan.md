# Implementation Plan: 賞品抽獎平台（Prize Draw Platform）

**Branch**: `001-ichiban-kuji-platform` | **Date**: 2026-03-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-ichiban-kuji-platform/spec.md`

## Summary

建構一個跨平台（Android、iOS、Web）的賞品抽獎平台，支援兩種核心玩法：一番賞（定量排隊制、自選籤、多籤盒、即時同步觀戰）與無限賞（機率制、即抽即開）。平台包含賞品交易市集、玩家交換、官方回收、雙點數系統（消費點數/收益點數）、第三方金流購買點數、收益點數提領現金、賞品寄送物流、優惠券折扣碼、多種開獎動畫、排行榜、後台管理系統（多角色權限）、客服系統（含 LINE 整合）、Feature Flag、全系統 i18n、完整可觀測性。

## Technical Context

**Language/Version**: Kotlin 2.x (Backend: Ktor 3.x on JVM 21; Mobile: KMP + Compose Multiplatform targeting Android/iOS; Web Player + Admin: Next.js 14 / React 18, consuming KMP shared module via JS/Wasm for business logic)
**Primary Dependencies**: Ktor (API server + WebSocket + Ktor Client), Exposed ORM (database), Koin (DI), kotlinx.serialization (JSON), Flyway (migrations), Kotest + JUnit5 (testing), Kermit (logging), Coil 3 (images, mobile), DataStore (local persistence, mobile), Firebase Messaging (push notifications), Next.js + React (web UI), KMP JS/Wasm export (shared business logic for web)
**Storage**: PostgreSQL 16 (primary), Redis 7 (cache/pubsub/distributed locks), S3-compatible object storage (images)
**Testing**: Kotest + JUnit5 (unit/integration), Ktor testApplication (API integration), Maestro (E2E mobile), Playwright (E2E web), Vitest (web unit), k6 (performance/load)
**Target Platform**: Linux server (Docker/K8s, JVM 21), iOS 16+, Android 10+ (API 29+), Modern browsers (Chrome/Safari/Firefox/Edge)
**Project Type**: Full-stack web-service + mobile-app (KMP) + web-app (Next.js + KMP shared) + admin-dashboard (Next.js + KMP shared)
**Performance Goals**: API read p95 < 200ms, write p95 < 500ms, WebSocket broadcast < 2s, 10,000 concurrent users, 60fps animations
**Constraints**: Page load < 2s on 4G, bundle size budget enforced, zero data loss on financial operations, 99.9% uptime
**Scale/Scope**: 10,000 concurrent active players, K8s-native horizontal scaling (HPA auto-scale, stateless API pods, Redis pub/sub for WebSocket fanout, PgBouncer for DB pooling), multi-region deployment ready, i18n from day one

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Code Quality First | Kotlin strict null safety, ktlint + detekt enforced in CI, monorepo shared api-contracts KMP module eliminates DTO duplication across server and all clients, ports-and-adapters architecture enforces dependency direction | PASS |
| II. Testing Standards | Kotest unit tests (80% branch coverage target), JUnit5 + Ktor testApplication for all financial flow integration tests, TDD recommended for domain layer, Maestro E2E for mobile, Playwright E2E for web Wasm, k6 for load testing | PASS |
| III. UX Consistency | Compose Multiplatform shared UI components across Android/iOS/Web targets, Material 3 design system, WCAG 2.1 AA accessibility semantics via Compose semantics API, animation ≤ 300ms (UI state), full i18n via Lyricist or equivalent KMP i18n library | PASS |
| IV. Performance | API p95 targets defined, Wasm bundle size CI check, DB query EXPLAIN ANALYZE enforcement, k6 perf tests in CI, Ktor coroutine-based concurrency for high throughput, structured concurrency prevents memory leaks | PASS |
| Quality Gates | CI pipeline: ktlint + detekt + Kotest + Ktor integration tests + a11y audit + bundle size check + k6 smoke test, code review required for all PRs | PASS |

All gates pass. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-ichiban-kuji-platform/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── api-rest.md      # REST API contracts
│   ├── api-websocket.md # WebSocket event contracts
│   └── api-webhooks.md  # Payment/LINE webhook contracts
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
project-root/
├── api-contracts/              # KMP module: shared DTOs, enums, endpoints
│   └── src/commonMain/kotlin/
│       ├── dto/                # Request/Response DTOs by feature
│       │   ├── auth/           # LoginRequest, TokenResponse, RefreshRequest, etc.
│       │   ├── player/         # PlayerDto, WalletDto, PointTransactionDto, etc.
│       │   ├── campaign/       # CampaignDto, CreateCampaignRequest, etc.
│       │   ├── draw/           # DrawRequest, DrawResultDto, PrizeRevealDto, etc.
│       │   ├── trade/          # TradeListingDto, CreateListingRequest, etc.
│       │   ├── exchange/       # ExchangeOfferDto, CreateExchangeRequest, etc.
│       │   ├── shipping/       # ShippingOrderDto, AddressDto, etc.
│       │   ├── payment/        # PaymentIntentDto, WebhookPayload, etc.
│       │   ├── coupon/         # CouponDto, ApplyCouponRequest, etc.
│       │   ├── leaderboard/    # LeaderboardEntryDto, RankingDto, etc.
│       │   ├── support/        # TicketDto, CreateTicketRequest, etc.
│       │   ├── admin/          # AdminUserDto, StaffRoleDto, etc.
│       │   └── notification/   # PushPayloadDto, NotificationDto, etc.
│       ├── enums/              # Shared enums (campaign status, prize states, etc.)
│       │   ├── CampaignStatus.kt
│       │   ├── CampaignType.kt
│       │   ├── PrizeState.kt
│       │   ├── PointType.kt
│       │   ├── TradeListingStatus.kt
│       │   ├── ShippingStatus.kt
│       │   ├── WithdrawalStatus.kt
│       │   └── SupportTicketStatus.kt
│       └── endpoints/          # Endpoint path constants
│           ├── AuthEndpoints.kt
│           ├── PlayerEndpoints.kt
│           ├── CampaignEndpoints.kt
│           ├── DrawEndpoints.kt
│           ├── TradeEndpoints.kt
│           ├── ShippingEndpoints.kt
│           ├── PaymentEndpoints.kt
│           ├── AdminEndpoints.kt
│           └── WebSocketEndpoints.kt
│
├── server/                     # Kotlin/Ktor backend
│   └── src/main/kotlin/
│       ├── api/                # Routes, plugins, DTO mappers
│       │   ├── routes/         # Ktor route definitions grouped by feature
│       │   │   ├── AuthRoutes.kt
│       │   │   ├── PlayerRoutes.kt
│       │   │   ├── CampaignRoutes.kt
│       │   │   ├── DrawRoutes.kt
│       │   │   ├── TradeRoutes.kt
│       │   │   ├── ExchangeRoutes.kt
│       │   │   ├── BuybackRoutes.kt
│       │   │   ├── ShippingRoutes.kt
│       │   │   ├── PaymentRoutes.kt
│       │   │   ├── WithdrawalRoutes.kt
│       │   │   ├── CouponRoutes.kt
│       │   │   ├── LeaderboardRoutes.kt
│       │   │   ├── SupportRoutes.kt
│       │   │   ├── AdminRoutes.kt
│       │   │   ├── FeatureFlagRoutes.kt
│       │   │   ├── AuditRoutes.kt
│       │   │   └── NotificationRoutes.kt
│       │   ├── plugins/        # Ktor plugins (auth, serialization, CORS, etc.)
│       │   │   ├── Security.kt         # JWT bearer auth plugin setup
│       │   │   ├── Serialization.kt    # kotlinx.serialization content negotiation
│       │   │   ├── Routing.kt          # Route registration
│       │   │   ├── CORS.kt
│       │   │   ├── RateLimit.kt
│       │   │   ├── RequestValidation.kt
│       │   │   ├── StatusPages.kt      # Centralized error handling
│       │   │   ├── WebSockets.kt       # Ktor WebSocket plugin
│       │   │   └── Monitoring.kt       # Metrics, tracing
│       │   └── mappers/        # Domain entity <-> DTO mappers (extension functions)
│       │       ├── PlayerMappers.kt
│       │       ├── CampaignMappers.kt
│       │       ├── DrawMappers.kt
│       │       ├── TradeMappers.kt
│       │       └── ...
│       │
│       ├── application/        # Use cases, ports, services
│       │   ├── ports/
│       │   │   ├── input/      # Use case interfaces (inbound ports)
│       │   │   │   ├── auth/   # ILoginUseCase, IRefreshTokenUseCase, etc.
│       │   │   │   ├── player/ # IGetPlayerProfileUseCase, IUpdateWalletUseCase, etc.
│       │   │   │   ├── campaign/
│       │   │   │   ├── draw/   # IDrawKujiUseCase, IDrawUnlimitedUseCase, etc.
│       │   │   │   ├── trade/
│       │   │   │   ├── exchange/
│       │   │   │   ├── buyback/
│       │   │   │   ├── shipping/
│       │   │   │   ├── payment/
│       │   │   │   ├── withdrawal/
│       │   │   │   ├── coupon/
│       │   │   │   ├── leaderboard/
│       │   │   │   ├── support/
│       │   │   │   └── admin/
│       │   │   └── output/     # Repository + external service interfaces (outbound ports)
│       │   │       ├── IPlayerRepository.kt
│       │   │       ├── ICampaignRepository.kt
│       │   │       ├── ITicketBoxRepository.kt
│       │   │       ├── IDrawRepository.kt
│       │   │       ├── IPrizeRepository.kt
│       │   │       ├── ITradeRepository.kt
│       │   │       ├── IExchangeRepository.kt
│       │   │       ├── IBuybackRepository.kt
│       │   │       ├── IShippingRepository.kt
│       │   │       ├── IPaymentGateway.kt
│       │   │       ├── IWithdrawalGateway.kt
│       │   │       ├── ICouponRepository.kt
│       │   │       ├── ILeaderboardRepository.kt
│       │   │       ├── ISupportRepository.kt
│       │   │       ├── INotificationService.kt
│       │   │       ├── IStorageService.kt
│       │   │       ├── IFeatureFlagRepository.kt
│       │   │       ├── IAuditRepository.kt
│       │   │       └── IOutboxRepository.kt
│       │   ├── usecases/       # Use case implementations
│       │   │   ├── auth/
│       │   │   ├── player/
│       │   │   ├── campaign/
│       │   │   ├── draw/       # DrawKujiUseCase, DrawUnlimitedUseCase
│       │   │   ├── trade/
│       │   │   ├── exchange/
│       │   │   ├── buyback/
│       │   │   ├── shipping/
│       │   │   ├── payment/
│       │   │   ├── withdrawal/
│       │   │   ├── coupon/
│       │   │   ├── leaderboard/
│       │   │   ├── support/
│       │   │   └── admin/
│       │   ├── services/       # Application-level orchestration services
│       │   │   ├── TokenService.kt             # JWT creation, refresh, family revocation
│       │   │   ├── PointsLedgerService.kt      # Dual-point atomic debit/credit
│       │   │   ├── KujiQueueService.kt         # Ticket selection queue management
│       │   │   └── DrawEngineService.kt        # Probability engine (unlimited kuji)
│       │   └── events/         # Domain events + outbox pattern
│       │       ├── DomainEvent.kt              # Sealed class hierarchy for all events
│       │       ├── OutboxWorker.kt             # Coroutine-based outbox processor
│       │       └── handlers/                   # Per-event handlers (push, webhooks, etc.)
│       │
│       ├── domain/             # Entities, value objects, domain services
│       │   ├── entities/
│       │   │   ├── Player.kt
│       │   │   ├── Wallet.kt
│       │   │   ├── Campaign.kt
│       │   │   ├── TicketBox.kt
│       │   │   ├── Ticket.kt
│       │   │   ├── Prize.kt
│       │   │   ├── PrizeInstance.kt
│       │   │   ├── TradeListing.kt
│       │   │   ├── ExchangeOffer.kt
│       │   │   ├── BuybackOrder.kt
│       │   │   ├── ShippingOrder.kt
│       │   │   ├── PaymentOrder.kt
│       │   │   ├── WithdrawalRequest.kt
│       │   │   ├── Coupon.kt
│       │   │   ├── SupportTicket.kt
│       │   │   └── AuditLog.kt
│       │   ├── valueobjects/
│       │   │   ├── PlayerId.kt
│       │   │   ├── CampaignId.kt
│       │   │   ├── PrizeId.kt
│       │   │   ├── Money.kt
│       │   │   ├── PointAmount.kt
│       │   │   ├── PhoneNumber.kt
│       │   │   ├── EmailAddress.kt
│       │   │   └── DrawProbability.kt
│       │   └── services/       # Pure domain services (no infrastructure deps)
│       │       ├── KujiDrawDomainService.kt    # Ticket selection fairness rules
│       │       ├── UnlimitedDrawDomainService.kt # Probability calculation
│       │       └── PriceCalculationService.kt  # Coupon application rules
│       │
│       └── infrastructure/     # DB, external integrations, websocket
│           ├── persistence/    # Exposed ORM table definitions + repository impls
│           │   ├── tables/     # Exposed Table objects
│           │   │   ├── PlayersTable.kt
│           │   │   ├── WalletsTable.kt
│           │   │   ├── PointTransactionsTable.kt
│           │   │   ├── CampaignsTable.kt
│           │   │   ├── TicketBoxesTable.kt
│           │   │   ├── TicketsTable.kt
│           │   │   ├── PrizesTable.kt
│           │   │   ├── PrizeInstancesTable.kt
│           │   │   ├── TradeListingsTable.kt
│           │   │   ├── ExchangeOffersTable.kt
│           │   │   ├── BuybackOrdersTable.kt
│           │   │   ├── ShippingOrdersTable.kt
│           │   │   ├── PaymentOrdersTable.kt
│           │   │   ├── WithdrawalRequestsTable.kt
│           │   │   ├── CouponsTable.kt
│           │   │   ├── SupportTicketsTable.kt
│           │   │   ├── AuditLogsTable.kt
│           │   │   ├── OutboxEventsTable.kt
│           │   │   ├── RefreshTokenFamiliesTable.kt
│           │   │   └── FeatureFlagsTable.kt
│           │   ├── repositories/   # IXxxRepository implementations using Exposed
│           │   │   ├── PlayerRepositoryImpl.kt
│           │   │   ├── CampaignRepositoryImpl.kt
│           │   │   ├── DrawRepositoryImpl.kt
│           │   │   ├── TradeRepositoryImpl.kt
│           │   │   ├── ExchangeRepositoryImpl.kt
│           │   │   ├── BuybackRepositoryImpl.kt
│           │   │   ├── ShippingRepositoryImpl.kt
│           │   │   ├── CouponRepositoryImpl.kt
│           │   │   ├── LeaderboardRepositoryImpl.kt
│           │   │   ├── SupportRepositoryImpl.kt
│           │   │   ├── AuditRepositoryImpl.kt
│           │   │   ├── OutboxRepositoryImpl.kt
│           │   │   └── FeatureFlagRepositoryImpl.kt
│           │   └── migrations/     # Flyway SQL migrations
│           │       ├── V001__create_players.sql
│           │       ├── V002__create_wallets_and_points.sql
│           │       ├── V003__create_campaigns_and_tickets.sql
│           │       ├── V004__create_prizes.sql
│           │       ├── V005__create_trade_and_exchange.sql
│           │       ├── V006__create_shipping.sql
│           │       ├── V007__create_payments_and_withdrawals.sql
│           │       ├── V008__create_coupons.sql
│           │       ├── V009__create_support.sql
│           │       ├── V010__create_audit_and_outbox.sql
│           │       ├── V011__create_refresh_token_families.sql
│           │       └── V012__create_feature_flags.sql
│           ├── external/       # Third-party service adapters
│           │   ├── payment/    # Payment gateway adapter (IPaymentGateway impl)
│           │   ├── withdrawal/ # Bank/payout adapter (IWithdrawalGateway impl)
│           │   ├── storage/    # S3-compatible adapter (IStorageService impl)
│           │   ├── push/       # Firebase Messaging adapter (INotificationService impl)
│           │   ├── line/       # LINE Messaging API adapter (support integration)
│           │   └── redis/      # Redis client (cache, pub/sub, distributed lock utils)
│           ├── websocket/      # Ktor WebSocket handler + kuji room management
│           │   ├── KujiWebSocketHandler.kt     # Per-campaign room, broadcast to viewers
│           │   ├── QueueWebSocketHandler.kt    # Live queue position updates
│           │   └── ConnectionManager.kt        # Session registry, heartbeat
│           └── di/             # Koin module definitions
│               ├── DatabaseModule.kt
│               ├── RepositoryModule.kt
│               ├── UseCaseModule.kt
│               ├── ServiceModule.kt
│               ├── ExternalModule.kt
│               └── WebSocketModule.kt
│
├── mobile/
│   ├── composeApp/             # Android/iOS Compose Multiplatform UI
│   │   └── src/
│   │       ├── commonMain/     # Shared Compose UI, navigation, ViewModels (MVI)
│   │       │   └── kotlin/
│   │       │       ├── navigation/     # Navigation graph (Compose Navigation)
│   │       │       ├── screens/        # Screen composables (one per feature)
│   │       │       │   ├── auth/
│   │       │       │   ├── home/
│   │       │       │   ├── campaign/   # Kuji board + unlimited draw screens
│   │       │       │   ├── draw/       # Draw animation composables
│   │       │       │   ├── prize/      # My prizes, prize detail
│   │       │       │   ├── trade/      # Marketplace listing, buy flow
│   │       │       │   ├── exchange/   # Exchange offer flow
│   │       │       │   ├── shipping/   # Address input, tracking
│   │       │       │   ├── wallet/     # Point balance, top-up, withdrawal
│   │       │       │   ├── leaderboard/
│   │       │       │   ├── support/    # Ticket list, chat
│   │       │       │   └── settings/
│   │       │       ├── viewmodels/     # MVI ViewModels (State/Intent/Effect)
│   │       │       │   ├── base/       # BaseViewModel with MVI scaffolding
│   │       │       │   ├── auth/
│   │       │       │   ├── campaign/
│   │       │       │   ├── draw/
│   │       │       │   ├── trade/
│   │       │       │   ├── wallet/
│   │       │       │   └── ...
│   │       │       ├── components/     # Shared Compose component library
│   │       │       │   ├── PrizeCard.kt
│   │       │       │   ├── KujiBoard.kt
│   │       │       │   ├── PointBadge.kt
│   │       │       │   ├── AnimatedReveal.kt   # Draw animation composables
│   │       │       │   └── ...
│   │       │       └── di/             # Koin module for UI layer
│   │       ├── androidMain/    # Android-specific entry point, theme, Firebase init
│   │       └── iosMain/        # iOS-specific entry point, UIKit interop
│   │
│   └── shared/                 # KMP shared data/domain/platform layer
│       └── src/commonMain/kotlin/
│           ├── data/           # API client, repositories, storage
│           │   ├── remote/     # Ktor Client HTTP calls (uses api-contracts DTOs)
│           │   │   ├── KtorHttpClient.kt       # Configured Ktor Client with JWT interceptor + token refresh
│           │   │   ├── AuthRemoteDataSource.kt
│           │   │   ├── CampaignRemoteDataSource.kt
│           │   │   ├── DrawRemoteDataSource.kt
│           │   │   ├── TradeRemoteDataSource.kt
│           │   │   ├── WalletRemoteDataSource.kt
│           │   │   └── ...
│           │   ├── local/      # DataStore persistence
│           │   │   ├── AuthTokenStore.kt       # Encrypted token storage
│           │   │   ├── PlayerPrefsStore.kt
│           │   │   └── CampaignCacheStore.kt
│           │   ├── websocket/  # Ktor WebSocket client (kuji room, queue)
│           │   │   ├── KujiWebSocketClient.kt
│           │   │   └── QueueWebSocketClient.kt
│           │   └── repositories/   # Repository implementations bridging remote + local
│           │       ├── AuthRepositoryImpl.kt
│           │       ├── CampaignRepositoryImpl.kt
│           │       ├── DrawRepositoryImpl.kt
│           │       ├── TradeRepositoryImpl.kt
│           │       └── ...
│           ├── domain/         # Domain models + use case interfaces
│           │   ├── models/     # Client-side domain models (mapped from DTOs)
│           │   ├── usecases/   # Client-side use cases (login, draw, buy, etc.)
│           │   └── repositories/   # Repository interfaces
│           └── platform/       # Expect/actual platform abstractions
│               ├── ImageLoader.kt      # Coil 3 integration
│               ├── PushNotification.kt # Firebase Messaging
│               ├── BiometricAuth.kt
│               └── Logging.kt          # Kermit logger
│
├── kmp-shared-js/              # KMP → JS/Wasm export for web consumption
│   └── src/
│       ├── commonMain/         # Re-exports from api-contracts + shared business logic
│       │   └── kotlin/
│       │       ├── validation/         # Shared validation rules (points, coupons, etc.)
│       │       ├── models/             # Domain models shared with web
│       │       └── utils/              # Shared utilities (formatting, i18n keys)
│       └── jsMain/             # JS-specific bindings (@JsExport)
│           └── kotlin/
│               └── JsExports.kt       # @JsExport wrappers for web consumption
│
├── web/                        # Next.js 14 + React 18 (Player-facing web app)
│   ├── src/
│   │   ├── app/                # Next.js App Router pages
│   │   │   ├── (auth)/         # Login, phone binding
│   │   │   ├── campaigns/      # Campaign list, kuji board, unlimited draw
│   │   │   ├── draw/           # Draw animation pages
│   │   │   ├── prizes/         # My prizes, prize detail
│   │   │   ├── trade/          # Marketplace, listing, buy flow
│   │   │   ├── exchange/       # Exchange offer flow
│   │   │   ├── wallet/         # Point balance, top-up, withdrawal
│   │   │   ├── shipping/       # Address, tracking
│   │   │   ├── leaderboard/
│   │   │   ├── support/        # Ticket list, chat
│   │   │   └── settings/
│   │   ├── components/         # React UI components (design system)
│   │   ├── features/           # Feature modules (hooks + logic per domain)
│   │   ├── hooks/              # Custom React hooks
│   │   ├── services/           # API client (REST + WebSocket)
│   │   ├── stores/             # Zustand state management
│   │   ├── animations/         # Draw animation (Canvas/Lottie)
│   │   ├── lib/
│   │   │   └── kmp/            # KMP JS/Wasm module import bridge
│   │   └── i18n/               # next-intl / i18next config
│   ├── public/
│   └── tests/                  # Vitest unit + Playwright E2E
│
├── admin/                      # Next.js 14 + React 18 (Admin Dashboard)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/         # Staff login
│   │   │   ├── dashboard/      # Overview metrics
│   │   │   ├── campaigns/      # Campaign CRUD, kuji ticket setup
│   │   │   ├── prizes/         # Prize inventory management
│   │   │   ├── players/        # Player management, wallet adjustments
│   │   │   ├── trade/          # Marketplace moderation
│   │   │   ├── shipping/       # Shipping order management
│   │   │   ├── payments/       # Payment order review
│   │   │   ├── withdrawals/    # Withdrawal approval queue
│   │   │   ├── coupons/        # Coupon/discount code management
│   │   │   ├── leaderboard/    # Leaderboard configuration
│   │   │   ├── support/        # Support ticket management + LINE
│   │   │   ├── staff/          # Staff accounts + RBAC roles
│   │   │   ├── feature-flags/  # Feature flag toggles
│   │   │   ├── audit/          # Audit log viewer
│   │   │   └── settings/
│   │   ├── components/         # Admin UI components (tables, forms, charts)
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── stores/
│   │   └── lib/
│   │       └── kmp/            # KMP JS/Wasm module import bridge
│   └── tests/
│
└── infra/                      # Infrastructure & DevOps
    ├── docker/
    │   ├── Dockerfile.server           # Multi-stage JVM build (JDK 21 / distroless)
    │   ├── Dockerfile.web              # Next.js standalone build
    │   ├── Dockerfile.admin            # Next.js standalone build
    │   └── docker-compose.yml          # Local dev: postgres, redis, server, web, admin
    ├── k8s/
    │   ├── server/                     # Deployment, Service, HPA, ConfigMap
    │   ├── web/
    │   ├── admin/
    │   ├── postgres/                   # StatefulSet + PVC
    │   ├── redis/                      # StatefulSet
    │   └── ingress/                    # Ingress + TLS
    ├── monitoring/
    │   ├── grafana/                    # Dashboards: API latency, DB pool, WebSocket conns
    │   ├── prometheus/                 # Scrape configs + alert rules
    │   └── loki/                       # Log aggregation config
    └── ci/
        ├── build-server.yml            # Gradle build + Kotest + ktlint + detekt
        ├── build-mobile.yml            # KMP Android/iOS build + Maestro E2E
        ├── build-web.yml               # Next.js build + Vitest + Playwright E2E + bundle size check
        └── deploy.yml                  # K8s rolling deploy + Flyway migrate
```

**Structure Decision**: 混合式 monorepo — Gradle 管理 Kotlin 模組（api-contracts, server, mobile, kmp-shared-js），pnpm workspace 管理 Web 模組（web, admin）。共 7 個頂層模組：`api-contracts`（KMP 共用型別，編譯至 JVM + Android + iOS + JS/Wasm）、`server`（Ktor backend）、`mobile`（KMP + Compose Multiplatform）、`kmp-shared-js`（KMP → JS/Wasm 匯出供 Web 消費）、`web`（Next.js 玩家端，引用 KMP 共用邏輯）、`admin`（Next.js 管理後台，引用 KMP 共用邏輯）、`infra`。Web 端使用 Web 原生技術（React/Next.js）做 UI，但透過 KMP JS/Wasm export 共用商業邏輯、DTO 型別與驗證規則，達到一次定義、全平台共用。系統設計為 K8s-native 水平擴展架構，所有服務皆容器化並支援 HPA 自動擴縮。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 7 modules in hybrid monorepo (Gradle + pnpm) | Server (JVM), Web (Next.js), Admin (Next.js), Mobile (KMP), api-contracts (KMP shared), kmp-shared-js (KMP→JS bridge), infra — each has distinct compilation targets and deployment pipelines | Fewer modules would mix JVM/JS/native targets; hybrid monorepo gives Kotlin modules Gradle management and Web modules pnpm/Node toolchain |
| PostgreSQL + Redis (dual storage) | Redis required for realtime pub/sub (WebSocket room broadcast), distributed locks (prevent double-draw race conditions), and hot-path caching; PostgreSQL for ACID-compliant financial data and domain state | Single DB cannot meet both sub-2s realtime sync and transactional integrity; Redis Streams/pub-sub cannot replace PostgreSQL for financial audit trails |
| Ktor WebSocket realtime layer | One-page kuji ticket board requires sub-2s sync to all concurrent viewers showing live ticket selection and queue position; HTTP polling cannot meet this at scale | Long-polling adds per-request overhead and does not broadcast efficiently to N concurrent watchers; SSE is unidirectional and cannot carry bidirectional queue intent messages |
| Domain event outbox pattern (custom coroutine worker, not BullMQ) | Guarantees at-least-once delivery of domain events (push notifications, webhook callbacks, leaderboard updates) even if Redis or external services are temporarily unavailable; events are written atomically with the DB transaction | Pure in-process event bus loses events on crash; BullMQ is Node.js-specific and unavailable in the JVM stack; a simple Kotlin coroutine worker polling the outbox table is idiomatic, dependency-free, and fully testable |
| KMP Compose Multiplatform for mobile (vs native per-platform) | Shared business logic (data layer, domain layer, MVI ViewModels) across Android and iOS eliminates duplicated Kotlin/Swift implementations; Compose UI sharing reduces platform-specific screen code by ~70% | React Native adds a JS bridge overhead incompatible with the all-Kotlin stack; separate native apps double maintenance cost and make type-safe api-contracts sharing impossible without code generation |
| Next.js + KMP JS/Wasm export for web (vs Compose for Web) | Web 端使用成熟的 React/Next.js 生態系做 UI（SEO、SSR、豐富的 UI library），但透過 KMP JS/Wasm target 共用商業邏輯與 DTO，避免手動維護兩套型別系統 | Pure Compose for Web (Wasm) 的 UI component 生態系尚不成熟、SEO 支援弱、bundle size 大；純 TypeScript 則需手動維護第二套 DTO 與驗證邏輯 |
| K8s-native horizontal scaling architecture | 所有服務（API server、web、admin）皆設計為 stateless container，透過 K8s HPA 依 CPU/request count 自動水平擴縮；WebSocket sticky session 透過 Redis pub/sub adapter 解耦；DB connection pool 配合 PgBouncer | 單機部署無法應對 10,000+ 並發用戶的即時同步與金流壓力；手動 VM scaling 反應慢且成本高 |
| JWT refresh token with family-level revocation | Refresh token rotation with family tracking detects stolen-token replay attacks; if a rotated (already-used) token is presented, the entire family is revoked, protecting all sessions of that player | Simple long-lived refresh tokens with no rotation are vulnerable to silent token theft; per-token blacklisting in Redis does not detect reuse of a rotated token that was intercepted in transit |
