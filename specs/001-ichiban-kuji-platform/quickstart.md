# Quickstart: 賞品抽獎平台（Prize Draw Platform）

## Prerequisites

- JDK 21 (for Ktor server + Gradle)
- Node.js 20 LTS + pnpm 9+ (for Next.js web/admin)
- Docker & Docker Compose (for PostgreSQL, Redis, MinIO)
- Android Studio (for mobile development)
- Xcode 15+ (for iOS target)

## 1. Clone & Setup

```bash
git clone <repo-url>
cd PrizeDraw

# Kotlin modules (server, api-contracts, mobile, kmp-shared-js)
./gradlew build

# Web modules (web, admin)
pnpm install
```

## 2. Start Infrastructure

```bash
docker compose up -d  # PostgreSQL 16, Redis 7, MinIO (S3)
```

## 3. Setup Database

```bash
./gradlew :server:flywayMigrate   # Run Flyway migrations
./gradlew :server:seedDatabase    # Seed admin user, sample campaigns
```

## 4. Configure Environment

Copy `.env.example` to `.env` in server/ and web modules:

```bash
# server/.env
DATABASE_URL=jdbc:postgresql://localhost:5432/prizedraw
DATABASE_USER=prizedraw
DATABASE_PASSWORD=prizedraw
REDIS_URL=redis://localhost:6379
JWT_SECRET=<generate-a-secret>
JWT_ACCESS_TOKEN_EXPIRATION=900        # 15 min
JWT_REFRESH_TOKEN_EXPIRATION=2592000   # 30 days
GOOGLE_CLIENT_ID=<your-google-oauth-id>
APPLE_CLIENT_ID=<your-apple-oauth-id>
LINE_CHANNEL_ID=<your-line-channel-id>
LINE_CHANNEL_SECRET=<your-line-channel-secret>
SMS_PROVIDER=twilio
SMS_API_KEY=<your-sms-api-key>
ECPAY_MERCHANT_ID=<your-ecpay-merchant-id>
ECPAY_HASH_KEY=<your-ecpay-hash-key>
ECPAY_HASH_IV=<your-ecpay-hash-iv>
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=prizedraw-images
USE_MOCK_OAUTH=true  # Dev only — NEVER in production
```

```bash
# web/.env.local & admin/.env.local
NEXT_PUBLIC_API_URL=http://localhost:9092
NEXT_PUBLIC_WS_URL=ws://localhost:9092
```

## 5. Build KMP Shared JS Module

```bash
./gradlew :kmp-shared-js:jsBrowserProductionWebpack
# Output: kmp-shared-js/build/dist/js/ → consumed by web & admin
```

## 6. Start Development Servers

```bash
# Terminal 1: Ktor API server
./gradlew :server:run

# Terminal 2: Next.js player web
pnpm --filter web dev

# Terminal 3: Next.js admin dashboard
pnpm --filter admin dev

# Terminal 4: Mobile (Android)
# Open in Android Studio → Run on emulator/device
```

| Service | URL | Description |
|---------|-----|-------------|
| API Server | http://localhost:9092 | Ktor API + WebSocket |
| Player Web | http://localhost:3000 | Next.js player app |
| Admin | http://localhost:3001 | Next.js admin dashboard |
| Mobile | Metro/AS emulator | KMP Compose Multiplatform |

## 7. Verify Core Flows

### 7.1 Admin: Create a Kuji Campaign
1. Open http://localhost:3001, login with seeded admin account
2. Campaigns → Create Kuji → Fill name, cover, price, add ticket box with 10 tickets
3. Assign prizes to each ticket (upload photos) → Preview → Publish

### 7.2 Player: Register & Draw
1. Open http://localhost:3000
2. Login with Google/Apple/LINE (use mock OAuth in dev) → Complete phone binding
3. Top up draw points (use test payment) → Browse campaigns → Enter kuji
4. Select ticket box → Join queue → Wait for turn → Pick a ticket → See animation

### 7.3 Player: Trade & Ship
1. My Prizes → Select prize → List on marketplace (set price)
2. Another test account → Buy prize → Verify revenue points transfer
3. Request shipment → Fill address → Admin processes shipment

## 8. Run Tests

```bash
# Kotlin tests
./gradlew test                          # All unit tests (Kotest + JUnit5)
./gradlew :server:integrationTest       # Ktor testApplication integration tests
./gradlew :server:flywayMigrationTest   # Migration verification

# Web tests
pnpm --filter web test                  # Vitest unit tests
pnpm --filter web test:e2e              # Playwright E2E

# Mobile E2E
maestro test mobile/maestro/            # Maestro E2E flows

# Performance
k6 run infra/k6/load-test.js           # k6 load test
```

## 9. Key Development Commands

```bash
# Kotlin
./gradlew ktlintCheck                  # Lint check
./gradlew detekt                       # Static analysis
./gradlew :server:run                  # Run API server
./gradlew :kmp-shared-js:jsBrowserProductionWebpack  # Rebuild KMP→JS

# Web
pnpm --filter web lint                 # ESLint
pnpm --filter web build                # Production build

# Database
./gradlew :server:flywayInfo           # Migration status
./gradlew :server:flywayMigrate        # Apply migrations
```

## Architecture Quick Reference

```
Player App (Mobile KMP / Web Next.js)
    ↓ REST API + WebSocket (Ktor)
Ktor API Server (JVM 21, stateless pods)
    ├── PostgreSQL 16 (data, transactions, audit) + PgBouncer
    ├── Redis 7 (cache, pub/sub, distributed locks, feature flags)
    ├── Outbox Worker (Kotlin coroutines, polls outbox table)
    ├── S3/MinIO (product images, CDN delivery)
    └── External Services
        ├── ECPay/NewebPay (payment gateway)
        ├── Google/Apple/LINE (OAuth2)
        ├── SMS Provider (phone OTP)
        ├── LINE Messaging API (customer service)
        └── Firebase Messaging (push notifications)

K8s Deployment:
    ├── API Server: HPA auto-scale (CPU/request-based)
    ├── WebSocket: Sticky session + Redis pub/sub fanout
    ├── Web/Admin: Static build served via CDN or nginx pods
    ├── PostgreSQL: StatefulSet + PVC (or managed RDS)
    └── Redis: StatefulSet (or managed ElastiCache)
```

## KMP Shared Logic Flow (Web)

```
api-contracts (KMP)
    │ compiles to JS/Wasm
    ↓
kmp-shared-js
    │ exports @JsExport DTOs, validation, business rules
    ↓
web/ & admin/ (Next.js)
    │ import from kmp-shared-js build output
    ↓
React components consume typed Kotlin DTOs + shared logic
```
