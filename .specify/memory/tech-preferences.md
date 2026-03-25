---
name: tech-preferences
description: User's preferred tech stack from new-project bootstrap pack — Kotlin/Ktor backend, KMP+Compose mobile, shared api-contracts
type: user
---

User has a well-defined bootstrap pack at `/Users/ken/Documents/new-project/` that establishes preferred architecture and tech choices:

**Backend**: Kotlin + Ktor (NOT TypeScript/NestJS)
- 4-layer architecture: api / application / domain / infrastructure
- Ports and adapters pattern
- Exposed ORM + PostgreSQL + Flyway migrations
- Koin DI
- Domain event outbox pattern for async side effects
- JWT with refresh token rotation + family-level revocation

**Mobile**: Kotlin Multiplatform (KMP) + Compose Multiplatform (NOT React Native)
- Targets: Android, iOS, Wasm (Web)
- MVI pattern (State/Intent/Effect)
- Koin DI, Ktor Client, kotlinx.serialization
- Coil 3 for images, DataStore for local persistence
- Firebase Auth/Crashlytics/Messaging

**Shared**: api-contracts KMP module
- Canonical DTOs, enums, endpoint constants shared between server and mobile
- Compiles for JVM + Android + iOS + Wasm

**Key principles**:
- api-contracts is the canonical contract boundary (not duplicated)
- Backend owns business truth, mobile is a cached projection
- Domain events + outbox worker for notifications
- WebSocket for realtime, push for background, notification persistence for truth
- Centralized DI, centralized auth/session, centralized logging
