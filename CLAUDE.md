# PrizeDraw Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-29

## Active Technologies

- Kotlin 2.x / Ktor 3.x / Exposed ORM / Koin DI / kotlinx.serialization (Backend, JVM 21)
- KMP + Compose Multiplatform (Mobile: Android/iOS)
- Next.js 14 + React 18 (Web Player + Admin Dashboard, consuming KMP shared logic via JS/Wasm)
- api-contracts KMP module (shared DTOs, enums, endpoints across all platforms)
- PostgreSQL 16 + Redis 7 + S3-compatible storage (MinIO for local dev)
- Kustomize for K8s multi-environment deployment (dev/staging/prod)
- Resilience4j for inter-service circuit breakers

## Project Structure

```text
api-contracts/         # KMP shared types (JVM + Android + iOS + JS/Wasm)
db-schema/             # Shared Exposed table definitions (single source of truth for all services)
shared/                # Shared server libraries (HealthCheck, JwtVerifier, CircuitBreakers, EnvironmentConfig)
server/                # Core API — Auth, Player, Campaign CRUD, Trade, Exchange, Shipping, Admin
draw-service/          # Draw Service — DrawCore, Queue, Pity, Inventory, Leaderboard
realtime-gateway/      # Realtime Gateway — All WebSocket connections (kuji, queue, chat, feed, notifications)
notification-worker/   # Notification Worker — Outbox consumer, FCM push, LINE messaging
mobile/                # KMP + Compose Multiplatform (composeApp + shared)
kmp-shared-js/         # KMP → JS/Wasm export for web consumption
kmp-game-shared/       # KMP game shared logic
web/                   # Next.js player-facing web app
admin/                 # Next.js admin dashboard
cs/                    # Next.js customer service app (cs.prizedraw.tw)
.forgejo/workflows/    # Forgejo CI/CD (server-ci, server-staging, server-production, web-ci, web-staging, web-production)
deployment/
  nas-staging/         # NAS staging docker-compose (pulled images from GHCR)
infra/
  docker/              # Dockerfiles + docker-compose.yml + per-environment env files
  k8s/
    base/              # Kustomize base manifests (4 services + postgres + redis + ingress)
    overlays/          # Kustomize overlays (dev/, staging/, prod/)
  monitoring/          # Prometheus, Grafana dashboards, Loki config
  k6/                  # Load test scripts
specs/                 # Feature specs, data model, API contracts, task tracking
docs/                  # Implementation plans
```

## Architecture

### Microservice Architecture

```
┌─────────────────────────────────────────────────────┐
│              Ingress (per environment)                │
└────┬──────────────┬────────────────┬────────────────┘
     │              │                │
┌────▼────┐   ┌─────▼──────┐  ┌─────▼──────┐
│Core API │   │Draw Service│  │ Realtime   │
│ :9092   │   │ :9093      │  │ Gateway    │
│         │   │            │  │ :9094      │
│Auth     │   │DrawCore    │  │ WebSocket  │
│Player   │   │Queue/Pity  │  │ connections│
│Campaign │   │Inventory   │  │ Chat/Feed  │
│Trade    │   │Leaderboard │  │            │
│Shipping │   │            │  │            │
│Admin    │   │            │  │            │
└────┬────┘   └─────┬──────┘  └─────┬──────┘
     │              │               │
     └──────┬───────┘               │
            │                       │
   ┌────────▼────────┐      ┌──────▼──────┐
   │   PostgreSQL    │      │    Redis     │
   │   (shared)      │      │  (shared)    │
   └─────────────────┘      └─────────────┘
            │
   ┌────────▼────────┐
   │  Notification   │
   │  Worker :9095   │
   └─────────────────┘
```

### Service Boundaries

| Service | Port | Owns | Why independent |
|---------|------|------|-----------------|
| **Core API** (`server/`) | 9092 | Auth, Player, Campaign CRUD, Trade, Exchange, Buyback, Shipping, Withdrawal, Support, Coupon, Feed, Level, Banner, Announcement, Admin | Stable CRUD traffic |
| **Draw Service** (`draw-service/`) | 9093 | DrawCore, KujiDraw, UnlimitedDraw, Queue, Pity, TicketBox, Inventory, Leaderboard | Burst traffic on draw events, independent scaling |
| **Realtime Gateway** (`realtime-gateway/`) | 9094 | All WebSocket connections (kuji, queue, chat, feed, notifications) | Long-lived connections, different resource profile |
| **Notification Worker** (`notification-worker/`) | 9095 | OutboxWorker, LowStockNotificationJob, FCM/LINE/SMS delivery | Async, external dependency heavy |

### Shared Modules

| Module | Purpose |
|--------|---------|
| `db-schema/` | ALL Exposed table definitions — single source of truth. Any service that touches DB depends on this. |
| `shared/` | Shared Ktor plugins (HealthCheck, Monitoring), JwtVerifier (local JWT verification), CircuitBreakers (Resilience4j), EnvironmentConfig |
| `api-contracts/` | KMP shared DTOs, enums, endpoint constants across all platforms |

### Inter-Service Communication

- **Core API ↔ Draw Service**: HTTP with circuit breaker. Draw Service calls Core API for player profiles.
- **Realtime Gateway → Core API / Draw Service**: HTTP with circuit breaker for ban checks and draw state.
- **All services → Redis**: Pub/sub for event fanout to WebSocket clients.
- **All services → PostgreSQL**: Shared database (same connection, different connection pools).
- **JWT auth**: Every service verifies JWT tokens LOCALLY via `shared/JwtVerifier`. No HTTP call for auth.

### Transaction Boundaries (Critical)

Draw + point deduction + outbox event are in a SINGLE `newSuspendedTransaction`:
```
Draw Service transaction:
  1. Check player balance (shared DB)
  2. Deduct draw points (PointsLedgerService)
  3. Allocate prize / update inventory
  4. Create draw ticket record
  5. Write outbox event (shared DB)
  → All commit or all rollback atomically
```

### Backend Layer Pattern (per service)

Each service follows 4-layer hexagonal architecture:
```
api/          → Ktor routes, plugins, request/response mappers
application/  → Use cases (input ports), domain event handlers, services
domain/       → Entities, value objects, domain services (pure, no I/O)
infrastructure/ → Exposed ORM repositories, Redis client, external APIs
```

### Mobile (mobile/)

KMP + Compose Multiplatform targeting Android + iOS:
- MVI pattern: `State` / `Intent` / `Effect` per screen
- Shared `domain/` and `data/` layers in `mobile/shared/`
- Platform-specific: auth providers, push notification, biometrics in `androidMain/` / `iosMain/`

### Web / Admin (web/, admin/)

Next.js 14 App Router:
- KMP shared business logic compiled to JS/Wasm via `kmp-shared-js/`
- `next-intl` for i18n with `zh-TW` default locale
- WebSocket client connects to Realtime Gateway (:9094) for live draw board

## Commands

### Development

```bash
# Start full stack (all 4 backend services + Postgres + Redis + MinIO + web + admin + cs)
docker compose -f infra/docker/docker-compose.yml --env-file infra/docker/env/.env.dev up -d

# Build all backend services
./gradlew build -x test

# Build individual service
./gradlew :server:build -x test              # Core API
./gradlew :draw-service:build -x test        # Draw Service
./gradlew :realtime-gateway:build -x test    # Realtime Gateway
./gradlew :notification-worker:build -x test # Notification Worker

# Run all tests
./gradlew test

# Lint
./gradlew ktlintCheck
./gradlew detekt

# Web + Admin + CS
pnpm install
pnpm --filter web dev          # http://localhost:3000
pnpm --filter admin dev        # http://localhost:3001
pnpm --filter cs dev           # http://localhost:3002

# Database migrations (Flyway runs automatically on Core API startup)
./gradlew :server:flywayMigrate -Dflyway.url=jdbc:postgresql://localhost:5432/prizedraw \
  -Dflyway.user=prizedraw -Dflyway.password=prizedraw
```

### CI / Deploy (Forgejo)

```bash
# CI 自動觸發：
#   PR → server-ci.yml / web-ci.yml (lint + test + build)
#   Push staging → server-staging.yml / web-staging.yml (build + deploy to NAS)
#   Tag server-v* → server-production.yml (build + deploy to GCP with rollback)
#   Tag web-v* → web-production.yml (build + deploy to GCP)

# Build Docker images locally
docker build -f infra/docker/Dockerfile.core-api -t prizedraw/core-api .
docker build -f infra/docker/Dockerfile.draw-service -t prizedraw/draw-service .
docker build -f infra/docker/Dockerfile.realtime-gateway -t prizedraw/realtime-gateway .
docker build -f infra/docker/Dockerfile.notification-worker -t prizedraw/notification-worker .

# Deploy staging (push to staging branch triggers auto-deploy to NAS)
git push origin staging

# Deploy production (tag triggers auto-deploy to GCP with rollback)
git tag server-v1.0.0 && git push origin server-v1.0.0  # Backend
git tag web-v1.0.0 && git push origin web-v1.0.0        # Frontend

# Run load tests (requires k6)
k6 run --env BASE_URL=http://localhost:9092 infra/k6/load-test.js
```

## Environments

| Setting | dev | staging | prod |
|---------|-----|---------|------|
| Namespace | `prizedraw-dev` | `prizedraw-staging` | `prizedraw-prod` |
| Domain | `*.dev.prizedraw.tw` | `*.staging.prizedraw.tw` | `*.prizedraw.tw` |
| Core API replicas | 1 | 2 | 3 |
| Draw Service replicas | 1 | 2 | 3 |
| Realtime Gateway replicas | 1 | 2 | 3 |
| Notification Worker replicas | 1 | 1 | 2 |
| DB pool size | 5 | 10 | 20 |
| Log level | DEBUG | INFO | INFO |
| Rate limiting | disabled | relaxed | strict |
| PDB | none | none | minAvailable: 2 |

## gstack

This repo vendors gstack for Codex in `.agents/skills/gstack`.

- Use the `gstack-browse` skill for gstack-driven web browsing workflows when browser automation or screenshots are needed.
- Never use `mcp__claude-in-chrome__*` tools in this project.
- Available gstack skills: `gstack-office-hours`, `gstack-plan-ceo-review`, `gstack-plan-eng-review`, `gstack-plan-design-review`, `gstack-design-consultation`, `gstack-design-shotgun`, `gstack-review`, `gstack-ship`, `gstack-land-and-deploy`, `gstack-canary`, `gstack-benchmark`, `gstack-browse`, `gstack-connect-chrome`, `gstack-qa`, `gstack-qa-only`, `gstack-design-review`, `gstack-setup-browser-cookies`, `gstack-setup-deploy`, `gstack-retro`, `gstack-investigate`, `gstack-document-release`, `gstack-cso`, `gstack-autoplan`, `gstack-careful`, `gstack-freeze`, `gstack-guard`, `gstack-unfreeze`, `gstack-upgrade`.
- If gstack skills are missing or stale, run `cd .agents/skills/gstack && ./setup --host codex`.

## Microservice 開發與部署注意事項

### 本地開發

**啟動方式**
```bash
# 全部用 Docker（最簡單）
docker compose -f infra/docker/docker-compose.yml --env-file infra/docker/env/.env.dev up -d

# 混合模式：Docker 跑依賴服務，IDE debug 你正在改的服務
docker compose up postgres redis minio core-api realtime-gateway notification-worker
# 然後 IDE 跑 draw-service (port 9093)
```

**改了共用模組要全部重 build**
```bash
# 改了 db-schema/ 或 shared/ 或 api-contracts/ → 所有服務都要重新編譯
./gradlew build -x test
```

**跨服務 debug**
- 一個請求可能跨 Core API → Draw Service → Realtime Gateway
- 用 `traceId` 在 Grafana/Loki 追蹤完整請求鏈
- 本地看個別服務 log: `docker compose logs -f draw-service`

### 部署順序

| 情境 | 正確做法 |
|------|---------|
| DB migration | **先**部署 Core API（它跑 Flyway），確認成功**再**部署其他服務 |
| API contract 改變 | 先部署提供方（如 Draw Service），再部署呼叫方（如 Core API） |
| 全部一起部署 | 用 CI/CD pipeline（`gh workflow run deploy.yml`），它會自動處理 |
| 回滾單一服務 | `kubectl -n prizedraw-prod rollout undo deployment/prizedraw-draw-service` |

### 共用 DB 注意事項

所有 4 個服務共用一個 PostgreSQL。必須遵守：

1. **Migration 只能向後相容**（只加不刪）
2. **改 column type 或刪 column 需要分兩次部署**：
   - 第一次：加新 column + 雙寫（新舊 column 都寫入）
   - 確認所有服務都用新 column 後，第二次：刪舊 column
3. **Flyway migration 只由 Core API 執行**，其他服務連線時不跑 migration
4. **Table definitions** 統一在 `db-schema/` 模組，不要在個別服務裡定義 table

### 服務間通訊失敗處理

| 情境 | 影響 | 自動處理 |
|------|------|---------|
| Core API 掛了 | Draw Service 無法查詢玩家資料 → draw 暫時失敗 | Circuit breaker open 30s 後自動重試 |
| Draw Service 掛了 | 玩家無法抽獎，其他功能不受影響 | Ingress 回傳 503，前端顯示稍後再試 |
| Redis 掛了 | WebSocket 廣播中斷、快取失效 | draw 本身不受影響（DB transaction）|
| Notification Worker 掛了 | 推播延遲但不遺失 | outbox 事件等 worker 恢復後繼續處理 |

### PR 與程式碼變更原則

1. **一次 PR 只改一個服務的 API contract** — 先改 `api-contracts`，再改實作
2. **改了 `db-schema/` 要跑全部服務的 build** 確認沒有 break
3. **新增 Flyway migration 時**，確認 migration 向後相容（舊版服務仍能正常運作）
4. **跨服務的 HTTP 呼叫**一律要有 circuit breaker（用 `shared/resilience/CircuitBreakers`）
5. **Domain entities 在各服務是 COPY**（不是共用引用），改了一個服務的 entity 不影響其他服務

## Table Ownership

Every table has exactly one **owner** service that may write (INSERT/UPDATE/DELETE) to it. Other services may hold **read-only** access when documented below.

| Table | Owner | Read-Only Access | Notes |
|-------|-------|-----------------|-------|
| `players` | Core API | Draw Service (balance via PointsLedgerService) | Draw Service writes balance within transaction |
| `kuji_campaigns` | Core API | Draw Service, Notification Worker | Notification Worker reads for low-stock check |
| `unlimited_campaigns` | Core API | Draw Service, Notification Worker | Notification Worker reads for low-stock check |
| `draw_tickets` | Draw Service | Core API | |
| `ticket_boxes` | Draw Service | Core API | |
| `prize_definitions` | Core API | Draw Service | |
| `prize_instances` | Draw Service | Core API | |
| `queues` | Draw Service | Core API, Realtime Gateway | |
| `queue_entries` | Draw Service | Core API, Realtime Gateway | |
| `pity_rules` | Draw Service | | |
| `pity_prize_pool` | Draw Service | | |
| `pity_trackers` | Draw Service | | |
| `draw_sync_sessions` | Draw Service | Realtime Gateway | |
| `draw_point_transactions` | Draw Service | Core API | Written during draw transaction |
| `revenue_point_transactions` | Draw Service | Core API | Written during draw transaction |
| `outbox_events` | Draw Service | Notification Worker (claim + mark processed) | Notification Worker writes status via `FOR UPDATE SKIP LOCKED` |
| `trade_orders` | Core API | | |
| `exchange_requests` | Core API | | |
| `exchange_request_items` | Core API | | |
| `buyback_records` | Core API | | |
| `shipping_orders` | Core API | | |
| `payment_orders` | Core API | | |
| `withdrawal_requests` | Core API | | |
| `coupons` | Core API | | |
| `discount_codes` | Core API | | |
| `player_coupons` | Core API | | |
| `support_tickets` | Core API | | |
| `support_ticket_messages` | Core API | | |
| `audit_logs` | Core API | | |
| `refresh_token_families` | Core API | | |
| `feature_flags` | Core API | Draw Service, Realtime Gateway, Notification Worker | All services read flags |
| `staff` | Core API | | |
| `banners` | Core API | | |
| `server_announcements` | Core API | | |
| `follows` | Core API | Notification Worker | Notification Worker reads for fan-out |
| `campaign_favorites` | Core API | Notification Worker | Notification Worker reads for low-stock check |
| `player_devices` | Core API | Notification Worker | Notification Worker reads for push tokens |
| `xp_transactions` | Core API | | |
| `tier_configs` | Core API | | |
| `grade_templates` | Core API | | |
| `grade_template_items` | Core API | | |
| `campaign_grades` | Core API | | |
| `system_settings` | Core API | Draw Service, Realtime Gateway, Notification Worker | All services read settings |
| `notifications` | Notification Worker | Core API | |
| `room_instances` | Realtime Gateway | | |
| `campaign_viewer_stats` | Realtime Gateway | | |
| `chat_messages` | Realtime Gateway | Core API | |
| `broadcast_sessions` | Realtime Gateway | | |
| `feed_events` | Realtime Gateway | Core API | |

**Ownership Rules:**

1. Only the owner service may run DDL/migration on owned tables (all migrations executed by Core API Flyway)
2. Read-only services must not INSERT/UPDATE/DELETE on non-owned tables
3. Cross-service writes (like Draw Service writing to `players` balance, or Notification Worker claiming `outbox_events`) must be documented and reviewed
4. Future: migrate cross-service reads to HTTP API calls to enforce boundaries at the network level

## Code Style

- **Kotlin**: ktlint + detekt enforced in CI. Explicit API mode enabled on all KMP modules. KDoc required on all `public` declarations.
- **Web**: ESLint + Prettier. TypeScript strict mode.
- **Contracts first**: `api-contracts` is the canonical contract boundary. Update DTOs/enums/endpoint constants there before implementing server routes or client code.
- **Null safety**: No `!!` operator in production code. Use `?: error(...)` or `?: return` instead.
- **Coroutines**: All DB operations use `newSuspendedTransaction`. All external service calls are suspending. Never call `runBlocking` inside a request handler.

## Database Migrations

Flyway migrations live in `server/src/main/resources/db/migration/`.
Naming: `V{n}__{description}.sql` (sequential, never edit a committed migration).
**Only Core API runs Flyway** — other services connect without running migrations.

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
- JWT verification: Each service verifies tokens locally via `shared/JwtVerifier` — no inter-service HTTP call for auth.

## Observability

- **Metrics**: Each service exposes Micrometer → Prometheus scrape at `/metrics`. Per-service dashboards at `infra/monitoring/grafana/dashboards/`.
- **Alerts**: `infra/monitoring/prometheus/alert-rules.yml` — per-service error rates, circuit breaker states, payment failure rate, draw p99, WebSocket count, outbox lag, disk usage, Redis memory.
- **Logs**: Structured JSON via Logback per service. `traceId`, `playerId`, `campaignId` in MDC. Aggregated by Loki (`infra/monitoring/loki/loki-config.yml`).

## Performance Targets

| Operation | Target |
|-----------|--------|
| API p95 (general) | < 200ms |
| API p95 (draw endpoint) | < 500ms |
| Unlimited draw p95 | < 200ms |
| WebSocket broadcast | < 2s |
| DB connection acquisition | < 50ms |
| Inter-service HTTP p95 | < 100ms |
| Outbox processing lag | < 30s |

## E2E Testing

E2E tests use Playwright, located at `web/tests/e2e/`. Full scope documented in `web/tests/e2e/TEST_SCOPE.md`.

### Run

```bash
cd web && pnpm exec playwright test                    # 全部 E2E（含 cleanup + seed）
pnpm exec playwright test tests/e2e/journeys/35-role   # 單一 journey
SKIP_CLEANUP=true pnpm exec playwright test            # 跳過 DB 清除
```

### Data Isolation

每次執行前 `global-setup.ts` 會 TRUNCATE 所有 DB 表再重新 seed，確保測試間互不影響。

### Journey Tests (30-35: 活動生命週期)

| # | 名稱 | 驗證項目 |
|---|------|---------|
| 30 | Admin 建立活動 | 一番賞 + 無限賞建立 → 發布 → Player 前端看到 |
| 31 | 玩家遊玩 | 瀏覽 → 排隊 → 抽獎 → 點數扣除 |
| 32 | 多人排隊 | 2 玩家排隊 → 位置不同 → 輪流抽獎 |
| 33 | Admin 停售 | 停售 → Player 列表消失 → URL 直接訪問看到停售 |
| 34 | 活動完售 | 3 張票抽完 → 售罄狀態 → 其他玩家無法抽 |
| 35 | 角色權限 | CS=4 項 / Operator=10 項 / Admin=17 項 |

### Backend Tests

```bash
./gradlew test    # 265+ Kotlin tests (unit + integration, H2 in-memory)
```

## Recent Changes

- 001-ichiban-kuji-platform: Full Kotlin stack (Ktor + KMP + Compose Multiplatform + Next.js web)
- Phase 19: Polish & Cross-Cutting — i18n bundles, Redis cache layer, performance indexes (V014), security plugins, K8s manifests, observability, tests, load tests, GitHub Actions
- Microservice Architecture: Split monolith into 4 services (Core API, Draw Service, Realtime Gateway, Notification Worker) + multi-environment infrastructure (dev/staging/prod) with Kustomize
