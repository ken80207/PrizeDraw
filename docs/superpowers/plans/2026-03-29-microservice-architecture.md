# Microservice Architecture + Multi-Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the PrizeDraw monolith into a strategic microservice architecture with proper multi-environment (dev/staging/prod) infrastructure, while preserving all existing functionality.

**Architecture:** Split the monolith into 4 services (Core API, Draw Service, Realtime Gateway, Notification Worker) + reserve boundary for future Payment Service. Use Kustomize for K8s environment overlays. Internal communication via HTTP with circuit breakers. Shared PostgreSQL for now (per-service DB later). Each service is independently deployable.

**Tech Stack:** Kotlin/Ktor 3.x, Kustomize, Docker Compose, GitHub Actions, Redis Sentinel, PostgreSQL with Patroni-ready config, Resilience4j for circuit breakers.

---

## Service Decomposition Map

```
┌─────────────────────────────────────────────────────────┐
│                  Ingress (per environment)               │
└────┬──────────────┬────────────────┬────────────────────┘
     │              │                │
┌────▼────┐   ┌─────▼──────┐  ┌─────▼──────┐
│Core API │   │Draw Service│  │ Realtime   │
│(Ktor)   │   │(Ktor)      │  │ Gateway    │
│         │   │            │  │ (Ktor WS)  │
│Auth     │   │DrawCore    │  │ WebSocket  │
│Player   │   │Queue       │  │ connections│
│Admin    │   │Pity        │  │            │
│Campaign │   │Inventory   │  │            │
│Trade    │   │Leaderboard │  │            │
│Exchange │   │            │  │            │
│Shipping │   │            │  │            │
│Support  │   │            │  │            │
│Coupon   │   │            │  │            │
│Feed     │   │            │  │            │
│Level    │   │            │  │            │
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
   │  Worker         │
   │  (Outbox)       │
   └─────────────────┘
```

### Service Boundaries

| Service | Owns | Reason for split |
|---------|------|------------------|
| **Core API** | Auth, Player, Campaign CRUD, Trade, Exchange, Buyback, Shipping, Withdrawal, Support, Coupon, Feed, Level, Banner, Announcement, Admin | Stable CRUD traffic, single deployment unit for most features |
| **Draw Service** | DrawCore, KujiDraw, UnlimitedDraw, Queue, Pity, TicketBox, Inventory, Leaderboard | Burst traffic on draw events, needs independent scaling |
| **Realtime Gateway** | All WebSocket connections (kuji, queue, chat, feed, notifications) | Long-lived connections, completely different resource profile from HTTP |
| **Notification Worker** | OutboxWorker, LowStockNotificationJob, push/LINE delivery | Async, external dependency heavy, must not block sync requests |

### What stays together (intentionally NOT split)

- **PointsLedgerService** — extracted into `shared/` module as a library dependency. Both Core API and Draw Service embed it but there is exactly one source of truth for the logic. This preserves the CLAUDE.md invariant: "Never update balances directly."
- **Payment (future)** — will be a separate service when 金流管理 is built, not part of this migration
- **Trade/Exchange** stays in Core API — insufficient traffic to justify separation

### Transaction Boundary Design (Critical)

The draw flow touches: player balance, draw ticket, ticket box inventory, prize instance, queue state, outbox event, and leaderboard. In the monolith these are a single DB transaction. Post-extraction:

```
Draw Service (single DB transaction):
┌──────────────────────────────────────────────────┐
│ newSuspendedTransaction {                         │
│   1. Check player balance (shared DB, players)    │
│   2. Deduct draw points (PointsLedgerService)     │
│   3. Allocate prize / update inventory            │
│   4. Create draw ticket record                    │
│   5. Update queue state (if kuji)                 │
│   6. Write outbox event (shared DB, outbox_events)│
│   7. Update leaderboard cache                     │
│ }                                                 │
└──────────────────────────────────────────────────┘
```

**Key decisions:**
- Draw Service writes directly to the shared PostgreSQL — `PointsLedgerService` from `shared/` module handles balance with optimistic locking
- Outbox events are written in the SAME transaction as the draw result (not via HTTP to Core API)
- Notification Worker polls `outbox_events` from the shared DB independently
- This preserves the exact same atomicity guarantees as the monolith

### Rollback Plan

Each extraction phase is independently revertable:
- **Before each extraction:** Tag the last-known-good monolith state (`git tag monolith-pre-{service}-extraction`)
- **Keep monolith Docker image** tagged and deployable for 2 weeks after each extraction
- **Flyway migrations** must be backward-compatible (additive only) so the monolith can still run against the same DB
- **Rollback procedure:** Revert ingress routing to monolith service, scale down extracted service, scale up monolith

---

## File Structure

### New top-level project structure

```
PrizeDraw/
├── build.gradle.kts                     # Root build (existing, updated)
├── settings.gradle.kts                  # Add new subprojects
├── api-contracts/                       # (existing, unchanged)
├── kmp-shared-js/                       # (existing, unchanged)
├── kmp-game-shared/                     # (existing, unchanged)
├── mobile/                              # (existing, unchanged)
│
├── db-schema/                           # NEW: shared Exposed table definitions
│   ├── build.gradle.kts
│   └── src/main/kotlin/com/prizedraw/schema/
│       ├── tables/                      # ALL Exposed DSL table definitions (single source of truth)
│       │   ├── PlayersTable.kt
│       │   ├── CampaignsTable.kt
│       │   ├── PrizesTable.kt
│       │   ├── DrawTicketsTable.kt
│       │   ├── ... (all 28 table files)
│       │   └── OutboxTable.kt
│       └── entities/                    # Shared domain entities used across services
│           ├── Player.kt
│           ├── PrizeDefinition.kt
│           ├── PrizeInstance.kt
│           ├── DrawTicket.kt
│           └── OutboxEvent.kt
│
├── shared/                              # NEW: shared server libraries
│   ├── build.gradle.kts
│   └── src/main/kotlin/com/prizedraw/shared/
│       ├── config/
│       │   └── EnvironmentConfig.kt     # Environment-aware configuration
│       ├── plugins/
│       │   ├── Serialization.kt         # Shared Ktor plugins
│       │   ├── Monitoring.kt
│       │   ├── StatusPages.kt
│       │   ├── SecurityHeaders.kt
│       │   ├── InputSanitization.kt
│       │   └── HealthCheck.kt           # Shared /health + /ready
│       ├── auth/
│       │   └── JwtVerifier.kt           # Shared JWT verification (local, no HTTP call)
│       ├── ledger/
│       │   └── PointsLedgerService.kt   # Shared points ledger logic (single source of truth)
│       ├── resilience/
│       │   └── CircuitBreakers.kt       # Resilience4j wrappers
│       └── client/
│           ├── DrawServiceClient.kt     # Typed HTTP client for Draw Service
│           └── ServiceDiscovery.kt      # K8s service DNS resolution
│
├── server/                              # RENAMED ROLE: becomes Core API
│   ├── build.gradle.kts                 # Updated: depends on :shared
│   └── src/main/kotlin/com/prizedraw/
│       ├── Application.kt              # Updated: remove draw/ws/notification code
│       ├── api/
│       │   ├── plugins/
│       │   │   └── Routing.kt          # Updated: remove draw/ws routes
│       │   └── routes/                  # Kept: all non-draw, non-ws routes
│       ├── application/                 # Kept: all non-draw use cases
│       ├── domain/                      # Kept: full domain (shared via DB)
│       └── infrastructure/              # Kept: all repos (shared DB)
│
├── draw-service/                        # NEW: independent draw service
│   ├── build.gradle.kts
│   ├── src/main/kotlin/com/prizedraw/draw/
│   │   ├── Application.kt
│   │   ├── api/
│   │   │   ├── plugins/
│   │   │   │   └── Routing.kt
│   │   │   └── routes/
│   │   │       ├── DrawRoutes.kt
│   │   │       ├── LeaderboardRoutes.kt
│   │   │       └── LiveDrawRoutes.kt
│   │   ├── application/
│   │   │   ├── usecases/               # Draw, Queue, Pity use cases
│   │   │   └── services/
│   │   │       ├── DrawSyncService.kt
│   │   │       └── KujiQueueService.kt
│   │   ├── domain/                      # Draw-specific domain (reuses entities via shared DB)
│   │   │   └── services/
│   │   │       ├── DrawCore.kt
│   │   │       ├── KujiDrawDomainService.kt
│   │   │       ├── UnlimitedDrawDomainService.kt
│   │   │       └── PityDomainService.kt
│   │   └── infrastructure/
│   │       ├── di/
│   │       ├── persistence/             # Draw-related repos (uses db-schema tables)
│   │       └── client/
│   │           └── CoreApiClient.kt     # HTTP calls to Core API (player profile, campaign metadata)
│   └── src/test/
│
├── realtime-gateway/                    # NEW: WebSocket service
│   ├── build.gradle.kts
│   ├── src/main/kotlin/com/prizedraw/realtime/
│   │   ├── Application.kt
│   │   ├── api/
│   │   │   └── plugins/
│   │   │       └── Routing.kt
│   │   ├── handlers/
│   │   │   ├── KujiWebSocketHandler.kt
│   │   │   ├── QueueWebSocketHandler.kt
│   │   │   ├── ChatWebSocketHandler.kt
│   │   │   ├── FeedWebSocketHandler.kt
│   │   │   └── PlayerNotificationHandler.kt
│   │   ├── connection/
│   │   │   └── ConnectionManager.kt
│   │   └── infrastructure/
│   │       ├── di/
│   │       ├── redis/
│   │       │   └── RedisPubSub.kt       # Subscribe to events from other services
│   │       └── client/
│   │           ├── CoreApiClient.kt      # Only for live DB checks (ban status), NOT auth
│   │           └── DrawServiceClient.kt
│   └── src/test/
│
├── notification-worker/                 # NEW: async notification processor
│   ├── build.gradle.kts
│   ├── src/main/kotlin/com/prizedraw/notification/
│   │   ├── Application.kt              # Minimal Ktor server (health/metrics only) + coroutine workers
│   │   ├── worker/
│   │   │   ├── OutboxWorker.kt
│   │   │   └── LowStockNotificationJob.kt
│   │   └── infrastructure/
│   │       ├── di/
│   │       ├── persistence/
│   │       │   ├── OutboxRepositoryImpl.kt
│   │       │   └── NotificationRepositoryImpl.kt
│   │       └── external/
│   │           ├── push/                # FCM
│   │           ├── line/                # LINE messaging
│   │           └── sms/                 # Twilio
│   └── src/test/
│
├── infra/
│   ├── ci/
│   │   ├── build-server.yml            # Updated: build all 4 services
│   │   ├── build-web.yml               # (unchanged)
│   │   └── deploy.yml                  # Updated: deploy per service, per environment
│   ├── docker/
│   │   ├── Dockerfile.core-api         # Renamed from Dockerfile.server
│   │   ├── Dockerfile.draw-service     # NEW
│   │   ├── Dockerfile.realtime-gateway # NEW
│   │   ├── Dockerfile.notification-worker # NEW
│   │   ├── Dockerfile.web              # (unchanged)
│   │   ├── Dockerfile.admin            # (unchanged)
│   │   ├── Dockerfile.cs               # (unchanged)
│   │   ├── docker-compose.yml          # Updated: all services
│   │   ├── docker-compose.test.yml     # Updated: test containers
│   │   ├── .env.example                # Updated: all service ports
│   │   └── env/                        # NEW: per-environment env files
│   │       ├── .env.dev
│   │       ├── .env.staging
│   │       └── .env.prod.example       # Template only — .env.prod is gitignored
│   ├── k8s/
│   │   ├── base/                       # NEW: Kustomize base
│   │   │   ├── kustomization.yaml
│   │   │   ├── namespace.yaml
│   │   │   ├── core-api/
│   │   │   │   ├── deployment.yml
│   │   │   │   ├── service.yml
│   │   │   │   └── hpa.yml
│   │   │   ├── draw-service/
│   │   │   │   ├── deployment.yml
│   │   │   │   ├── service.yml
│   │   │   │   └── hpa.yml
│   │   │   ├── realtime-gateway/
│   │   │   │   ├── deployment.yml
│   │   │   │   ├── service.yml
│   │   │   │   └── hpa.yml
│   │   │   ├── notification-worker/
│   │   │   │   ├── deployment.yml
│   │   │   │   └── hpa.yml             # No service (no inbound traffic)
│   │   │   ├── postgres/
│   │   │   │   └── statefulset.yml
│   │   │   ├── redis/
│   │   │   │   └── statefulset.yml
│   │   │   └── ingress/
│   │   │       └── ingress.yml
│   │   └── overlays/                   # NEW: per-environment overrides
│   │       ├── dev/
│   │       │   ├── kustomization.yaml
│   │       │   ├── namespace.yaml
│   │       │   ├── configmap-patch.yaml
│   │       │   ├── replica-patch.yaml
│   │       │   └── ingress-patch.yaml
│   │       ├── staging/
│   │       │   ├── kustomization.yaml
│   │       │   ├── namespace.yaml
│   │       │   ├── configmap-patch.yaml
│   │       │   ├── replica-patch.yaml
│   │       │   └── ingress-patch.yaml
│   │       └── prod/
│   │           ├── kustomization.yaml
│   │           ├── namespace.yaml
│   │           ├── configmap-patch.yaml
│   │           ├── replica-patch.yaml
│   │           ├── ingress-patch.yaml
│   │           └── pdb.yaml            # PodDisruptionBudget (prod only)
│   └── monitoring/                     # (existing, updated for multi-service)
└── specs/                              # (existing, unchanged)
```

---

## Environment Configuration

| Setting | dev | staging | prod |
|---------|-----|---------|------|
| Namespace | `prizedraw-dev` | `prizedraw-staging` | `prizedraw-prod` |
| Domain | `*.dev.prizedraw.tw` | `*.staging.prizedraw.tw` | `*.prizedraw.tw` |
| Core API replicas | 1 | 2 | 3 |
| Draw Service replicas | 1 | 2 | 3 |
| Realtime Gateway replicas | 1 | 2 | 3 |
| Notification Worker replicas | 1 | 1 | 2 |
| DB pool size | 5 | 10 | 20 |
| Redis maxmemory | 256mb | 512mb | 1gb |
| Log level | DEBUG | INFO | INFO |
| Rate limiting | disabled | relaxed | strict |
| TLS | Let's Encrypt staging | Let's Encrypt staging | Let's Encrypt prod |
| HPA | disabled | enabled (conservative) | enabled (aggressive) |
| PDB | none | none | minAvailable: 2 |

---

## Task Breakdown

### Phase 1: Multi-Environment Infrastructure (Kustomize + Docker Compose)

### Task 1: Create shared modules scaffold (shared + db-schema)

**Files:**
- Create: `shared/build.gradle.kts`
- Create: `db-schema/build.gradle.kts`
- Modify: `settings.gradle.kts`

- [ ] **Step 1: Add shared and db-schema modules to settings.gradle.kts**

Read current `settings.gradle.kts` and add `:shared` and `:db-schema` to the include list.

- [ ] **Step 2: Create shared/build.gradle.kts**

```kotlin
plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
}

dependencies {
    api(libs.ktor.server.core)
    api(libs.ktor.server.content.negotiation)
    api(libs.ktor.serialization.kotlinx.json)
    api(libs.ktor.server.metrics.micrometer)
    api(libs.micrometer.registry.prometheus)
    api(libs.ktor.server.status.pages)
    api(libs.ktor.server.call.logging)
    api(libs.ktor.client.core)
    api(libs.ktor.client.cio)
    api(libs.ktor.client.content.negotiation)
    api(libs.logback.classic)
    implementation(libs.resilience4j.circuitbreaker)
    implementation(libs.resilience4j.kotlin)
}
```

- [ ] **Step 3: Create EnvironmentConfig.kt**

```kotlin
// shared/src/main/kotlin/com/prizedraw/shared/config/EnvironmentConfig.kt
package com.prizedraw.shared.config

enum class Environment { DEV, STAGING, PROD }

object EnvironmentConfig {
    val current: Environment by lazy {
        when (System.getenv("APP_ENV")?.uppercase()) {
            "STAGING" -> Environment.STAGING
            "PROD", "PRODUCTION" -> Environment.PROD
            else -> Environment.DEV
        }
    }

    val isDev get() = current == Environment.DEV
    val isStaging get() = current == Environment.STAGING
    val isProd get() = current == Environment.PROD
}
```

- [ ] **Step 4: Create shared HealthCheck plugin**

```kotlin
// shared/src/main/kotlin/com/prizedraw/shared/plugins/HealthCheck.kt
package com.prizedraw.shared.plugins

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

@Serializable
data class HealthResponse(
    val status: String,
    val service: String,
    val environment: String,
    val version: String = System.getenv("APP_VERSION") ?: "unknown",
)

fun Application.configureHealthCheck(serviceName: String) {
    routing {
        get("/health") {
            call.respond(
                HealthResponse(
                    status = "UP",
                    service = serviceName,
                    environment = System.getenv("APP_ENV") ?: "dev",
                )
            )
        }
        get("/ready") {
            // Subclasses override readiness logic
            call.respond(HttpStatusCode.OK, mapOf("status" to "READY"))
        }
    }
}
```

- [ ] **Step 5: Create db-schema/build.gradle.kts**

```kotlin
plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
}

dependencies {
    api(libs.exposed.core)
    api(libs.exposed.dao)
    api(libs.exposed.jdbc)
    api(libs.exposed.kotlin.datetime)
    api(libs.kotlinx.serialization.json)
}
```

This module holds ALL Exposed table definitions and shared entity classes. Any service that needs DB access depends on `:db-schema`. Schema changes happen in one place, preventing drift.

- [ ] **Step 6: Create shared PointsLedgerService in shared module**

Move `PointsLedgerService.kt` from `server/application/services/` to `shared/src/main/kotlin/com/prizedraw/shared/ledger/`. This is the single source of truth for all point mutations. Both Core API and Draw Service depend on `:shared` and use this same class.

- [ ] **Step 7: Create CircuitBreakers.kt**

```kotlin
// shared/src/main/kotlin/com/prizedraw/shared/resilience/CircuitBreakers.kt
package com.prizedraw.shared.resilience

import io.github.resilience4j.circuitbreaker.CircuitBreaker
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig
import java.time.Duration

object CircuitBreakers {
    fun create(name: String, config: CircuitBreakerConfig = defaultConfig()): CircuitBreaker =
        CircuitBreaker.of(name, config)

    private fun defaultConfig() = CircuitBreakerConfig.custom()
        .failureRateThreshold(50f)
        .waitDurationInOpenState(Duration.ofSeconds(30))
        .slidingWindowSize(10)
        .minimumNumberOfCalls(5)
        .build()

    fun serviceConfig() = CircuitBreakerConfig.custom()
        .failureRateThreshold(30f)
        .waitDurationInOpenState(Duration.ofSeconds(15))
        .slidingWindowSize(20)
        .minimumNumberOfCalls(10)
        .build()
}
```

- [ ] **Step 8: Verify both shared modules compile**

Run: `./gradlew :shared:build :db-schema:build -x test`
Expected: BUILD SUCCESSFUL

- [ ] **Step 9: Commit**

```bash
git add shared/ db-schema/ settings.gradle.kts
git commit -m "feat: add shared and db-schema modules with health check, env config, circuit breakers, points ledger, table definitions"
```

---

### Task 2: Kustomize base manifests

**Files:**
- Create: `infra/k8s/base/kustomization.yaml`
- Create: `infra/k8s/base/namespace.yaml`
- Create: `infra/k8s/base/core-api/deployment.yml`
- Create: `infra/k8s/base/core-api/service.yml`
- Create: `infra/k8s/base/core-api/hpa.yml`
- Create: `infra/k8s/base/draw-service/deployment.yml`
- Create: `infra/k8s/base/draw-service/service.yml`
- Create: `infra/k8s/base/draw-service/hpa.yml`
- Create: `infra/k8s/base/realtime-gateway/deployment.yml`
- Create: `infra/k8s/base/realtime-gateway/service.yml`
- Create: `infra/k8s/base/realtime-gateway/hpa.yml`
- Create: `infra/k8s/base/notification-worker/deployment.yml`
- Create: `infra/k8s/base/notification-worker/hpa.yml`
- Create: `infra/k8s/base/postgres/statefulset.yml` (copy from existing)
- Create: `infra/k8s/base/redis/statefulset.yml` (copy from existing)
- Create: `infra/k8s/base/ingress/ingress.yml`

- [ ] **Step 1: Create base kustomization.yaml**

```yaml
# infra/k8s/base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - namespace.yaml
  - core-api/deployment.yml
  - core-api/service.yml
  - core-api/configmap.yml
  - core-api/hpa.yml
  - draw-service/deployment.yml
  - draw-service/service.yml
  - draw-service/configmap.yml
  - draw-service/hpa.yml
  - realtime-gateway/deployment.yml
  - realtime-gateway/service.yml
  - realtime-gateway/configmap.yml
  - realtime-gateway/hpa.yml
  - notification-worker/deployment.yml
  - notification-worker/configmap.yml
  - notification-worker/hpa.yml
  - postgres/statefulset.yml
  - redis/statefulset.yml
  - ingress/ingress.yml

commonLabels:
  app.kubernetes.io/part-of: prizedraw
```

- [ ] **Step 1b: Create base ConfigMaps for each service**

Each service gets a base ConfigMap with shared defaults. Overlays patch these per environment.

```yaml
# infra/k8s/base/core-api/configmap.yml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prizedraw-core-api-config
data:
  PORT: "9092"
  APP_ENV: "dev"
  LOG_LEVEL: "INFO"
  JWT_ISSUER: "prizedraw"
  JWT_AUDIENCE: "prizedraw-api"
  DATABASE_POOL_SIZE: "10"
  RATE_LIMIT_ENABLED: "true"
  DRAW_SERVICE_URL: "http://prizedraw-draw-service:80"
  REALTIME_GATEWAY_URL: "http://prizedraw-realtime-gateway:80"
```

Similar ConfigMaps for draw-service (port 9093), realtime-gateway (port 9094), notification-worker (port 9095, OUTBOX_POLL_INTERVAL_MS).

- [ ] **Step 2: Create namespace.yaml**

```yaml
# infra/k8s/base/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: prizedraw
  labels:
    app.kubernetes.io/part-of: prizedraw
```

- [ ] **Step 3: Create core-api deployment.yml**

Adapt from existing `infra/k8s/server/deployment.yml`:
- Rename `prizeDraw-server` → `prizedraw-core-api`
- Add `APP_ENV` env var
- Add label `app.kubernetes.io/component: core-api`
- Change image to `ghcr.io/prizedraw/core-api:latest`
- Add env: `DRAW_SERVICE_URL: http://prizedraw-draw-service:80`
- Add env: `REALTIME_GATEWAY_URL: http://prizedraw-realtime-gateway:80`

- [ ] **Step 4: Create core-api service.yml and hpa.yml**

Copy from existing `infra/k8s/server/service.yml` and `hpa.yml`, update names and selectors.

- [ ] **Step 5: Create draw-service deployment.yml**

Similar to core-api but:
- Name: `prizedraw-draw-service`
- Image: `ghcr.io/prizedraw/draw-service:latest`
- Port: 9093
- Higher CPU limits (burst traffic): requests 500m, limits 2000m
- Env: `CORE_API_URL: http://prizedraw-core-api:80`
- Label: `app.kubernetes.io/component: draw-service`

- [ ] **Step 6: Create draw-service service.yml and hpa.yml**

HPA: min 2, max 20, CPU target 60% (more aggressive scaling for draw bursts).

- [ ] **Step 7: Create realtime-gateway deployment.yml**

- Name: `prizedraw-realtime-gateway`
- Image: `ghcr.io/prizedraw/realtime-gateway:latest`
- Port: 9094
- Higher memory (long-lived connections): requests 512Mi, limits 2Gi
- Session affinity: ClientIP (for WebSocket sticky sessions)
- Env: `CORE_API_URL`, `DRAW_SERVICE_URL`
- Label: `app.kubernetes.io/component: realtime-gateway`

- [ ] **Step 8: Create realtime-gateway service.yml and hpa.yml**

HPA: min 2, max 15, CPU target 60% initially. Custom metric `websocket_active_connections` (avg 1000/pod) added as follow-up after Prometheus Adapter is deployed.
Service: session affinity ClientIP with 3600s timeout.

- [ ] **Step 9: Create notification-worker deployment.yml**

- Name: `prizedraw-notification-worker`
- Image: `ghcr.io/prizedraw/notification-worker:latest`
- Port: 9095 (minimal Ktor server for `/health` and `/metrics` only)
- Lower resources: requests 100m CPU / 256Mi, limits 500m CPU / 512Mi
- Label: `app.kubernetes.io/component: notification-worker`

- [ ] **Step 10: Create notification-worker hpa.yml**

HPA: min 1, max 3, CPU target 70%.

- [ ] **Step 11: Move postgres and redis statefulsets to base**

Copy existing files from `infra/k8s/postgres/` and `infra/k8s/redis/` to `infra/k8s/base/postgres/` and `infra/k8s/base/redis/`.

- [ ] **Step 12: Create base ingress.yml**

Update existing ingress to route to multiple services:
```yaml
rules:
  - host: api.prizedraw.tw
    http:
      paths:
        # Core API routes
        - path: /api/v1/auth
          pathType: Prefix
          backend:
            service:
              name: prizedraw-core-api
              port: { name: http }
        - path: /api/v1/players
          pathType: Prefix
          backend:
            service:
              name: prizedraw-core-api
              port: { name: http }
        - path: /api/v1/campaigns
          pathType: Prefix
          backend:
            service:
              name: prizedraw-core-api
              port: { name: http }
        # ... all other CRUD routes → core-api

        # Draw Service routes
        - path: /api/v1/draws
          pathType: Prefix
          backend:
            service:
              name: prizedraw-draw-service
              port: { name: http }
        - path: /api/v1/leaderboards
          pathType: Prefix
          backend:
            service:
              name: prizedraw-draw-service
              port: { name: http }
        - path: /api/v1/live-draws
          pathType: Prefix
          backend:
            service:
              name: prizedraw-draw-service
              port: { name: http }

        # Realtime Gateway routes
        - path: /ws
          pathType: Prefix
          backend:
            service:
              name: prizedraw-realtime-gateway
              port: { name: http }

        # Health endpoints (each service has its own)
        - path: /health
          pathType: Exact
          backend:
            service:
              name: prizedraw-core-api
              port: { name: http }
        - path: /metrics
          pathType: Exact
          backend:
            service:
              name: prizedraw-core-api
              port: { name: http }
```

- [ ] **Step 13: Verify kustomize build**

Run: `kubectl kustomize infra/k8s/base/`
Expected: valid YAML output with all resources

- [ ] **Step 14: Commit**

```bash
git add infra/k8s/base/
git commit -m "feat: add Kustomize base manifests for 4-service architecture"
```

---

### Task 3: Kustomize environment overlays

**Files:**
- Create: `infra/k8s/overlays/dev/kustomization.yaml`
- Create: `infra/k8s/overlays/dev/namespace.yaml`
- Create: `infra/k8s/overlays/dev/configmap-patch.yaml`
- Create: `infra/k8s/overlays/dev/replica-patch.yaml`
- Create: `infra/k8s/overlays/dev/ingress-patch.yaml`
- Create: `infra/k8s/overlays/staging/` (same structure)
- Create: `infra/k8s/overlays/prod/` (same structure + pdb.yaml)

- [ ] **Step 1: Create dev overlay**

```yaml
# infra/k8s/overlays/dev/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base

namespace: prizedraw-dev
# NOTE: No namePrefix — namespace isolation is sufficient.
# namePrefix would break inter-service DNS references
# (e.g., DRAW_SERVICE_URL: http://prizedraw-draw-service:80)

patches:
  - path: replica-patch.yaml
  - path: configmap-patch.yaml
  - path: ingress-patch.yaml

commonLabels:
  environment: dev
```

```yaml
# infra/k8s/overlays/dev/replica-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prizedraw-core-api
spec:
  replicas: 1
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prizedraw-draw-service
spec:
  replicas: 1
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prizedraw-realtime-gateway
spec:
  replicas: 1
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prizedraw-notification-worker
spec:
  replicas: 1
```

```yaml
# infra/k8s/overlays/dev/configmap-patch.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prizedraw-core-api-config
data:
  APP_ENV: "dev"
  LOG_LEVEL: "DEBUG"
  DATABASE_POOL_SIZE: "5"
  RATE_LIMIT_ENABLED: "false"
  CORS_ALLOWED_HOSTS: "*"
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: prizedraw-draw-service-config
data:
  APP_ENV: "dev"
  LOG_LEVEL: "DEBUG"
  DATABASE_POOL_SIZE: "5"
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: prizedraw-realtime-gateway-config
data:
  APP_ENV: "dev"
  LOG_LEVEL: "DEBUG"
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: prizedraw-notification-worker-config
data:
  APP_ENV: "dev"
  LOG_LEVEL: "DEBUG"
  OUTBOX_POLL_INTERVAL_MS: "5000"
```

```yaml
# infra/k8s/overlays/dev/ingress-patch.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: prizedraw-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-staging
spec:
  tls:
    - hosts:
        - api.dev.prizedraw.tw
        - dev.prizedraw.tw
        - admin.dev.prizedraw.tw
        - cs.dev.prizedraw.tw
      secretName: prizedraw-dev-tls-cert
  rules:
    - host: api.dev.prizedraw.tw
    - host: dev.prizedraw.tw
    - host: admin.dev.prizedraw.tw
    - host: cs.dev.prizedraw.tw
```

- [ ] **Step 2: Create staging overlay**

Same structure as dev but:
- `namespace: prizedraw-staging`
- No namePrefix (namespace isolation only)
- Replicas: core-api 2, draw 2, realtime 2, notification 1
- `DATABASE_POOL_SIZE: "10"`
- `LOG_LEVEL: "INFO"`
- `RATE_LIMIT_ENABLED: "true"` (relaxed)
- Hosts: `*.staging.prizedraw.tw`
- cert-manager: letsencrypt-staging

- [ ] **Step 3: Create prod overlay**

Same structure but:
- `namespace: prizedraw-prod`
- No namePrefix (namespace isolation only)
- Replicas: core-api 3, draw 3, realtime 3, notification 2
- `DATABASE_POOL_SIZE: "20"`
- `LOG_LEVEL: "INFO"`
- `RATE_LIMIT_ENABLED: "true"` (strict)
- Hosts: `*.prizedraw.tw`
- cert-manager: letsencrypt-prod
- Additional PDB:

```yaml
# infra/k8s/overlays/prod/pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: prizedraw-core-api-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app.kubernetes.io/component: core-api
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: prizedraw-draw-service-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app.kubernetes.io/component: draw-service
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: prizedraw-realtime-gateway-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app.kubernetes.io/component: realtime-gateway
```

- [ ] **Step 4: Verify all overlays build**

Run:
```bash
kubectl kustomize infra/k8s/overlays/dev/
kubectl kustomize infra/k8s/overlays/staging/
kubectl kustomize infra/k8s/overlays/prod/
```
Expected: valid YAML for each environment

- [ ] **Step 5: Commit**

```bash
git add infra/k8s/overlays/
git commit -m "feat: add Kustomize overlays for dev, staging, and prod environments"
```

---

### Task 4: Docker Compose multi-environment setup

**Files:**
- Create: `infra/docker/env/.env.dev`
- Create: `infra/docker/env/.env.staging`
- Create: `infra/docker/env/.env.prod`
- Modify: `infra/docker/docker-compose.yml`
- Create: `infra/docker/Dockerfile.core-api`
- Create: `infra/docker/Dockerfile.draw-service`
- Create: `infra/docker/Dockerfile.realtime-gateway`
- Create: `infra/docker/Dockerfile.notification-worker`

- [ ] **Step 1: Create per-environment env files**

```bash
# infra/docker/env/.env.dev
APP_ENV=dev
POSTGRES_DB=prizedraw_dev
POSTGRES_USER=prizedraw
POSTGRES_PASSWORD=devpassword
REDIS_PASSWORD=devredis
JWT_SECRET=dev-secret-not-for-production-256-bit
CORE_API_PORT=9092
DRAW_SERVICE_PORT=9093
REALTIME_GATEWAY_PORT=9094
LOG_LEVEL=DEBUG
RATE_LIMIT_ENABLED=false
```

```bash
# infra/docker/env/.env.staging
APP_ENV=staging
POSTGRES_DB=prizedraw_staging
POSTGRES_USER=prizedraw
POSTGRES_PASSWORD=change-me
REDIS_PASSWORD=change-me
JWT_SECRET=change-me
CORE_API_PORT=9092
DRAW_SERVICE_PORT=9093
REALTIME_GATEWAY_PORT=9094
LOG_LEVEL=INFO
RATE_LIMIT_ENABLED=true
```

```bash
# infra/docker/env/.env.prod.example  (template only — .env.prod is gitignored)
APP_ENV=prod
POSTGRES_DB=prizedraw
POSTGRES_USER=prizedraw
POSTGRES_PASSWORD=REPLACE_WITH_VAULT_SECRET
REDIS_PASSWORD=REPLACE_WITH_VAULT_SECRET
JWT_SECRET=REPLACE_WITH_VAULT_SECRET
CORE_API_PORT=9092
DRAW_SERVICE_PORT=9093
REALTIME_GATEWAY_PORT=9094
LOG_LEVEL=INFO
RATE_LIMIT_ENABLED=true
```

Add to `.gitignore`:
```
infra/docker/env/.env.prod
```

- [ ] **Step 2: Update docker-compose.yml for multi-service**

Update the compose file to include all 4 backend services instead of one `server`. Each service gets its own container with appropriate port and env vars. Add inter-service dependency and networking.

```yaml
services:
  postgres:
    # (unchanged)

  redis:
    # (unchanged)

  minio:
    # (unchanged)

  core-api:
    build:
      context: ../..
      dockerfile: infra/docker/Dockerfile.core-api
    container_name: prizedraw-core-api
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    environment:
      APP_ENV: ${APP_ENV:-dev}
      PORT: 9092
      DATABASE_URL: jdbc:postgresql://postgres:5432/${POSTGRES_DB:-prizedraw}
      DATABASE_USER: ${POSTGRES_USER:-prizedraw}
      DATABASE_PASSWORD: ${POSTGRES_PASSWORD:-prizedraw}
      REDIS_URL: redis://:${REDIS_PASSWORD:-redispassword}@redis:6379
      DRAW_SERVICE_URL: http://draw-service:9093
      # ... rest of env vars
    ports:
      - "${CORE_API_PORT:-9092}:9092"

  draw-service:
    build:
      context: ../..
      dockerfile: infra/docker/Dockerfile.draw-service
    container_name: prizedraw-draw-service
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    environment:
      APP_ENV: ${APP_ENV:-dev}
      PORT: 9093
      DATABASE_URL: jdbc:postgresql://postgres:5432/${POSTGRES_DB:-prizedraw}
      CORE_API_URL: http://core-api:9092
      # ... rest of env vars
    ports:
      - "${DRAW_SERVICE_PORT:-9093}:9093"

  realtime-gateway:
    build:
      context: ../..
      dockerfile: infra/docker/Dockerfile.realtime-gateway
    container_name: prizedraw-realtime-gateway
    depends_on:
      redis: { condition: service_healthy }
    environment:
      APP_ENV: ${APP_ENV:-dev}
      PORT: 9094
      REDIS_URL: redis://:${REDIS_PASSWORD:-redispassword}@redis:6379
      CORE_API_URL: http://core-api:9092
      DRAW_SERVICE_URL: http://draw-service:9093
    ports:
      - "${REALTIME_GATEWAY_PORT:-9094}:9094"

  notification-worker:
    build:
      context: ../..
      dockerfile: infra/docker/Dockerfile.notification-worker
    container_name: prizedraw-notification-worker
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    environment:
      APP_ENV: ${APP_ENV:-dev}
      DATABASE_URL: jdbc:postgresql://postgres:5432/${POSTGRES_DB:-prizedraw}
      REDIS_URL: redis://:${REDIS_PASSWORD:-redispassword}@redis:6379
    # No ports — worker only

  web:
    # (unchanged, but API URL now points to core-api)
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:${CORE_API_PORT:-9092}
      NEXT_PUBLIC_WS_URL: ws://localhost:${REALTIME_GATEWAY_PORT:-9094}

  admin:
    # (unchanged, API URL → core-api)

  cs:
    # (unchanged, API URL → core-api)
```

- [ ] **Step 3: Create Dockerfiles for new services**

All 4 Dockerfiles follow the same multi-stage pattern as the existing `Dockerfile.server`, but with different Gradle build targets:

- `Dockerfile.core-api`: `./gradlew :server:shadowJar`
- `Dockerfile.draw-service`: `./gradlew :draw-service:shadowJar`
- `Dockerfile.realtime-gateway`: `./gradlew :realtime-gateway:shadowJar`
- `Dockerfile.notification-worker`: `./gradlew :notification-worker:shadowJar`

- [ ] **Step 4: Verify compose config**

Run: `docker compose -f infra/docker/docker-compose.yml --env-file infra/docker/env/.env.dev config`
Expected: valid compose config with all services

- [ ] **Step 5: Commit**

```bash
git add infra/docker/
git commit -m "feat: add multi-environment Docker Compose with 4 backend services"
```

---

### Task 5: Update CI/CD pipelines for multi-service + multi-environment

**Files:**
- Modify: `infra/ci/build-server.yml`
- Modify: `infra/ci/deploy.yml`

- [ ] **Step 1: Update build-server.yml**

Add a matrix strategy to build all 4 services in parallel:

```yaml
jobs:
  build:
    strategy:
      matrix:
        service:
          - name: core-api
            module: server
          - name: draw-service
            module: draw-service
          - name: realtime-gateway
            module: realtime-gateway
          - name: notification-worker
            module: notification-worker
    steps:
      - uses: actions/checkout@v4
      - name: Build & Test
        run: ./gradlew :${{ matrix.service.module }}:build
      - name: Build Docker image
        run: |
          docker build \
            -f infra/docker/Dockerfile.${{ matrix.service.name }} \
            -t ghcr.io/prizedraw/${{ matrix.service.name }}:${{ github.sha }} \
            .
```

- [ ] **Step 2: Update deploy.yml for multi-environment**

Add environment parameter and Kustomize-based deployment:

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        type: choice
        options: [dev, staging, prod]

jobs:
  deploy:
    environment: ${{ inputs.environment }}
    steps:
      - name: Deploy with Kustomize
        run: |
          cd infra/k8s/overlays/${{ inputs.environment }}
          kustomize edit set image \
            ghcr.io/prizedraw/core-api=ghcr.io/prizedraw/core-api:${{ github.sha }} \
            ghcr.io/prizedraw/draw-service=ghcr.io/prizedraw/draw-service:${{ github.sha }} \
            ghcr.io/prizedraw/realtime-gateway=ghcr.io/prizedraw/realtime-gateway:${{ github.sha }} \
            ghcr.io/prizedraw/notification-worker=ghcr.io/prizedraw/notification-worker:${{ github.sha }}
          kubectl apply -k .
      - name: Verify rollout
        run: |
          kubectl -n prizedraw-${{ inputs.environment }} rollout status deployment/prizedraw-core-api --timeout=300s
          kubectl -n prizedraw-${{ inputs.environment }} rollout status deployment/prizedraw-draw-service --timeout=300s
          kubectl -n prizedraw-${{ inputs.environment }} rollout status deployment/prizedraw-realtime-gateway --timeout=300s
          kubectl -n prizedraw-${{ inputs.environment }} rollout status deployment/prizedraw-notification-worker --timeout=300s
```

- [ ] **Step 3: Commit**

```bash
git add infra/ci/
git commit -m "feat: update CI/CD for multi-service build matrix and environment-based deploy"
```

---

### Phase 2: Extract Services from Monolith

### Task 6: Extract Notification Worker

**This is the easiest extraction — already a background job with no inbound traffic.**

**Files:**
- Create: `notification-worker/build.gradle.kts`
- Create: `notification-worker/src/main/kotlin/com/prizedraw/notification/Application.kt`
- Create: `notification-worker/src/main/kotlin/com/prizedraw/notification/worker/OutboxWorker.kt`
- Create: `notification-worker/src/main/kotlin/com/prizedraw/notification/worker/LowStockNotificationJob.kt`
- Create: `notification-worker/src/main/kotlin/com/prizedraw/notification/infrastructure/di/NotificationModule.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/Application.kt` (remove outbox/notification startup)
- Modify: `settings.gradle.kts` (add `:notification-worker`)

- [ ] **Step 1: Add notification-worker to settings.gradle.kts**

- [ ] **Step 2: Create notification-worker/build.gradle.kts**

Dependencies: `:shared`, `:db-schema`, Exposed ORM, Redis client, FCM SDK, LINE SDK, Twilio SDK, Ktor server (minimal — health + metrics endpoints only on port 9095).

- [ ] **Step 3: Create Application.kt for notification-worker**

```kotlin
package com.prizedraw.notification

import com.prizedraw.shared.plugins.configureHealthCheck
import io.ktor.server.engine.*
import io.ktor.server.cio.*
import kotlinx.coroutines.launch
import org.koin.core.context.startKoin

fun main() {
    startKoin { modules(notificationModule) }

    val outboxWorker = getKoin().get<OutboxWorker>()
    val lowStockJob = getKoin().get<LowStockNotificationJob>()

    // Minimal Ktor server for health checks and Prometheus metrics
    embeddedServer(CIO, port = 9095) {
        configureHealthCheck("notification-worker")
        // Micrometer metrics at /metrics
    }.start(wait = false)

    // Run workers as coroutines
    runBlocking {
        launch { outboxWorker.start() }
        launch { lowStockJob.start() }
    }
}
```

- [ ] **Step 4: Move OutboxWorker and LowStockNotificationJob**

Copy from `server/src/main/kotlin/com/prizedraw/application/events/` to notification-worker. Update package declarations. These files own the outbox polling loop and external notification delivery (FCM, LINE, SMS).

- [ ] **Step 5: Move notification-related infrastructure**

Copy push/, line/, sms/ directories from `server/src/main/kotlin/com/prizedraw/infrastructure/external/` to `notification-worker/src/main/kotlin/com/prizedraw/notification/infrastructure/external/`.

Copy `OutboxRepositoryImpl`, `NotificationRepositoryImpl`, and their table definitions.

- [ ] **Step 6: Create Koin module for notification-worker**

Wire repositories, external clients, and worker instances.

- [ ] **Step 7: Remove notification startup from server Application.kt**

Remove the `OutboxWorker` and `LowStockNotificationJob` launch blocks from the server's `Application.kt`. The server no longer runs these — it only writes to the `outbox_events` table.

- [ ] **Step 8: Verify server still builds without notification code**

Run: `./gradlew :server:build`
Expected: BUILD SUCCESSFUL (server still compiles, outbox table writes are unaffected)

- [ ] **Step 9: Verify notification-worker builds**

Run: `./gradlew :notification-worker:build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 10: Commit**

```bash
git add notification-worker/ server/src/main/kotlin/com/prizedraw/Application.kt settings.gradle.kts
git commit -m "feat: extract notification worker as independent service"
```

---

### Task 7: Extract Realtime Gateway

**Files:**
- Create: `realtime-gateway/build.gradle.kts`
- Create: `realtime-gateway/src/main/kotlin/com/prizedraw/realtime/Application.kt`
- Create: `realtime-gateway/src/main/kotlin/com/prizedraw/realtime/handlers/*.kt`
- Create: `realtime-gateway/src/main/kotlin/com/prizedraw/realtime/connection/ConnectionManager.kt`
- Create: `realtime-gateway/src/main/kotlin/com/prizedraw/realtime/infrastructure/`
- Modify: `server/src/main/kotlin/com/prizedraw/api/plugins/Routing.kt` (remove WS routes)
- Modify: `settings.gradle.kts`

- [ ] **Step 1: Add realtime-gateway to settings.gradle.kts**

- [ ] **Step 2: Create realtime-gateway/build.gradle.kts**

Dependencies: `:shared`, Ktor server (WebSocket plugin), Ktor client (for calling Core API/Draw Service), Redis client.

- [ ] **Step 3: Create Application.kt**

Minimal Ktor application with WebSocket plugin, Redis pub/sub, and health check. No database connection — all data comes from Redis events or HTTP calls to other services.

- [ ] **Step 4: Move WebSocket handlers**

Move from `server/src/main/kotlin/com/prizedraw/infrastructure/websocket/`:
- `ConnectionManager.kt` → `realtime-gateway/src/.../connection/`
- `kujiWebSocketHandler` → `realtime-gateway/src/.../handlers/KujiWebSocketHandler.kt`
- `queueWebSocketHandler` → `realtime-gateway/src/.../handlers/QueueWebSocketHandler.kt`
- `chatWebSocketHandler` → `realtime-gateway/src/.../handlers/ChatWebSocketHandler.kt`
- `feedWebSocketHandler` → `realtime-gateway/src/.../handlers/FeedWebSocketHandler.kt`
- `playerNotificationHandler` → `realtime-gateway/src/.../handlers/PlayerNotificationHandler.kt`
- `PlayerNotificationManager.kt` → `realtime-gateway/src/.../connection/`

Also move the tightly coupled application services:
- `ChatService.kt` → `realtime-gateway/src/.../services/`
- `BroadcastService.kt` (if exists) → `realtime-gateway/src/.../services/`
- `FeedService.kt` → `realtime-gateway/src/.../services/`
- `RoomScalingService.kt` → `realtime-gateway/src/.../services/`

These services are dependencies of the WebSocket handlers and must move with them.

- [ ] **Step 5: JWT verification is LOCAL — no HTTP call**

The Realtime Gateway uses `JwtVerifier` from the `shared/` module to verify JWT tokens locally (same signing key). No HTTP call to Core API for auth. Only call Core API for live DB checks (e.g., ban status), and cache those aggressively.

```kotlin
// realtime-gateway uses shared JwtVerifier directly
val jwtVerifier = JwtVerifier(jwtConfig)  // from shared module
// Only call CoreApiClient for ban-check, cached 60s
```

Create `CoreApiClient` for non-auth live checks with circuit breaker:

```kotlin
class CoreApiClient(private val httpClient: HttpClient) {
    private val circuitBreaker = CircuitBreakers.create("core-api", CircuitBreakers.serviceConfig())

    suspend fun isPlayerBanned(playerId: Long): Boolean =
        circuitBreaker.executeSuspendFunction {
            httpClient.get("${coreApiUrl}/internal/players/${playerId}/status").body()
        }
}
```

- [ ] **Step 6: Move Redis pub/sub to realtime-gateway**

Copy `RedisPubSub.kt` to realtime-gateway. This is where events from other services are consumed and pushed to WebSocket clients.

- [ ] **Step 7: Remove WebSocket code from server**

Remove WebSocket handler registrations from `server/api/plugins/Routing.kt`. Remove WebSocket-related Koin bindings. Remove `infrastructure/websocket/` directory from server.

- [ ] **Step 8: Verify both modules build**

Run: `./gradlew :server:build :realtime-gateway:build`
Expected: both BUILD SUCCESSFUL

- [ ] **Step 9: Commit**

```bash
git add realtime-gateway/ server/ settings.gradle.kts
git commit -m "feat: extract realtime gateway as independent WebSocket service"
```

---

### Task 8: Extract Draw Service

**This is the most complex extraction — involves domain logic and shared state.**

**Files:**
- Create: `draw-service/build.gradle.kts`
- Create: `draw-service/src/main/kotlin/com/prizedraw/draw/Application.kt`
- Create: `draw-service/src/main/kotlin/com/prizedraw/draw/api/routes/DrawRoutes.kt`
- Create: `draw-service/src/main/kotlin/com/prizedraw/draw/api/routes/LeaderboardRoutes.kt`
- Create: `draw-service/src/main/kotlin/com/prizedraw/draw/api/routes/LiveDrawRoutes.kt`
- Create: `draw-service/src/main/kotlin/com/prizedraw/draw/application/usecases/`
- Create: `draw-service/src/main/kotlin/com/prizedraw/draw/domain/services/`
- Create: `draw-service/src/main/kotlin/com/prizedraw/draw/infrastructure/`
- Modify: `server/src/main/kotlin/com/prizedraw/api/plugins/Routing.kt` (remove draw routes)
- Modify: `settings.gradle.kts`

- [ ] **Step 1: Add draw-service to settings.gradle.kts**

- [ ] **Step 2: Create draw-service/build.gradle.kts**

Dependencies: `:shared`, `:api-contracts`, Ktor server, Ktor client, Exposed ORM, Redis client, Koin.

- [ ] **Step 3: Create Application.kt**

Ktor application with: JWT auth (shared verifier), draw routes, database connection (shared PostgreSQL), Redis connection, health check.

- [ ] **Step 4: Move draw domain services**

Move from `server/src/.../domain/services/`:
- `DrawCore.kt`
- `KujiDrawDomainService.kt`
- `UnlimitedDrawDomainService.kt`
- `PityDomainService.kt`
- `MarginRiskService.kt`

These are pure domain logic with no I/O — clean to extract.

- [ ] **Step 5: Move draw application services and use cases**

Move from `server/src/.../application/`:
- `usecases/draw/` — all draw use cases
- `services/DrawSyncService.kt`
- `services/DrawSyncSession.kt`
- `services/KujiQueueService.kt`
- `services/LiveDrawService.kt`
- `usecases/leaderboard/` — leaderboard use cases

- [ ] **Step 6: Move draw-related repositories and tables**

Move the repository implementations and Exposed table definitions for: DrawTicket, TicketBox, Queue, QueueEntry, PrizeInstance, PrizeDefinition, PityRule, DrawSync, Leaderboard.

**Critical:** These repos access the same shared PostgreSQL. The draw-service connects to the same DB.

- [ ] **Step 7: Create CoreApiClient for cross-service calls**

The Draw Service needs player balance checks and point deductions from Core API:

```kotlin
class CoreApiClient(private val httpClient: HttpClient) {
    suspend fun getPlayerProfile(playerId: Long): PlayerProfile
    suspend fun getCampaignMetadata(campaignId: Long): CampaignMetadata
}
```

**Transaction atomicity:** Draw + point deduction + outbox event are in a SINGLE `newSuspendedTransaction` block within Draw Service. This is possible because:
- Draw Service uses `PointsLedgerService` from the `shared/` module (not a copy — a dependency)
- Draw Service uses table definitions from `db-schema/` module (same tables, same DB)
- Outbox events are written directly to `outbox_events` table in the same transaction (not via HTTP to Core API)
- This preserves the exact same atomicity guarantees as the monolith

- [ ] **Step 8: Move draw routes**

Move from `server/api/routes/`:
- `DrawRoutes.kt`
- `LeaderboardRoutes.kt`
- `LiveDrawRoutes.kt`

Update to draw-service package. Remove from server's `Routing.kt`.

- [ ] **Step 9: Remove draw code from server**

Remove draw-related use cases, services, domain services from server. Keep the entities and table definitions in server (they're still needed for campaign CRUD which references prizes/tickets).

**Important:** Shared entities (`PrizeDefinition`, `PrizeInstance`, etc.) and table definitions now live in the `db-schema/` module. Both `server/` and `draw-service/` depend on `:db-schema`. Remove the duplicate table definitions from both services and import from `db-schema/` instead.

- [ ] **Step 10: Verify both modules build**

Run: `./gradlew :server:build :draw-service:build`
Expected: both BUILD SUCCESSFUL

- [ ] **Step 11: Write integration test for cross-service draw flow**

Test the full draw flow: Core API creates campaign → Draw Service executes draw → points deducted → outbox event written → Notification Worker picks it up.

- [ ] **Step 12: Commit**

```bash
git add draw-service/ server/ settings.gradle.kts
git commit -m "feat: extract draw service as independent service with shared DB"
```

---

### Phase 3: Integration & Verification

### Task 9: Update monitoring for multi-service

**Files:**
- Modify: `infra/monitoring/prometheus/prometheus.yml`
- Modify: `infra/monitoring/prometheus/alert-rules.yml`
- Modify: `infra/monitoring/grafana/dashboards/api-overview.json`

- [ ] **Step 1: Update Prometheus scrape targets**

Add scrape jobs for each service:
```yaml
scrape_configs:
  - job_name: core-api
    static_configs:
      - targets: ['prizedraw-core-api:9092']
  - job_name: draw-service
    static_configs:
      - targets: ['prizedraw-draw-service:9093']
  - job_name: realtime-gateway
    static_configs:
      - targets: ['prizedraw-realtime-gateway:9094']
  # notification-worker exposes metrics on a separate port
  - job_name: notification-worker
    static_configs:
      - targets: ['prizedraw-notification-worker:9095']
```

- [ ] **Step 2: Add per-service alert rules**

Add alerts for inter-service communication failures, circuit breaker open states, and per-service error rates.

- [ ] **Step 3: Update Grafana dashboard**

Add service selector dropdown. Add inter-service latency panels. Add circuit breaker state panels.

- [ ] **Step 4: Commit**

```bash
git add infra/monitoring/
git commit -m "feat: update monitoring for multi-service architecture"
```

---

### Task 10: Docker Compose integration test

**Files:**
- Modify: `infra/docker/docker-compose.test.yml`

- [ ] **Step 1: Update test compose for multi-service**

All 4 services + test postgres + test redis. Each service starts and health checks pass.

- [ ] **Step 2: Run full stack locally**

```bash
docker compose -f infra/docker/docker-compose.yml --env-file infra/docker/env/.env.dev up --build
```

Verify:
- `curl http://localhost:9092/health` → Core API UP
- `curl http://localhost:9093/health` → Draw Service UP
- `curl http://localhost:9094/health` → Realtime Gateway UP
- All services connect to same PostgreSQL
- WebSocket connections work on port 9094
- Draw API works on port 9093
- Auth + CRUD works on port 9092

- [ ] **Step 3: Run existing integration tests**

Run: `./gradlew :server:test`
Expected: All existing tests still pass (server module still has all repos/tables for test context)

- [ ] **Step 4: Commit**

```bash
git add infra/docker/docker-compose.test.yml
git commit -m "feat: update test compose for multi-service integration testing"
```

---

### Task 11: Update CLAUDE.md and documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update project structure section**

Document the new 4-service architecture, service boundaries, and how to run each service.

- [ ] **Step 2: Update commands section**

Add per-service build and run commands:
```bash
# Build all services
./gradlew build

# Build individual service
./gradlew :server:build          # Core API
./gradlew :draw-service:build    # Draw Service
./gradlew :realtime-gateway:build # Realtime Gateway
./gradlew :notification-worker:build # Notification Worker

# Deploy to environment
kubectl apply -k infra/k8s/overlays/dev/
kubectl apply -k infra/k8s/overlays/staging/
kubectl apply -k infra/k8s/overlays/prod/
```

- [ ] **Step 3: Update architecture section**

Document inter-service communication patterns, shared DB strategy, and circuit breaker configuration.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for microservice architecture"
```

---

## Execution Order & Dependencies

```
Task 1 (shared + db-schema) ──→ Task 6 (notification worker) ──┐
       │                                                          │
       ├──→ Task 2 (K8s base) ──→ Task 3 (overlays) ───────────→ Task 9 (monitoring)
       │                                                          │
       ├──→ Task 4 (Docker Compose) ─────────────────────────────→ Task 10 (integration test)
       │                                                          │
       ├──→ Task 6 (notification) ──→ Task 7 (realtime) ──→ Task 8 (draw) ──→ Task 10
       │                                                          │
       └──→ Task 5 (CI/CD) ─────────────────────────────────────→ Task 11 (docs)
```

**Parallelizable:**
- Task 2, 3, 4, 5 can run in parallel after Task 1
- Task 6, 7 can start after Task 1

**Sequential:**
- Task 8 (Draw) must come after Task 6 & 7 (largest extraction, benefits from patterns established)
- Task 9, 10, 11 are final integration/verification

**Before each service extraction:** Create a git tag for rollback:
```bash
git tag monolith-pre-notification-extraction  # before Task 6
git tag monolith-pre-realtime-extraction      # before Task 7
git tag monolith-pre-draw-extraction          # before Task 8
```
