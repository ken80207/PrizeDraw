# Tasks: 賞品抽獎平台（Prize Draw Platform）

**Feature Branch**: `001-ichiban-kuji-platform`
**Created**: 2026-03-24
**Spec**: [spec.md](./spec.md) | **Data Model**: [data-model.md](./data-model.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Project Setup & Scaffolding

> Goal: All 7 modules compile, CI green, local dev stack running via Docker Compose.

- [x] T001 [P] Initialize root Gradle settings file declaring all KMP/JVM subprojects; configure `settings.gradle.kts` at project root with `include(":api-contracts", ":server", ":mobile", ":kmp-shared-js")`
- [x] T002 [P] Create root `build.gradle.kts` with shared version catalog (`gradle/libs.versions.toml`) defining Kotlin 2.x, Ktor 3.x, Exposed, Koin, kotlinx.serialization, Kotest, Flyway, ktlint, detekt versions
- [x] T003 [P] Scaffold `api-contracts/build.gradle.kts` as KMP module targeting JVM + Android + iOS + JS/Wasm; create directory tree `api-contracts/src/commonMain/kotlin/dto/`, `enums/`, `endpoints/`
- [x] T004 [P] Scaffold `server/build.gradle.kts` as JVM application targeting JVM 21; add Ktor server, Exposed, Koin, Flyway, Redis (Lettuce or Kreds), kotlinx.serialization, Kotest dependencies; create `server/src/main/kotlin/` directory tree mirroring plan.md structure (`api/routes/`, `api/plugins/`, `api/mappers/`, `application/ports/input/`, `application/ports/output/`, `application/usecases/`, `application/services/`, `application/events/`, `domain/entities/`, `domain/valueobjects/`, `domain/services/`, `infrastructure/persistence/tables/`, `infrastructure/persistence/repositories/`, `infrastructure/persistence/migrations/`, `infrastructure/external/`, `infrastructure/websocket/`, `infrastructure/di/`)
- [x] T005 [P] Scaffold `mobile/` as KMP + Compose Multiplatform project; create `mobile/composeApp/build.gradle.kts` targeting Android + iOS; create `mobile/shared/build.gradle.kts` for shared data/domain/platform layer; create directory tree for `commonMain/`, `androidMain/`, `iosMain/`
- [x] T006 [P] Scaffold `kmp-shared-js/build.gradle.kts` as KMP module targeting JS/Wasm; create `src/commonMain/kotlin/validation/`, `models/`, `utils/` and `src/jsMain/kotlin/` directories
- [x] T007 [P] Initialize `web/` as Next.js 14 project with App Router using `pnpm create next-app`; configure TypeScript, Tailwind CSS, ESLint, Prettier; create directory structure `src/app/`, `src/components/`, `src/features/`, `src/hooks/`, `src/services/`, `src/stores/`, `src/animations/`, `src/lib/kmp/`, `src/i18n/`; add `web/package.json` with pnpm workspace reference
- [x] T008 [P] Initialize `admin/` as Next.js 14 project with App Router using `pnpm create next-app`; configure TypeScript, Tailwind CSS, ESLint, Prettier; create directory structure mirroring plan.md admin pages; add `admin/package.json` with pnpm workspace reference
- [x] T009 [P] Create root `pnpm-workspace.yaml` declaring `web` and `admin` packages; create root `.npmrc` for pnpm config
- [x] T010 [P] Write `infra/docker/docker-compose.yml` with services: `postgres` (postgres:16, port 5432, volume, healthcheck), `redis` (redis:7-alpine, port 6379), `minio` (minio/minio, ports 9000/9001, MINIO_ROOT_USER/PASSWORD), `server` (depends_on postgres+redis), `web` (depends_on server), `admin` (depends_on server); include `.env.example` with all required variables
- [x] T011 [P] Write `infra/docker/Dockerfile.server` as multi-stage JVM build: stage 1 uses `gradle:8-jdk21` to run `./gradlew :server:shadowJar`, stage 2 uses `gcr.io/distroless/java21` copying the fat JAR; expose port 8080
- [x] T012 [P] Write `infra/docker/Dockerfile.web` and `infra/docker/Dockerfile.admin` as multi-stage Next.js standalone builds: stage 1 `node:20-alpine` runs `pnpm build`, stage 2 copies `.next/standalone` output
- [x] T013 [P] Configure ktlint in root `build.gradle.kts` applying to all Kotlin subprojects; add `.editorconfig` with ktlint rules; create `infra/ci/build-server.yml` GitHub Actions workflow running `./gradlew ktlintCheck detekt test`
- [x] T014 [P] Configure detekt in root `build.gradle.kts`; create `detekt.yml` config at project root with Ktor/KMP-appropriate rule weights
- [x] T015 [P] Configure ESLint + Prettier for `web/` and `admin/`; add `.eslintrc.json` and `.prettierrc` to each; add lint scripts to `package.json`; create `infra/ci/build-web.yml` GitHub Actions workflow running `pnpm --filter web lint && pnpm --filter web test && pnpm --filter admin lint`
- [x] T016 Create `server/src/main/kotlin/Application.kt` Ktor entry point calling `embeddedServer(Netty, port=8080)` and invoking all plugin install functions; add `server/src/main/resources/application.conf` (HOCON) with database, redis, jwt, storage config blocks

---

## Phase 2: Foundational Infrastructure (Blocks All User Stories)

> All tasks here MUST complete before any user story phase begins. Parallel tasks within this phase are marked [P].

### 2a. Database Migrations

- [x] T017 Write `server/src/main/kotlin/infrastructure/persistence/migrations/V001__create_players.sql`: create `player_oauth_provider` enum (`GOOGLE`, `APPLE`, `LINE`), `draw_animation_mode` enum (`TEAR`, `SCRATCH`, `FLIP`, `INSTANT`), `players` table with all fields from data-model §1 (id UUID PK, nickname, avatar_url, phone_number UNIQUE nullable, phone_verified_at, oauth_provider, oauth_subject, draw_points_balance INTEGER CHECK>=0, revenue_points_balance INTEGER CHECK>=0, version INTEGER default 0, preferred_animation_mode, locale, is_active, deleted_at, created_at, updated_at); add all four indexes from data-model §1
- [x] T018 Write `server/src/main/kotlin/infrastructure/persistence/migrations/V002__create_wallets_and_points.sql`: create `draw_point_tx_type` enum, `revenue_point_tx_type` enum, `draw_point_transactions` table (§15 fields: id, player_id FK, type, amount CHECK!=0, balance_after CHECK>=0, payment_order_id nullable, trade_order_id nullable, draw_ticket_id nullable, unlimited_campaign_id nullable, player_coupon_id nullable, original_amount, discount_amount, description, created_at), `revenue_point_transactions` table (§16 fields: id, player_id FK, type, amount CHECK!=0, balance_after CHECK>=0, trade_order_id nullable, buyback_record_id nullable, withdrawal_request_id nullable, description, created_at); add all indexes from §15, §16
- [x] T019 Write `server/src/main/kotlin/infrastructure/persistence/migrations/V003__create_campaigns_and_tickets.sql`: create `kuji_campaign_status` enum (`DRAFT`,`ACTIVE`,`SUSPENDED`,`SOLD_OUT`), `unlimited_campaign_status` enum (`DRAFT`,`ACTIVE`,`SUSPENDED`), `ticket_box_status` enum (`AVAILABLE`,`SOLD_OUT`), `draw_ticket_status` enum (`AVAILABLE`,`DRAWN`), `kuji_campaigns` table (§2 fields), `ticket_boxes` table (§3 fields with `remaining_tickets` CHECK>=0), `unlimited_campaigns` table (§4 fields with `rate_limit_per_second`), `draw_tickets` table (§5 fields); add all indexes from §2, §3, §4, §5
- [x] T020 Write `server/src/main/kotlin/infrastructure/persistence/migrations/V004__create_prizes.sql`: create `prize_acquisition_method` enum (`KUJI_DRAW`,`UNLIMITED_DRAW`,`TRADE_PURCHASE`,`EXCHANGE`), `prize_instance_state` enum (`HOLDING`,`TRADING`,`EXCHANGING`,`PENDING_BUYBACK`,`PENDING_SHIPMENT`,`SHIPPED`,`DELIVERED`,`SOLD`,`RECYCLED`), `prize_definitions` table (§6 fields with CHECK that exactly one of kuji_campaign_id/unlimited_campaign_id is non-null, probability_bps nullable, ticket_count nullable, photos JSONB default '[]'), `prize_instances` table (§7 fields with all source FKs nullable, deleted_at); add all indexes from §6, §7
- [x] T021 Write `server/src/main/kotlin/infrastructure/persistence/migrations/V005__create_trade_and_exchange.sql`: create `trade_order_status` enum (`LISTED`,`COMPLETED`,`CANCELLED`), `exchange_request_status` enum (`PENDING`,`COUNTER_PROPOSED`,`ACCEPTED`,`COMPLETED`,`REJECTED`,`CANCELLED`), `exchange_item_side` enum (`INITIATOR`,`RECIPIENT`), `trade_orders` table (§13 fields: seller_id FK, buyer_id nullable FK, prize_instance_id FK, list_price CHECK>0, fee_rate_bps, fee_amount nullable, seller_proceeds nullable, status, timestamps, deleted_at), `exchange_requests` table (§11 fields: initiator_id FK, recipient_id FK, parent_request_id self-ref nullable, status, message nullable, timestamps), `exchange_request_items` table (§12 fields); add all indexes from §11, §12, §13
- [x] T022 Write `server/src/main/kotlin/infrastructure/persistence/migrations/V006__create_shipping.sql`: create `shipping_order_status` enum (`PENDING_SHIPMENT`,`SHIPPED`,`DELIVERED`,`CANCELLED`), `shipping_orders` table (§10 fields: player_id FK, prize_instance_id UNIQUE FK, recipient_name, recipient_phone, address_line1/2, city, postal_code, country_code default 'TW', tracking_number nullable, carrier nullable, status, shipped_at, delivered_at, cancelled_at, fulfilled_by_staff_id nullable FK, created_at, updated_at); add all indexes from §10
- [x] T023 Write `server/src/main/kotlin/infrastructure/persistence/migrations/V007__create_payments_and_withdrawals.sql`: create `payment_gateway` enum (`ECPAY`,`NEWEBPAY`,`STRIPE`,`APPLEPAY`,`GOOGLEPAY`), `payment_order_status` enum (`PENDING`,`PAID`,`FAILED`,`REFUNDED`), `withdrawal_status` enum (`PENDING_REVIEW`,`APPROVED`,`TRANSFERRED`,`REJECTED`), `payment_orders` table (§17 fields: id used as merchant order ID, player_id FK, fiat_amount CHECK>0, currency_code, draw_points_granted CHECK>0, gateway, gateway_transaction_id nullable UNIQUE per gateway, payment_method nullable, gateway_metadata JSONB, status, timestamps), `withdrawal_requests` table (§18 fields: player_id FK, points_amount CHECK>0, fiat_amount CHECK>0, currency_code, bank_name, bank_code, account_holder_name, account_number encrypted, status, reviewed_by_staff_id nullable FK, reviewed_at, transfer_reference nullable, rejection_reason nullable, created_at, updated_at); add all indexes from §17, §18
- [x] T024 Write `server/src/main/kotlin/infrastructure/persistence/migrations/V008__create_coupons.sql`: create `coupon_applicable_type` enum (`KUJI`,`UNLIMITED`,`ALL`), `coupons` table (id, name, discount_rate_bps INTEGER CHECK>0 AND <=10000, applicable_type, valid_from TIMESTAMPTZ, valid_until TIMESTAMPTZ nullable, max_uses_per_player INTEGER CHECK>0, total_supply INTEGER nullable, issued_count INTEGER default 0, used_count INTEGER default 0, is_active BOOLEAN default true, created_by_staff_id FK, created_at, updated_at), `discount_codes` table (id, code VARCHAR(64) UNIQUE, coupon_id FK, redemption_limit INTEGER nullable, redeemed_count INTEGER default 0, is_active BOOLEAN, created_at, updated_at), `player_coupons` table (id, player_id FK, coupon_id FK, discount_code_id nullable FK, is_used BOOLEAN default false, used_at nullable, acquired_at, draw_ticket_id nullable FK, unlimited_campaign_id nullable FK); add indexes on player_coupons(player_id, is_used), coupons(is_active), discount_codes(code)
- [x] T025 Write `server/src/main/kotlin/infrastructure/persistence/migrations/V009__create_support.sql`: create `support_ticket_status` enum (`OPEN`,`IN_PROGRESS`,`RESOLVED`,`CLOSED`), `support_ticket_category` enum (`TRADE_DISPUTE`,`DRAW_ISSUE`,`ACCOUNT_ISSUE`,`SHIPPING_ISSUE`,`PAYMENT_ISSUE`,`OTHER`), `message_sender_type` enum (`PLAYER`,`STAFF`,`SYSTEM`), `support_tickets` table (id, player_id FK, staff_id nullable FK, category, subject VARCHAR(255), status, line_thread_id nullable VARCHAR(255), satisfaction_score nullable INTEGER CHECK 1-5, closed_at nullable, created_at, updated_at), `support_ticket_messages` table (id, ticket_id FK, sender_type, player_id nullable FK, staff_id nullable FK, body TEXT NOT NULL, is_read BOOLEAN default false, created_at); add indexes on support_tickets(player_id, status), support_tickets(staff_id, status), support_ticket_messages(ticket_id, created_at)
- [x] T026 Write `server/src/main/kotlin/infrastructure/persistence/migrations/V010__create_audit_and_outbox.sql`: create `audit_actor_type` enum (`PLAYER`,`STAFF`,`SYSTEM`), `audit_logs` table (id, actor_type, player_id nullable FK, staff_id nullable FK, action VARCHAR(128) NOT NULL, entity_type VARCHAR(64), entity_id UUID nullable, before_value JSONB nullable, after_value JSONB nullable, ip_address INET nullable, user_agent TEXT nullable, created_at), `outbox_events` table (id, event_type VARCHAR(128), aggregate_id UUID, payload JSONB NOT NULL, status VARCHAR(32) default 'PENDING', attempts INTEGER default 0, last_error TEXT nullable, created_at, processed_at nullable); add indexes on audit_logs(actor_type, created_at DESC), audit_logs(entity_type, entity_id), outbox_events(status, created_at) WHERE status='PENDING'
- [x] T027 Write `server/src/main/kotlin/infrastructure/persistence/migrations/V011__create_refresh_token_families.sql`: create `refresh_token_families` table (id UUID PK, player_id FK NOT NULL, family_token VARCHAR(64) UNIQUE NOT NULL, current_token_hash VARCHAR(128) NOT NULL, revoked BOOLEAN default false, revoked_at nullable, created_at, updated_at); add indexes on refresh_token_families(player_id, revoked), refresh_token_families(family_token)
- [x] T028 Write `server/src/main/kotlin/infrastructure/persistence/migrations/V012__create_feature_flags.sql`: create `feature_flag_target_type` enum (`GLOBAL`,`PLAYER_GROUP`,`PLATFORM`,`PERCENTAGE`), `feature_flags` table (id, key VARCHAR(64) UNIQUE NOT NULL, enabled BOOLEAN default false, target_type, target_value JSONB nullable, description TEXT nullable, updated_by_staff_id nullable FK, created_at, updated_at), `queues` table (id, ticket_box_id UUID UNIQUE FK NOT NULL, active_player_id nullable FK, session_started_at nullable, session_expires_at nullable, created_at, updated_at), `queue_entries` table (id, queue_id FK NOT NULL, player_id FK NOT NULL, position INTEGER CHECK>0, status `queue_entry_status` enum (`WAITING`,`ACTIVE`,`COMPLETED`,`ABANDONED`,`EVICTED`), joined_at, activated_at nullable, completed_at nullable, created_at, updated_at); add indexes from data-model §8, §9; add `staff` table (id UUID PK, email VARCHAR(255) UNIQUE NOT NULL, name VARCHAR(128) NOT NULL, role `staff_role` enum (`CUSTOMER_SERVICE`,`OPERATOR`,`ADMIN`,`OWNER`), password_hash VARCHAR(255) NOT NULL, is_active BOOLEAN default true, last_login_at nullable, created_at, updated_at)

### 2b. api-contracts: Shared Enums

- [x] T029 [P] Write `api-contracts/src/commonMain/kotlin/enums/CampaignStatus.kt`: sealed `CampaignStatus` with `DRAFT`, `ACTIVE`, `SUSPENDED`, `SOLD_OUT` (kuji-specific)
- [x] T030 [P] Write `api-contracts/src/commonMain/kotlin/enums/CampaignType.kt`: enum `CampaignType` with `KUJI`, `UNLIMITED`
- [x] T031 [P] Write `api-contracts/src/commonMain/kotlin/enums/PrizeState.kt`: enum `PrizeState` with `HOLDING`, `TRADING`, `EXCHANGING`, `PENDING_BUYBACK`, `PENDING_SHIPMENT`, `SHIPPED`, `DELIVERED`, `SOLD`, `RECYCLED`
- [x] T032 [P] Write `api-contracts/src/commonMain/kotlin/enums/PointType.kt`: enum `DrawPointTxType` (`PURCHASE_CREDIT`, `KUJI_DRAW_DEBIT`, `UNLIMITED_DRAW_DEBIT`, `TRADE_PURCHASE_DEBIT`, `COUPON_DISCOUNT_CREDIT`, `REFUND_CREDIT`, `ADMIN_ADJUSTMENT`) and `RevenuePointTxType` (`TRADE_SALE_CREDIT`, `BUYBACK_CREDIT`, `WITHDRAWAL_DEBIT`, `ADMIN_ADJUSTMENT`)
- [x] T033 [P] Write `api-contracts/src/commonMain/kotlin/enums/TradeListingStatus.kt`: enum `TradeOrderStatus` with `LISTED`, `COMPLETED`, `CANCELLED`
- [x] T034 [P] Write `api-contracts/src/commonMain/kotlin/enums/ShippingStatus.kt`: enum `ShippingOrderStatus` with `PENDING_SHIPMENT`, `SHIPPED`, `DELIVERED`, `CANCELLED`
- [x] T035 [P] Write `api-contracts/src/commonMain/kotlin/enums/WithdrawalStatus.kt`: enum `WithdrawalStatus` with `PENDING_REVIEW`, `APPROVED`, `TRANSFERRED`, `REJECTED`
- [x] T036 [P] Write `api-contracts/src/commonMain/kotlin/enums/SupportTicketStatus.kt`: enum `SupportTicketStatus` with `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`; enum `SupportTicketCategory` with `TRADE_DISPUTE`, `DRAW_ISSUE`, `ACCOUNT_ISSUE`, `SHIPPING_ISSUE`, `PAYMENT_ISSUE`, `OTHER`
- [x] T037 [P] Write `api-contracts/src/commonMain/kotlin/enums/ExchangeStatus.kt`: enum `ExchangeRequestStatus` with `PENDING`, `COUNTER_PROPOSED`, `ACCEPTED`, `COMPLETED`, `REJECTED`, `CANCELLED`; enum `ExchangeItemSide` with `INITIATOR`, `RECIPIENT`
- [x] T038 [P] Write `api-contracts/src/commonMain/kotlin/enums/QueueEntryStatus.kt`: enum `QueueEntryStatus` with `WAITING`, `ACTIVE`, `COMPLETED`, `ABANDONED`, `EVICTED`; enum `DrawAnimationMode` with `TEAR`, `SCRATCH`, `FLIP`, `INSTANT`
- [x] T039 [P] Write `api-contracts/src/commonMain/kotlin/enums/PaymentGateway.kt`: enum `PaymentGateway` with `ECPAY`, `NEWEBPAY`, `STRIPE`, `APPLEPAY`, `GOOGLEPAY`; enum `PaymentOrderStatus` with `PENDING`, `PAID`, `FAILED`, `REFUNDED`; enum `OAuthProvider` with `GOOGLE`, `APPLE`, `LINE`; enum `StaffRole` with `CUSTOMER_SERVICE`, `OPERATOR`, `ADMIN`, `OWNER`

### 2c. api-contracts: Shared DTOs

- [x] T040 [P] Write `api-contracts/src/commonMain/kotlin/dto/auth/AuthDtos.kt`: `@Serializable LoginRequest(provider: OAuthProvider, idToken: String)`, `TokenResponse(accessToken: String, refreshToken: String, expiresIn: Long)`, `RefreshRequest(refreshToken: String)`, `PhoneBindRequest(phoneNumber: String, otpCode: String)`, `SendOtpRequest(phoneNumber: String)`, `LogoutRequest(refreshToken: String)`
- [x] T041 [P] Write `api-contracts/src/commonMain/kotlin/dto/player/PlayerDtos.kt`: `PlayerDto(id, nickname, avatarUrl, phoneNumber nullable, drawPointsBalance, revenuePointsBalance, preferredAnimationMode, locale, isActive, createdAt)`, `UpdatePlayerRequest(nickname nullable, avatarUrl nullable, locale nullable)`, `WalletDto(drawPointsBalance, revenuePointsBalance, drawTransactions: List<DrawPointTransactionDto>, revenueTransactions: List<RevenuePointTransactionDto>)`, `DrawPointTransactionDto(id, type, amount, balanceAfter, description nullable, createdAt)`, `RevenuePointTransactionDto(id, type, amount, balanceAfter, description nullable, createdAt)`
- [x] T042 [P] Write `api-contracts/src/commonMain/kotlin/dto/campaign/CampaignDtos.kt`: `KujiCampaignDto(id, title, description, coverImageUrl, pricePerDraw, drawSessionSeconds, status, activatedAt nullable, soldOutAt nullable)`, `UnlimitedCampaignDto(id, title, description, coverImageUrl, pricePerDraw, rateLimitPerSecond, status, activatedAt nullable)`, `TicketBoxDto(id, name, totalTickets, remainingTickets, status, displayOrder)`, `PrizeDefinitionDto(id, grade, name, photos, buybackPrice, buybackEnabled, probabilityBps nullable, ticketCount nullable, displayOrder)`, `CreateKujiCampaignRequest(title, description, coverImageUrl, pricePerDraw, drawSessionSeconds)`, `CreateUnlimitedCampaignRequest(title, description, coverImageUrl, pricePerDraw, rateLimitPerSecond)`, `UpdateCampaignStatusRequest(status: CampaignStatus)`
- [x] T043 [P] Write `api-contracts/src/commonMain/kotlin/dto/draw/DrawDtos.kt`: `DrawTicketDto(id, position, status, drawnByPlayerId nullable, drawnByNickname nullable, drawnAt nullable, prizeDefinitionId, grade nullable, prizeName nullable, prizePhotoUrl nullable)`, `DrawKujiRequest(ticketBoxId, ticketIds: List<String>, quantity: Int)`, `DrawUnlimitedRequest(campaignId, quantity: Int, playerCouponId nullable)`, `DrawResultDto(tickets: List<DrawnTicketResultDto>)`, `DrawnTicketResultDto(ticketId, position, prizeInstanceId, grade, prizeName, prizePhotoUrl, pointsCharged, discountApplied)`, `UnlimitedDrawResultDto(prizeInstanceId, grade, prizeName, prizePhotoUrl, pointsCharged)`
- [x] T044 [P] Write `api-contracts/src/commonMain/kotlin/dto/trade/TradeDtos.kt`: `TradeListingDto(id, sellerId, sellerNickname, prizeInstanceId, prizeGrade, prizeName, prizePhotoUrl, listPrice, feeRateBps, status, listedAt)`, `CreateListingRequest(prizeInstanceId, listPrice: Int)`, `PurchaseListingRequest(listingId)`, `TradeListingPageDto(items: List<TradeListingDto>, totalCount: Int, page: Int, pageSize: Int)`
- [x] T045 [P] Write `api-contracts/src/commonMain/kotlin/dto/exchange/ExchangeDtos.kt`: `ExchangeOfferDto(id, initiatorId, initiatorNickname, recipientId, recipientNickname, initiatorItems: List<ExchangeItemDto>, recipientItems: List<ExchangeItemDto>, status, message nullable, createdAt)`, `ExchangeItemDto(prizeInstanceId, grade, prizeName, prizePhotoUrl)`, `CreateExchangeRequest(recipientId, offeredPrizeInstanceIds: List<String>, requestedPrizeInstanceIds: List<String>, message nullable)`, `RespondExchangeRequest(action: ExchangeResponseAction, counterOfferedPrizeInstanceIds nullable)` where `ExchangeResponseAction` enum is `ACCEPT`, `REJECT`, `COUNTER_PROPOSE`
- [x] T046 [P] Write `api-contracts/src/commonMain/kotlin/dto/shipping/ShippingDtos.kt`: `ShippingOrderDto(id, prizeInstanceId, recipientName, recipientPhone, addressLine1, addressLine2 nullable, city, postalCode, countryCode, trackingNumber nullable, carrier nullable, status, shippedAt nullable, deliveredAt nullable)`, `CreateShippingOrderRequest(prizeInstanceId, recipientName, recipientPhone, addressLine1, addressLine2 nullable, city, postalCode, countryCode)`, `UpdateShippingRequest(trackingNumber, carrier)`, `ConfirmDeliveryRequest(shippingOrderId)`
- [x] T047 [P] Write `api-contracts/src/commonMain/kotlin/dto/payment/PaymentDtos.kt`: `PaymentIntentDto(paymentOrderId, gateway, checkoutUrl nullable, expiresAt nullable)`, `CreatePaymentOrderRequest(pointsPackageId)`, `PointsPackageDto(id, drawPointsAmount, fiatAmount, currencyCode, label, isActive)`, `PaymentWebhookPayload(gateway, transactionId, merchantOrderId, status, amount, metadata: Map<String, String>)`, `WithdrawalRequestDto(id, pointsAmount, fiatAmount, currencyCode, bankName, bankCode, accountHolderName, status, reviewedAt nullable, createdAt)`, `CreateWithdrawalRequest(pointsAmount, bankName, bankCode, accountHolderName, accountNumber)`
- [x] T048 [P] Write `api-contracts/src/commonMain/kotlin/dto/coupon/CouponDtos.kt`: `CouponDto(id, name, discountRateBps, applicableType, validFrom, validUntil nullable, maxUsesPerPlayer, isActive)`, `PlayerCouponDto(id, couponId, couponName, discountRateBps, isUsed, usedAt nullable, acquiredAt)`, `ApplyCouponRequest(playerCouponId)`, `RedeemDiscountCodeRequest(code)`
- [x] T049 [P] Write `api-contracts/src/commonMain/kotlin/dto/leaderboard/LeaderboardDtos.kt`: `LeaderboardDto(type: LeaderboardType, period: LeaderboardPeriod, entries: List<LeaderboardEntryDto>, selfRank: SelfRankDto nullable)`, `LeaderboardEntryDto(rank, playerId, nickname, avatarUrl nullable, score, detail nullable)`, `SelfRankDto(rank, score)` where `LeaderboardType` enum is `DRAW_COUNT`, `PRIZE_GRADE`, `TRADE_VOLUME`, `CAMPAIGN_SPECIFIC` and `LeaderboardPeriod` enum is `TODAY`, `THIS_WEEK`, `THIS_MONTH`, `ALL_TIME`
- [x] T050 [P] Write `api-contracts/src/commonMain/kotlin/dto/support/SupportDtos.kt`: `SupportTicketDto(id, category, subject, status, messages: List<TicketMessageDto>, satisfactionScore nullable, createdAt, updatedAt)`, `TicketMessageDto(id, senderType, senderId nullable, body, isRead, createdAt)`, `CreateTicketRequest(category, subject, body)`, `ReplyTicketRequest(ticketId, body)`, `CloseTicketRequest(ticketId, satisfactionScore nullable)`
- [x] T051 [P] Write `api-contracts/src/commonMain/kotlin/dto/admin/AdminDtos.kt`: `AdminPlayerDto(id, nickname, phone, drawPointsBalance, revenuePointsBalance, isActive, createdAt)`, `StaffDto(id, email, name, role, isActive, lastLoginAt)`, `CreateStaffRequest(email, name, role, password)`, `AdminCampaignListItemDto(id, title, type: CampaignType, status, pricePerDraw, createdAt)`, `AdminShippingOrderDto extends ShippingOrderDto + playerNickname, playerPhone)`, `AdminWithdrawalDto(id, playerNickname, pointsAmount, fiatAmount, bankName, status, createdAt)`, `AuditLogDto(id, actorType, actorName, action, entityType, entityId, beforeValue, afterValue, createdAt)`, `FeatureFlagDto(id, key, enabled, targetType, targetValue nullable, description, updatedAt)`
- [x] T052 [P] Write `api-contracts/src/commonMain/kotlin/dto/notification/NotificationDtos.kt`: `PushPayloadDto(title, body, data: Map<String, String>)`, `NotificationDto(id, type, title, body, isRead, createdAt)`

### 2d. api-contracts: Endpoint Constants

- [x] T053 [P] Write `api-contracts/src/commonMain/kotlin/endpoints/AuthEndpoints.kt`: `object AuthEndpoints { const val LOGIN = "/api/v1/auth/login"; const val REFRESH = "/api/v1/auth/refresh"; const val LOGOUT = "/api/v1/auth/logout"; const val SEND_OTP = "/api/v1/auth/otp/send"; const val VERIFY_PHONE = "/api/v1/auth/phone/bind" }`
- [x] T054 [P] Write `api-contracts/src/commonMain/kotlin/endpoints/PlayerEndpoints.kt`: `object PlayerEndpoints { const val ME = "/api/v1/players/me"; const val ME_PRIZES = "/api/v1/players/me/prizes"; const val ME_WALLET = "/api/v1/players/me/wallet"; const val ME_COUPONS = "/api/v1/players/me/coupons" }`
- [x] T055 [P] Write `api-contracts/src/commonMain/kotlin/endpoints/CampaignEndpoints.kt`, `DrawEndpoints.kt`, `TradeEndpoints.kt`, `ShippingEndpoints.kt`, `PaymentEndpoints.kt`, `AdminEndpoints.kt` with all REST path constants; `WebSocketEndpoints.kt` with `const val KUJI_ROOM = "/ws/kuji/{campaignId}"` and `const val QUEUE = "/ws/queue/{ticketBoxId}"`

### 2e. Server Domain Entities & Value Objects

- [x] T056 [P] Write `server/src/main/kotlin/domain/entities/Player.kt`: data class with all fields matching data-model §1; include `fun isVerified(): Boolean = phoneNumber != null && phoneVerifiedAt != null` and `fun canUsePlatform(): Boolean = isVerified() && isActive && deletedAt == null`
- [x] T057 [P] Write `server/src/main/kotlin/domain/entities/Campaign.kt` (KujiCampaign + UnlimitedCampaign as sealed hierarchy or separate data classes), `TicketBox.kt`, `DrawTicket.kt`, `Prize.kt` (PrizeDefinition), `PrizeInstance.kt` — each mirroring the data-model fields with Kotlin null safety
- [x] T058 [P] Write `server/src/main/kotlin/domain/entities/TradeListing.kt` (TradeOrder), `ExchangeOffer.kt` (ExchangeRequest + ExchangeRequestItem), `BuybackOrder.kt` (BuybackRecord), `ShippingOrder.kt`, `PaymentOrder.kt`, `WithdrawalRequest.kt`, `Coupon.kt` (Coupon + DiscountCode + PlayerCoupon), `SupportTicket.kt`, `AuditLog.kt` — all fields with Kotlin null safety
- [x] T059 [P] Write `server/src/main/kotlin/domain/entities/Queue.kt` and `QueueEntry.kt` matching data-model §8, §9
- [x] T060 [P] Write `server/src/main/kotlin/domain/valueobjects/PlayerId.kt` (`@JvmInline value class PlayerId(val value: UUID)`), `CampaignId.kt`, `PrizeId.kt` (PrizeDefinitionId + PrizeInstanceId), `Money.kt` (`value class Money(val points: Int) { init { require(points >= 0) } }`), `PointAmount.kt`, `PhoneNumber.kt` (E.164 validation in init block), `EmailAddress.kt`, `DrawProbability.kt` (`value class DrawProbability(val bps: Int) { init { require(bps in 0..1_000_000) }; fun toPercent() = bps.toDouble() / 10000.0 }`)

### 2f. Server Output Port Interfaces

- [x] T061 [P] Write `server/src/main/kotlin/application/ports/output/IPlayerRepository.kt`: interface with `findById(id: PlayerId): Player?`, `findByOAuth(provider, subject): Player?`, `findByPhone(phone: PhoneNumber): Player?`, `save(player: Player): Player`, `updateBalance(id, drawPointsDelta, revenuePointsDelta, expectedVersion): Boolean`, `findAll(pageable): Page<Player>`
- [x] T062 [P] Write `server/src/main/kotlin/application/ports/output/ICampaignRepository.kt`: interface with `findKujiById(id): KujiCampaign?`, `findUnlimitedById(id): UnlimitedCampaign?`, `findActiveKujiCampaigns(): List<KujiCampaign>`, `findActiveUnlimitedCampaigns(): List<UnlimitedCampaign>`, `saveKuji(campaign): KujiCampaign`, `saveUnlimited(campaign): UnlimitedCampaign`, `updateKujiStatus(id, status)`, `updateUnlimitedStatus(id, status)`
- [x] T063 [P] Write `server/src/main/kotlin/application/ports/output/ITicketBoxRepository.kt`: `findById(id): TicketBox?`, `findByCampaignId(campaignId): List<TicketBox>`, `decrementRemainingTickets(id, expectedRemaining): Boolean`, `save(box): TicketBox`; and `IDrawRepository.kt`: `findTicketById(id): DrawTicket?`, `findAvailableTickets(boxId): List<DrawTicket>`, `markDrawn(ticketId, playerId, prizeInstanceId, at): DrawTicket`, `findTicketsByBox(boxId): List<DrawTicket>`
- [x] T064 [P] Write `server/src/main/kotlin/application/ports/output/IPrizeRepository.kt`: `findDefinitionById(id): PrizeDefinition?`, `findDefinitionsByCampaign(campaignId, type): List<PrizeDefinition>`, `findInstanceById(id): PrizeInstance?`, `findInstancesByOwner(ownerId, state nullable): List<PrizeInstance>`, `saveInstance(instance): PrizeInstance`, `updateInstanceState(id, newState, expectedState): Boolean`, `transferOwnership(instanceId, newOwnerId, newState): PrizeInstance`
- [x] T065 [P] Write `server/src/main/kotlin/application/ports/output/ITradeRepository.kt`, `IExchangeRepository.kt`, `IBuybackRepository.kt`, `IShippingRepository.kt` — each with standard CRUD + state-query methods relevant to their domain
- [x] T066 [P] Write `server/src/main/kotlin/application/ports/output/IPaymentGateway.kt`: `suspend fun createPaymentIntent(order: PaymentOrder): PaymentIntentResult`, `suspend fun verifyWebhook(payload: String, signature: String): PaymentWebhookResult`; `IWithdrawalGateway.kt`: `suspend fun initiateTransfer(request: WithdrawalRequest): TransferResult`
- [x] T067 [P] Write `server/src/main/kotlin/application/ports/output/ICouponRepository.kt`, `ILeaderboardRepository.kt`, `ISupportRepository.kt`, `INotificationService.kt` (`suspend fun sendPush(playerId, payload)`), `IStorageService.kt` (`suspend fun upload(key, bytes, contentType): String`), `IFeatureFlagRepository.kt` (`fun isEnabled(key, context): Boolean`), `IAuditRepository.kt` (`fun record(log: AuditLog)`), `IOutboxRepository.kt` (`fun enqueue(event: DomainEvent)`, `fun fetchPending(limit): List<OutboxEvent>`, `fun markProcessed(id)`)

### 2g. Server Exposed Table Definitions

- [x] T068 [P] Write `server/src/main/kotlin/infrastructure/persistence/tables/PlayersTable.kt`: Exposed `object PlayersTable : Table("players")` with all columns matching V001 migration; define column types using `uuid("id")`, `varchar("nickname", 64)`, `enumerationByName("oauth_provider", ...)`, etc.
- [x] T069 [P] Write `server/src/main/kotlin/infrastructure/persistence/tables/` for: `WalletsTable.kt` (draw_point_transactions + revenue_point_transactions), `CampaignsTable.kt` (kuji_campaigns + unlimited_campaigns + ticket_boxes + draw_tickets), `PrizesTable.kt` (prize_definitions + prize_instances), `QueuesTable.kt` (queues + queue_entries), `TradesTable.kt` (trade_orders + exchange_requests + exchange_request_items), `ShippingOrdersTable.kt`, `PaymentsTable.kt` (payment_orders + withdrawal_requests), `CouponsTable.kt` (coupons + discount_codes + player_coupons), `SupportTable.kt` (support_tickets + support_ticket_messages), `AuditTable.kt` (audit_logs + outbox_events + refresh_token_families + feature_flags), `StaffTable.kt`

### 2h. Server Repository Implementations

- [x] T070 [P] Write `server/src/main/kotlin/infrastructure/persistence/repositories/PlayerRepositoryImpl.kt`: implements `IPlayerRepository` using Exposed DSL; `updateBalance` uses optimistic locking via `UPDATE players SET draw_points_balance = draw_points_balance + ?, version = version + 1 WHERE id = ? AND version = ?` and throws `OptimisticLockException` if 0 rows updated
- [x] T071 [P] Write `CampaignRepositoryImpl.kt`, `DrawRepositoryImpl.kt`, `TradeRepositoryImpl.kt`, `ExchangeRepositoryImpl.kt`, `BuybackRepositoryImpl.kt`, `ShippingRepositoryImpl.kt`, `CouponRepositoryImpl.kt`, `LeaderboardRepositoryImpl.kt`, `SupportRepositoryImpl.kt`, `AuditRepositoryImpl.kt`, `OutboxRepositoryImpl.kt`, `FeatureFlagRepositoryImpl.kt` — each in `server/src/main/kotlin/infrastructure/persistence/repositories/`; implement their respective output port interfaces using Exposed DSL transactions

### 2i. Server Infrastructure: Redis, Storage, Auth

- [x] T072 Write `server/src/main/kotlin/infrastructure/external/redis/RedisClient.kt`: configure Lettuce or Kreds connection pool from `application.conf`; write `DistributedLock.kt` implementing Redis SET NX EX lock/unlock pattern with Lua script for atomic unlock; write `RedisPubSub.kt` wrapping subscribe/publish for WebSocket fanout
- [x] T073 [P] Write `server/src/main/kotlin/infrastructure/external/storage/S3StorageService.kt`: implements `IStorageService`; uses AWS SDK v2 or MinIO Java client configured from `application.conf`; `upload` returns CDN URL
- [x] T074 [P] Write `server/src/main/kotlin/infrastructure/external/push/FirebaseNotificationService.kt`: implements `INotificationService`; initializes Firebase Admin SDK; `sendPush` calls FCM with `PlayerDto`-linked FCM token
- [x] T075 Write `server/src/main/kotlin/application/services/TokenService.kt`: `fun createTokenPair(playerId): TokenPair`, `fun verifyAccessToken(token): PlayerId?`, `fun rotateRefreshToken(familyToken, presentedToken): TokenPair` (implements family-level revocation: if presented token != current_token_hash, revoke entire family and throw `TokenReplayException`), `fun revokeFamily(familyToken)`; uses JWT (nimbus-jose-jwt or kotlin-jwt) with HS256/RS256 from config
- [x] T076 Write `server/src/main/kotlin/api/plugins/Security.kt`: install `Authentication { bearer { validate { token -> TokenService.verifyAccessToken(token)?.let { JWTPrincipal(it) } } } }`; write `server/src/main/kotlin/api/plugins/Serialization.kt` installing ContentNegotiation with kotlinx.serialization JSON; write `CORS.kt`, `RateLimit.kt`, `RequestValidation.kt`, `StatusPages.kt` (maps domain exceptions to HTTP status codes with `ErrorResponse` DTO), `WebSockets.kt`, `Monitoring.kt` (OpenTelemetry + Micrometer setup)
- [x] T077 Write `server/src/main/kotlin/api/plugins/Routing.kt`: registers all route files; write `server/src/main/kotlin/infrastructure/di/DatabaseModule.kt` (HikariCP DataSource + Flyway migration runner + Exposed Database.connect), `RepositoryModule.kt`, `UseCaseModule.kt`, `ServiceModule.kt`, `ExternalModule.kt`, `WebSocketModule.kt` — all as Koin modules; write `server/src/main/kotlin/Application.kt` calling `startKoin { modules(...) }` then `embeddedServer(...)`

### 2j. Server Outbox & Feature Flags

- [x] T078 Write `server/src/main/kotlin/application/events/DomainEvent.kt`: sealed class hierarchy covering all domain events: `DrawCompleted`, `PrizeTransferred`, `TradeCompleted`, `ExchangeCompleted`, `BuybackCompleted`, `ShippingStatusChanged`, `PaymentConfirmed`, `WithdrawalStatusChanged`, `SupportTicketReplied`
- [x] T079 Write `server/src/main/kotlin/application/events/OutboxWorker.kt`: Kotlin coroutine `CoroutineScope(Dispatchers.IO)` loop polling `IOutboxRepository.fetchPending(100)` every 5 seconds, dispatching to per-event `handlers/` (push notification, webhook, leaderboard update); implement at-least-once delivery with retry backoff up to `max_attempts`
- [x] T080 Write `server/src/main/kotlin/infrastructure/external/FeatureFlagRepositoryImpl.kt`: implements `IFeatureFlagRepository`; caches flag state in-memory with 30s TTL (fulfilling FR-087 <30s propagation); `isEnabled(key, context)` evaluates `GLOBAL`, `PLATFORM`, `PLAYER_GROUP`, `PERCENTAGE` target types

---

## Phase 3: US10 — 帳戶與點數管理

> Note: Spec priority is P7 but implemented first as auth/account is a prerequisite for all other user stories.

### 3a. Server — Auth & Player Use Cases

- [x] T081 [US10] Write `server/src/main/kotlin/application/ports/input/auth/ILoginUseCase.kt`, `IRefreshTokenUseCase.kt`, `ILogoutUseCase.kt`, `ISendOtpUseCase.kt`, `IBindPhoneUseCase.kt` use case interfaces
- [x] T082 [US10] Write `server/src/main/kotlin/application/usecases/auth/LoginUseCase.kt`: accepts `LoginRequest`; calls OAuth provider token verification (Google/Apple/LINE JWKS verification); finds or creates `Player` by `(oauth_provider, oauth_subject)`; if new player, creates with `is_active=false` (pending phone binding); issues `TokenPair` via `TokenService.createTokenPair`; records `AuditLog`
- [x] T083 [US10] Write `server/src/main/kotlin/application/usecases/auth/SendOtpUseCase.kt`: rate-limits per phone (Redis, max 5/hour); generates 6-digit OTP; stores in Redis with 5-minute TTL keyed `otp:{phone}:{hash}`; calls SMS gateway (stub interface `ISmsService`)
- [x] T084 [US10] Write `server/src/main/kotlin/application/usecases/auth/BindPhoneUseCase.kt`: verifies OTP from Redis; checks `IPlayerRepository.findByPhone` to enforce uniqueness (throws `PhoneAlreadyBoundException` if taken); updates `Player.phoneNumber`, `phoneVerifiedAt`, `isActive=true`; records `AuditLog`
- [x] T085 [US10] Write `server/src/main/kotlin/application/usecases/auth/RefreshTokenUseCase.kt`: calls `TokenService.rotateRefreshToken`; on `TokenReplayException` returns 401 with family revoked; on success returns new `TokenPair`
- [x] T086 [US10] Write `server/src/main/kotlin/application/usecases/auth/LogoutUseCase.kt`: calls `TokenService.revokeFamily(familyToken)` derived from presented refresh token
- [x] T087 [US10] Write `server/src/main/kotlin/application/ports/input/player/IGetPlayerProfileUseCase.kt`, `IUpdatePlayerProfileUseCase.kt`; implement `GetPlayerProfileUseCase.kt` returning `PlayerDto` mapped from `Player` entity; implement `UpdatePlayerProfileUseCase.kt` validating nickname length (1-64 chars), locale format (BCP-47)
- [x] T088 [US10] Write `server/src/main/kotlin/application/usecases/payment/CreatePaymentOrderUseCase.kt`: validates points package exists and is active (fetched from config/DB); creates `PaymentOrder` in PENDING state; calls `IPaymentGateway.createPaymentIntent`; returns `PaymentIntentDto`
- [x] T089 [US10] Write `server/src/main/kotlin/application/usecases/payment/ConfirmPaymentWebhookUseCase.kt`: idempotent — checks `PaymentOrder.status != PAID` before proceeding; calls `IPaymentGateway.verifyWebhook`; in single DB transaction: sets `PaymentOrder.status = PAID`, increments `Player.draw_points_balance`, inserts `DrawPointTransaction(PURCHASE_CREDIT)`; enqueues `PaymentConfirmed` outbox event
- [x] T090 [US10] Write `server/src/main/kotlin/api/routes/AuthRoutes.kt`: POST `/api/v1/auth/login`, POST `/api/v1/auth/refresh`, POST `/api/v1/auth/logout`, POST `/api/v1/auth/otp/send`, POST `/api/v1/auth/phone/bind`; write `PlayerRoutes.kt`: GET `/api/v1/players/me`, PATCH `/api/v1/players/me`, GET `/api/v1/players/me/wallet`; write `PaymentRoutes.kt`: GET `/api/v1/payment/packages`, POST `/api/v1/payment/orders`, POST `/api/v1/payment/webhook/{gateway}`
- [x] T091 [US10] Write `server/src/main/kotlin/api/mappers/PlayerMappers.kt`: extension functions `Player.toDto(): PlayerDto`, `PlayerDto.toDomain()`, etc.

### 3b. Mobile — Auth Screens

- [x] T092 [US10] Write `mobile/shared/src/commonMain/kotlin/data/remote/AuthRemoteDataSource.kt`: Ktor Client calls to `AuthEndpoints.*`; write `AuthRepositoryImpl.kt` wrapping remote calls + `AuthTokenStore.kt` (DataStore encrypted storage for access/refresh tokens)
- [x] T093 [US10] Write `mobile/shared/src/commonMain/kotlin/domain/usecases/LoginUseCase.kt` (client-side): orchestrates `AuthRemoteDataSource.login` + store tokens + return player; write `BindPhoneUseCase.kt` (client-side)
- [x] T094 [US10] Write `mobile/composeApp/src/commonMain/kotlin/viewmodels/auth/AuthViewModel.kt`: MVI with `AuthState` (Idle/Loading/NeedsPhoneBinding/Authenticated/Error), `AuthIntent` (Login(provider), SendOtp, BindPhone(phone, otp), Logout)
- [x] T095 [US10] Write `mobile/composeApp/src/commonMain/kotlin/screens/auth/LoginScreen.kt`: Compose screen with Google/Apple/LINE login buttons; write `PhoneBindingScreen.kt` with phone input + OTP input + resend timer (60s countdown)
- [x] T096 [US10] Write `mobile/composeApp/src/commonMain/kotlin/screens/wallet/WalletScreen.kt`: displays `drawPointsBalance` and `revenuePointsBalance` in separate cards; lists `DrawPointTransactionDto` and `RevenuePointTransactionDto` in separate tabs; top-up button navigates to payment WebView

### 3c. Web — Auth Pages

- [x] T097 [US10] Write `web/src/app/(auth)/login/page.tsx`: Next.js page with OAuth login buttons (Google/Apple/LINE); calls `POST /api/v1/auth/login`; on success stores tokens in httpOnly cookies via Next.js middleware; redirects to phone binding if needed
- [x] T098 [US10] Write `web/src/app/(auth)/phone-binding/page.tsx`: form for phone input + OTP verification; calls `POST /api/v1/auth/otp/send` then `POST /api/v1/auth/phone/bind`
- [x] T099 [US10] Write `web/src/app/wallet/page.tsx`: displays dual point balances; paginated transaction history with tabs for draw vs revenue points; top-up flow opens payment gateway redirect
- [x] T100 [US10] Write `web/src/stores/authStore.ts`: Zustand store with `player: PlayerDto | null`, `isAuthenticated`, `login`, `logout`, `refreshToken`; write `web/src/services/apiClient.ts`: axios/fetch wrapper with JWT bearer header injection + automatic token refresh on 401

---

## Checkpoint: Phase 3 Complete

Auth, phone binding, JWT rotation, dual wallet display, and payment top-up are all working end-to-end. Every subsequent phase depends on authenticated players with draw points.

---

## Phase 4: US1 — 玩家抽一番賞

### 4a. Server — Kuji Domain & Queue Services

- [x] T101 [US1] Write `server/src/main/kotlin/domain/services/KujiDrawDomainService.kt`: `fun validateTicketSelection(ticket: DrawTicket, session: Queue): Unit` (throws if ticket already DRAWN or session expired or player not active session holder); `fun validateMultiDraw(box: TicketBox, quantity: Int): Unit` (throws if remaining < quantity); `fun selectRandomTickets(availableTickets: List<DrawTicket>, quantity: Int): List<DrawTicket>` using `SecureRandom`
- [x] T102 [US1] Write `server/src/main/kotlin/application/services/KujiQueueService.kt`: `suspend fun joinQueue(playerId, ticketBoxId): QueueEntry` — uses `DistributedLock("queue:{boxId}")` to atomically insert `QueueEntry(WAITING)` and advance queue if idle; `suspend fun advanceQueue(ticketBoxId)` — sets next WAITING entry to ACTIVE, updates `Queue.activePlayerId`, `sessionStartedAt`, `sessionExpiresAt`; schedules coroutine timeout `delay(sessionSeconds * 1000)` calling `expireSession`; `suspend fun expireSession(ticketBoxId, queueEntryId)` — marks entry COMPLETED, calls `advanceQueue`; `suspend fun leaveQueue(playerId, ticketBoxId)` — marks entry ABANDONED if WAITING, or COMPLETED if ACTIVE then advances; `suspend fun switchBox(playerId, fromBoxId, toBoxId)` — leaves from queue, joins to queue atomically; broadcasts queue update via `RedisPubSub`
- [x] T103 [US1] Write `server/src/main/kotlin/application/ports/input/draw/IDrawKujiUseCase.kt`; implement `server/src/main/kotlin/application/usecases/draw/DrawKujiUseCase.kt`: 1) validates player is active session holder via `KujiQueueService`; 2) calls `KujiDrawDomainService.validateTicketSelection` or `validateMultiDraw`; 3) in single DB transaction: `DrawRepository.markDrawn`, create `PrizeInstance(HOLDING)`, debit `draw_points_balance` (with optimistic lock retry up to 3x), insert `DrawPointTransaction(KUJI_DRAW_DEBIT)`, decrement `TicketBox.remaining_tickets` (check -> 0 -> mark SOLD_OUT -> check all boxes -> mark Campaign SOLD_OUT), insert `AuditLog`; 4) enqueue `DrawCompleted` outbox event; 5) publish WebSocket event via `RedisPubSub`; 6) return `DrawResultDto`
- [x] T104 [US1] Write `server/src/main/kotlin/infrastructure/websocket/ConnectionManager.kt`: thread-safe `ConcurrentHashMap<String, MutableSet<WebSocketSession>>` keyed by `campaignId`; `fun register(campaignId, session)`, `fun unregister(campaignId, session)`, `suspend fun broadcast(campaignId, message)`; subscribe to Redis pub/sub channel `kuji:{campaignId}` and fan out to all local sessions
- [x] T105 [US1] Write `server/src/main/kotlin/infrastructure/websocket/KujiWebSocketHandler.kt`: handles WS connection at `/ws/kuji/{campaignId}`; on connect: registers session, sends full ticket board snapshot; subscribes to `kuji:{campaignId}` Redis channel; on draw event: broadcasts `TicketDrawnEvent(ticketPosition, grade, prizeName, photoUrl, drawnByNickname)` to all connected sessions; write `QueueWebSocketHandler.kt` for `/ws/queue/{ticketBoxId}`: broadcasts `QueueUpdateEvent(position, queueLength, estimatedWaitSeconds, activePlayerId)`
- [x] T106 [US1] Write `server/src/main/kotlin/api/routes/CampaignRoutes.kt`: GET `/api/v1/campaigns/kuji` (list active), GET `/api/v1/campaigns/kuji/{id}` (detail + boxes), GET `/api/v1/campaigns/kuji/{id}/boxes/{boxId}/tickets` (full ticket board); write `DrawRoutes.kt`: POST `/api/v1/draw/kuji` (authenticated, phone-verified guard), POST `/api/v1/draw/kuji/queue/join`, DELETE `/api/v1/draw/kuji/queue/leave`, POST `/api/v1/draw/kuji/queue/switch-box`

### 4b. Mobile — Kuji Screens

- [x] T107 [US1] Write `mobile/shared/src/commonMain/kotlin/data/remote/CampaignRemoteDataSource.kt`: fetch kuji campaigns, ticket board; write `DrawRemoteDataSource.kt`: draw API calls; write websocket clients `mobile/shared/src/commonMain/kotlin/data/websocket/KujiWebSocketClient.kt` (Ktor WS client connecting to `/ws/kuji/{campaignId}`, emitting `Flow<KujiRoomEvent>`), `QueueWebSocketClient.kt`
- [x] T108 [US1] Write `mobile/composeApp/src/commonMain/kotlin/viewmodels/campaign/KujiCampaignViewModel.kt`: MVI with `KujiCampaignState(campaign, boxes, selectedBox, tickets, queueEntry, sessionCountdown, isMyTurn)`; handles `JoinQueue`, `LeaveQueue`, `SelectTicket`, `MultiDraw(quantity)`, `SwitchBox`, `WebSocketTicketDrawn`, `SessionExpired` intents
- [x] T109 [US1] Write `mobile/composeApp/src/commonMain/kotlin/screens/campaign/CampaignListScreen.kt`: LazyColumn of `KujiCampaignDto` cards showing title, cover image (Coil 3), price, status badge; write `KujiBoardScreen.kt`: full-screen ticket grid (LazyVerticalGrid) showing each ticket slot — available slots show number, drawn slots show prize photo + grade overlay + drawer nickname; bottom bar shows queue position or "Join Queue" button
- [x] T110 [US1] Write `mobile/composeApp/src/commonMain/kotlin/screens/campaign/QueueScreen.kt`: queue position display, countdown timer, estimated wait; animated "Your turn!" notification; multi-draw mode selector (1/3/5/12) with point cost preview; write `mobile/composeApp/src/commonMain/kotlin/components/KujiBoard.kt`: reusable Compose component with animated ticket reveal

### 4c. Web — Kuji Pages

- [x] T111 [US1] Write `web/src/app/campaigns/page.tsx`: campaign list page with kuji/unlimited tabs; campaign card components showing cover art, price, remaining tickets; write `web/src/app/campaigns/[id]/page.tsx`: kuji campaign detail with ticket box tabs
- [x] T112 [US1] Write `web/src/app/campaigns/[id]/board/page.tsx`: interactive ticket board grid; each cell is a `TicketCell` component (available = clickable number, drawn = prize photo + grade chip); real-time updates via `web/src/services/kujiWebSocket.ts` (WebSocket client with reconnect logic); write `web/src/features/kuji/useKujiBoard.ts` custom hook managing WS connection and board state
- [x] T113 [US1] Write `web/src/app/campaigns/[id]/queue/page.tsx`: queue status page; join/leave queue buttons; countdown timer; multi-draw selector; write `web/src/stores/kujiStore.ts`: Zustand store for kuji session state (queueEntry, sessionExpiry, currentBoard)

---

## Checkpoint: Phase 4 Complete

One-番賞 full draw loop working: browse campaigns, view ticket board, join queue, draw (single/multi), real-time sync to all spectators, prize lands in inventory.

---

## Phase 5: US2 — 玩家抽無限賞

### 5a. Server — Unlimited Draw

- [x] T114 [US2] Write `server/src/main/kotlin/domain/services/UnlimitedDrawDomainService.kt`: `fun spin(definitions: List<PrizeDefinition>): PrizeDefinition` — builds CDF from `probability_bps` values (validated sum == 1_000_000 at campaign activation); uses `SecureRandom.nextInt(1_000_000)` and binary search on CDF; `fun validateProbabilitySum(definitions): Boolean`
- [x] T115 [US2] Write `server/src/main/kotlin/application/ports/input/draw/IDrawUnlimitedUseCase.kt`; implement `DrawUnlimitedUseCase.kt`: 1) checks Redis sliding window rate limit `ZRANGEBYSCORE unlimited:ratelimit:{playerId}:{campaignId} (now-1s) now` — rejects if count >= `campaign.rateLimitPerSecond`; 2) calls `UnlimitedDrawDomainService.spin` using definitions at time of draw (atomic snapshot from cache, not DB, to handle live probability updates per FR-021b); 3) in DB transaction: create `PrizeInstance(HOLDING)`, debit draw points, insert `DrawPointTransaction(UNLIMITED_DRAW_DEBIT)`, insert `AuditLog`; 4) enqueue `DrawCompleted` outbox event; 5) return `UnlimitedDrawResultDto`
- [x] T116 [US2] Write `server/src/main/kotlin/api/routes/` additions for unlimited campaigns: GET `/api/v1/campaigns/unlimited`, GET `/api/v1/campaigns/unlimited/{id}`; add to DrawRoutes: POST `/api/v1/draw/unlimited`

### 5b. Mobile — Unlimited Draw Screen

- [x] T117 [US2] Write `mobile/composeApp/src/commonMain/kotlin/viewmodels/draw/UnlimitedDrawViewModel.kt`: MVI state `UnlimitedDrawState(campaign, prizeDefinitions, lastResult nullable, isDrawing, pointBalance)`; intents `Draw(quantity, playerCouponId nullable)`, `LoadCampaign(id)`
- [x] T118 [US2] Write `mobile/composeApp/src/commonMain/kotlin/screens/campaign/UnlimitedDrawScreen.kt`: campaign header with prize probability table (grade, probability%, photo); large "Draw" button with point cost; result reveal triggers animation composable; continuous draw mode with rapid-fire results list

### 5c. Web — Unlimited Draw Page

- [x] T119 [US2] Write `web/src/app/campaigns/unlimited/[id]/page.tsx`: unlimited campaign page; probability table with prize images and percentages; draw button; result display; write `web/src/features/unlimited/useUnlimitedDraw.ts` hook handling draw state and optimistic UI

---

## Phase 6: US3 — 我的賞品庫與寄送

### 6a. Server — Prize Inventory & Shipping

- [x] T120 [US3] Write `server/src/main/kotlin/application/ports/input/player/IGetPrizeInventoryUseCase.kt`; implement `GetPrizeInventoryUseCase.kt`: returns `List<PrizeInstance>` for `owner_id = playerId AND state IN (HOLDING, TRADING, EXCHANGING, PENDING_SHIPMENT, SHIPPED) AND deleted_at IS NULL`; joins `PrizeDefinition` for grade/name/photos
- [x] T121 [US3] Write `server/src/main/kotlin/application/ports/input/shipping/ICreateShippingOrderUseCase.kt`, `ICancelShippingOrderUseCase.kt`, `IConfirmDeliveryUseCase.kt`; implement `CreateShippingOrderUseCase.kt`: validates prize state is `HOLDING`; in DB transaction: creates `ShippingOrder(PENDING_SHIPMENT)`, updates `PrizeInstance.state = PENDING_SHIPMENT`; enqueues outbox event
- [x] T122 [US3] Write `server/src/main/kotlin/application/usecases/shipping/CancelShippingOrderUseCase.kt`: validates `ShippingOrder.status == PENDING_SHIPMENT` (else throw `CancellationNotAllowedException`); in transaction: sets `ShippingOrder.status = CANCELLED`, `PrizeInstance.state = HOLDING`
- [x] T123 [US3] Write admin-side shipping use cases: `server/src/main/kotlin/application/usecases/shipping/FulfillShippingOrderUseCase.kt` (operator fills tracking number, sets SHIPPED, records `fulfilled_by_staff_id`, enqueues `ShippingStatusChanged` outbox for push notification); `ConfirmDeliveryUseCase.kt` (player confirms or scheduled job auto-confirms after N days)
- [x] T124 [US3] Add prize routes `server/src/main/kotlin/api/routes/PlayerRoutes.kt`: GET `/api/v1/players/me/prizes`, GET `/api/v1/players/me/prizes/{id}`; write `ShippingRoutes.kt`: POST `/api/v1/shipping/orders`, DELETE `/api/v1/shipping/orders/{id}`, POST `/api/v1/shipping/orders/{id}/confirm-delivery`; add admin route `admin/src/app/shipping/` entries in `AdminRoutes.kt`: GET `/api/v1/admin/shipping/orders` (paginated, filterable by status), PATCH `/api/v1/admin/shipping/orders/{id}/ship`

### 6b. Mobile — My Prizes & Shipping

- [x] T125 [US3] Write `mobile/composeApp/src/commonMain/kotlin/viewmodels/prize/PrizeInventoryViewModel.kt`: MVI state `PrizeInventoryState(prizes: List<PrizeInstance>, isLoading)`; write `mobile/composeApp/src/commonMain/kotlin/screens/prize/MyPrizesScreen.kt`: LazyVerticalGrid of prize cards; filter tabs (All / Holding / In Transit); write `PrizeDetailScreen.kt`: large product image (zoomable with gesture), grade chip, source campaign, acquisition method; action buttons "List for Sale" / "Official Buyback" / "Request Shipping" conditionally shown based on current state
- [x] T126 [US3] Write `mobile/composeApp/src/commonMain/kotlin/screens/shipping/ShippingFormScreen.kt`: address form with fields for recipient name, phone, address lines, city, postal code, country picker; submit calls `CreateShippingOrderUseCase`; write `ShippingTrackingScreen.kt`: timeline view showing PENDING → SHIPPED (with tracking number link) → DELIVERED

### 6c. Web — My Prizes & Shipping

- [x] T127 [US3] Write `web/src/app/prizes/page.tsx`: prize inventory grid with state filter tabs; `PrizeCard` component showing image, grade badge, source campaign; write `web/src/app/prizes/[id]/page.tsx`: prize detail with image gallery, action buttons
- [x] T128 [US3] Write `web/src/app/shipping/new/page.tsx`: shipping address form with validation; write `web/src/app/shipping/[id]/page.tsx`: shipping order tracking page

### 6d. Admin — Shipping Management

- [x] T129 [US3] Write `admin/src/app/shipping/page.tsx`: data table of all shipping orders with columns: order ID, player nickname, prize name, status, created date; filter by status; write `admin/src/app/shipping/[id]/page.tsx`: order detail with fulfill form (tracking number + carrier input) and "Mark Shipped" button

---

## Checkpoint: Phase 6 Complete

Players can view prize inventory, request shipping, and track delivery. Admin can fulfill orders.

---

## Phase 7: US4 — 玩家之間賞品交易

### 7a. Server — Marketplace

- [x] T130 [US4] Write `server/src/main/kotlin/application/ports/input/trade/ICreateTradeListingUseCase.kt`, `IPurchaseTradeListingUseCase.kt`, `ICancelTradeListingUseCase.kt`
- [x] T131 [US4] Implement `CreateTradeListingUseCase.kt`: validates `PrizeInstance.state == HOLDING` and `instance.ownerId == playerId` and `listPrice > 0`; reads current `fee_rate_bps` from platform config (stored in feature_flags or a separate platform_config table); in DB transaction: creates `TradeOrder(LISTED, list_price, fee_rate_bps)`, sets `PrizeInstance.state = TRADING`; records `AuditLog`
- [x] T132 [US4] Implement `PurchaseTradeListingUseCase.kt`: validates buyer != seller (throw `SelfPurchaseException`); validates `TradeOrder.status == LISTED`; uses `DistributedLock("trade:{listingId}")` to prevent concurrent purchases; in single DB transaction: 1) debit buyer `draw_points_balance` by `list_price` with optimistic lock retry; 2) compute `fee_amount = ROUND(list_price * fee_rate_bps / 10000)`, `seller_proceeds = list_price - fee_amount`; 3) credit seller `revenue_points_balance` by `seller_proceeds`; 4) insert `DrawPointTransaction(TRADE_PURCHASE_DEBIT)` for buyer; 5) insert `RevenuePointTransaction(TRADE_SALE_CREDIT)` for seller; 6) transfer `PrizeInstance` ownership (new owner = buyer, state = HOLDING, acquisition_method = TRADE_PURCHASE, source_trade_order_id set); 7) update `TradeOrder.status = COMPLETED`, set `buyer_id`, `fee_amount`, `seller_proceeds`, `completed_at`; 8) enqueue `TradeCompleted` outbox event
- [x] T133 [US4] Implement `CancelTradeListingUseCase.kt`: validates seller == requester and `status == LISTED`; in DB transaction: sets `TradeOrder.status = CANCELLED`, `PrizeInstance.state = HOLDING`
- [x] T134 [US4] Write `server/src/main/kotlin/api/routes/TradeRoutes.kt`: GET `/api/v1/trade/listings` (paginated, filter by grade/price/campaign type), GET `/api/v1/trade/listings/{id}`, POST `/api/v1/trade/listings` (create), DELETE `/api/v1/trade/listings/{id}` (cancel), POST `/api/v1/trade/listings/{id}/purchase`

### 7b. Mobile — Marketplace

- [x] T135 [US4] Write `mobile/composeApp/src/commonMain/kotlin/viewmodels/trade/MarketplaceViewModel.kt`: state includes paginated listings, filter options; write `mobile/composeApp/src/commonMain/kotlin/screens/trade/MarketplaceScreen.kt`: list of `TradeListingDto` cards; filter bar (grade, price range, campaign type); write `ListingDetailScreen.kt`: prize photo, grade, seller nickname, price, "Buy" button with confirmation dialog
- [x] T136 [US4] Write `mobile/composeApp/src/commonMain/kotlin/screens/trade/CreateListingScreen.kt`: prize picker from inventory (only HOLDING state), price input with fee preview showing `proceeds = price * (1 - fee_rate)`; confirm flow

### 7c. Web — Marketplace

- [x] T137 [US4] Write `web/src/app/trade/page.tsx`: marketplace browse page with filter sidebar (grade, price range, source campaign type); listing grid; write `web/src/app/trade/[id]/page.tsx`: listing detail with buy confirmation; write `web/src/app/trade/new/page.tsx`: create listing form

---

## Phase 8: US5 — 玩家之間賞品交換

### 8a. Server — Exchange

- [x] T138 [US5] Write `server/src/main/kotlin/application/ports/input/exchange/ICreateExchangeRequestUseCase.kt`, `IRespondExchangeRequestUseCase.kt`, `ICancelExchangeRequestUseCase.kt`
- [x] T139 [US5] Implement `CreateExchangeRequestUseCase.kt`: checks `FeatureFlagRepository.isEnabled("exchange_feature")` (throws `FeatureDisabledException` if false); validates all offered prize instances are in `HOLDING` state and belong to initiator; validates recipient exists and is active; in DB transaction: creates `ExchangeRequest(PENDING)`, inserts `ExchangeRequestItem` rows for both sides, sets all initiator `PrizeInstance.state = EXCHANGING`; enqueues push notification outbox event to recipient
- [x] T140 [US5] Implement `RespondExchangeRequestUseCase.kt`: handles ACCEPT (atomic swap — transfer initiator items to recipient with `acquisition_method=EXCHANGE`, transfer recipient items to initiator, mark originals RECYCLED, status = COMPLETED), REJECT (restore initiator items to HOLDING, status = REJECTED), COUNTER_PROPOSE (creates new child `ExchangeRequest` with swapped roles, marks parent COUNTER_PROPOSED, locks recipient's offered items as EXCHANGING)
- [x] T141 [US5] Implement `CancelExchangeRequestUseCase.kt`: restores all EXCHANGING prize instances of the cancelling party back to HOLDING; sets request status = CANCELLED; write `server/src/main/kotlin/api/routes/ExchangeRoutes.kt`: GET `/api/v1/exchange/requests` (my requests), POST `/api/v1/exchange/requests`, POST `/api/v1/exchange/requests/{id}/respond`, DELETE `/api/v1/exchange/requests/{id}`

### 8b. Mobile — Exchange Flow

- [x] T142 [US5] Write `mobile/composeApp/src/commonMain/kotlin/screens/exchange/ExchangeOfferScreen.kt`: select other player's prize (from their public inventory), select own prizes to offer, optional message field, submit; write `ExchangeRequestDetailScreen.kt`: shows both sides' items with photos; accept/reject/counter-propose buttons; write `ExchangeCounterProposeScreen.kt`: prize re-selection UI

### 8c. Web — Exchange Pages

- [x] T143 [US5] Write `web/src/app/exchange/page.tsx`: my exchange requests (sent/received tabs); write `web/src/app/exchange/new/page.tsx`: create exchange offer flow; write `web/src/app/exchange/[id]/page.tsx`: request detail with respond actions

---

## Phase 9: US6 — 官方回收賞品

### 9a. Server — Buyback

- [x] T144 [US6] Write `server/src/main/kotlin/application/ports/input/buyback/IBuybackUseCase.kt`; implement `BuybackUseCase.kt`: validates `PrizeInstance.state == HOLDING`; validates `PrizeDefinition.buyback_enabled == true` (else throw `BuybackDisabledException`); snapshots `buyback_price` from definition at this instant; in DB transaction: creates `BuybackRecord(buyback_price)`, sets `PrizeInstance.state = RECYCLED` + `deleted_at = NOW()`, credits `revenue_points_balance` by snapshot price, inserts `RevenuePointTransaction(BUYBACK_CREDIT)`, inserts `AuditLog`; enqueues `BuybackCompleted` outbox event
- [x] T145 [US6] Write `server/src/main/kotlin/api/routes/BuybackRoutes.kt`: POST `/api/v1/prizes/{prizeInstanceId}/buyback`; GET `/api/v1/prizes/buyback-price/{prizeInstanceId}` (preview price without committing)

### 9b. Mobile & Web — Buyback

- [x] T146 [US6] Add "Official Buyback" action to `PrizeDetailScreen.kt` (mobile): shows buyback price in revenue points, confirmation dialog; add to `web/src/app/prizes/[id]/page.tsx`: buyback button with price preview and confirmation modal

---

## Phase 10: US11 — 雙點數系統與現金提領

### 10a. Server — Dual Points & Withdrawal

- [x] T147 [US11] Write `server/src/main/kotlin/application/services/PointsLedgerService.kt`: `fun debitDrawPoints(playerId, amount, txType, referenceId): DrawPointTransaction` — wraps DB transaction with optimistic lock retry (version check on Player row, up to 5 retries with exponential backoff), inserts transaction, decrements balance; `fun creditDrawPoints(...)`: similar for credits; `fun debitRevenuePoints(...)`, `fun creditRevenuePoints(...)`: same pattern for revenue points; throws `InsufficientBalanceException` if balance would go negative
- [x] T148 [US11] Refactor `DrawKujiUseCase`, `DrawUnlimitedUseCase`, `PurchaseTradeListingUseCase`, `BuybackUseCase` to use `PointsLedgerService` for all balance mutations (replace any direct balance update code)
- [x] T149 [US11] Write `server/src/main/kotlin/application/ports/input/withdrawal/ICreateWithdrawalRequestUseCase.kt`, `IApproveWithdrawalUseCase.kt`, `IRejectWithdrawalUseCase.kt`; implement `CreateWithdrawalRequestUseCase.kt`: validates `pointsAmount > 0` and `player.revenuePointsBalance >= pointsAmount`; in DB transaction: debits `revenue_points_balance` via `PointsLedgerService.debitRevenuePoints`, inserts `WithdrawalRequest(PENDING_REVIEW)`, inserts `RevenuePointTransaction(WITHDRAWAL_DEBIT)`
- [x] T150 [US11] Implement `ApproveWithdrawalUseCase.kt` (staff only): sets `WithdrawalRequest.status = APPROVED`, records `reviewed_by_staff_id`; calls `IWithdrawalGateway.initiateTransfer`; on success sets `TRANSFERRED`; implement `RejectWithdrawalUseCase.kt`: sets status = REJECTED, credits back `revenue_points_balance` via `PointsLedgerService`, records reason; write `server/src/main/kotlin/api/routes/WithdrawalRoutes.kt`: POST `/api/v1/withdrawal/requests`, GET `/api/v1/withdrawal/requests` (player's own)

### 10b. Mobile & Web — Withdrawal Flow

- [x] T151 [US11] Write `mobile/composeApp/src/commonMain/kotlin/screens/wallet/WithdrawalScreen.kt`: revenue points balance display, bank account form (name, bank code, account number), amount input, submit with preview of TWD equivalent; write `web/src/app/wallet/withdraw/page.tsx`: same form as React page
- [x] T152 [US11] Write `admin/src/app/withdrawals/page.tsx`: paginated table of pending withdrawal requests; columns: player, points amount, fiat amount, bank info (masked), status, date; "Approve" and "Reject" action buttons with reason input for rejection

---

## Phase 11: US7 — 後台管理抽獎活動

### 11a. Server — Admin Campaign Use Cases

- [x] T153 [US7] Write `server/src/main/kotlin/application/ports/input/campaign/ICreateKujiCampaignUseCase.kt`, `IUpdateKujiCampaignUseCase.kt`, `IPublishCampaignUseCase.kt`, `ISuspendCampaignUseCase.kt`, `ICreateUnlimitedCampaignUseCase.kt`, `IUpdateUnlimitedProbabilityUseCase.kt`
- [x] T154 [US7] Implement `CreateKujiCampaignUseCase.kt`: creates `KujiCampaign(DRAFT)` + creates N `TicketBox` records; records `AuditLog(action="CAMPAIGN_CREATED")`; implement `AddTicketBoxUseCase.kt`: creates `TicketBox` with N `DrawTicket` rows (each with a `prize_definition_id`); validates every ticket has an assigned `PrizeDefinition` with at least one photo before saving (FR-020b)
- [x] T155 [US7] Implement `PublishCampaignUseCase.kt`: for kuji — validates all boxes configured (total_tickets == count of DrawTicket rows per box, all have prize definitions with photos); creates `Queue` row per TicketBox; sets status = ACTIVE; for unlimited — validates `SUM(probability_bps) == 1_000_000`; sets status = ACTIVE; records `AuditLog`
- [x] T156 [US7] Implement `UpdateUnlimitedProbabilityUseCase.kt`: atomic swap — in DB transaction: soft-delete old `PrizeDefinition` rows, insert new definitions, validate sum == 1_000_000; updates in-memory CDF cache; records `AuditLog(beforeValue={old probs}, afterValue={new probs})`; write admin campaign routes in `server/src/main/kotlin/api/routes/AdminRoutes.kt`: full CRUD for kuji and unlimited campaigns, ticket box editor, probability editor

### 11b. Admin Dashboard — Campaign Management

- [x] T157 [US7] Write `admin/src/app/campaigns/page.tsx`: campaign list table with type filter (kuji/unlimited), status filter, search; columns: title, type, status, price, created date, actions; write `admin/src/app/campaigns/new/kuji/page.tsx`: multi-step kuji creation wizard (step 1: basic info, step 2: ticket boxes, step 3: prize grid editor per box, step 4: preview)
- [x] T158 [US7] Write `admin/src/app/campaigns/[id]/tickets/page.tsx`: ticket grid editor for kuji box — drag-drop or form to assign prize definition to each ticket slot; bulk import via CSV upload; write `admin/src/app/campaigns/new/unlimited/page.tsx`: unlimited campaign form with probability editor: list of prize grades each with probability % input; live sum validation showing "Must total 100%"
- [x] T159 [US7] Write `admin/src/app/campaigns/[id]/page.tsx`: campaign detail with status badge and status transition buttons (Publish / Suspend / Reactivate); preview mode for kuji board (read-only player view); probability chart for unlimited campaigns

---

## Phase 12: US8 — 後台管理回收價格與手續費

### 12a. Server — Pricing Management

- [x] T160 [US8] Write `server/src/main/kotlin/application/ports/input/admin/IUpdateBuybackPriceUseCase.kt`, `IUpdateTradeFeeRateUseCase.kt`; implement `UpdateBuybackPriceUseCase.kt`: validates `buybackPrice >= 0`; updates `PrizeDefinition.buyback_price` (and optionally `buyback_enabled`); records `AuditLog(beforeValue, afterValue)`; implement `UpdateTradeFeeRateUseCase.kt`: stores platform fee rate in feature_flags table or a dedicated `platform_config` table keyed `trade_fee_rate_bps`; records `AuditLog`
- [x] T161 [US8] Add admin routes: PATCH `/api/v1/admin/prizes/definitions/{id}/buyback-price`, PATCH `/api/v1/admin/platform/trade-fee-rate`

### 12b. Admin — Pricing Pages

- [x] T162 [US8] Write `admin/src/app/prizes/page.tsx`: prize definitions table grouped by campaign; inline editable buyback price and buyback_enabled toggle; write `admin/src/app/settings/pricing/page.tsx`: platform fee rate configuration input with current rate display and "effective immediately" warning; audit trail of recent price changes

---

## Phase 13: US9 — 客服系統整合

### 13a. Server — Support Tickets & LINE Integration

- [x] T163 [US9] Write `server/src/main/kotlin/application/ports/input/support/ICreateTicketUseCase.kt`, `IReplyTicketUseCase.kt`, `ICloseTicketUseCase.kt`, `IGetTicketDetailUseCase.kt`
- [x] T164 [US9] Implement `CreateTicketUseCase.kt`: creates `SupportTicket(OPEN)` and inserts first `TicketMessage(sender_type=PLAYER)`; enqueues push notification to staff; implement `ReplyTicketUseCase.kt`: inserts `TicketMessage`; updates `ticket.status = IN_PROGRESS` if staff replies; enqueues push notification outbox event to the other party
- [x] T165 [US9] Write `server/src/main/kotlin/infrastructure/external/line/LineMessagingAdapter.kt`: implements LINE Messaging API webhook handling; parses `LineWebhookPayload`; on incoming message from LINE user: finds `SupportTicket` by `line_thread_id` (or creates new ticket); calls `ReplyTicketUseCase`; on staff reply: calls LINE reply message API to send response back to LINE user
- [x] T166 [US9] Write `server/src/main/kotlin/api/routes/SupportRoutes.kt`: POST `/api/v1/support/tickets`, GET `/api/v1/support/tickets` (player's own), GET `/api/v1/support/tickets/{id}`, POST `/api/v1/support/tickets/{id}/reply`, POST `/api/v1/support/tickets/{id}/close`; POST `/api/v1/webhooks/line` (LINE webhook endpoint, validates signature)

### 13b. Mobile & Web — Support UI

- [x] T167 [US9] Write `mobile/composeApp/src/commonMain/kotlin/screens/support/SupportTicketListScreen.kt`: list of player's tickets with status badges; write `SupportTicketDetailScreen.kt`: chat-style message thread; compose reply field at bottom; write `CreateTicketScreen.kt`: category picker + subject + body
- [x] T168 [US9] Write `web/src/app/support/page.tsx`: ticket list; write `web/src/app/support/[id]/page.tsx`: ticket chat thread; write `web/src/app/support/new/page.tsx`: create ticket form
- [x] T169 [US9] Write `admin/src/app/support/page.tsx`: staff view of all tickets filterable by status/category/player; write `admin/src/app/support/[id]/page.tsx`: ticket detail with player info panel (draw history, trade history, wallet balance), reply form, close button with satisfaction score

---

## Phase 14: US12 — 權限管理與操作紀錄

### 14a. Server — RBAC & Audit

- [x] T170 [US12] Write `server/src/main/kotlin/api/plugins/Authorization.kt`: Ktor plugin defining RBAC middleware; `fun Route.requireRole(vararg roles: StaffRole)` extension function that checks JWT principal's staff role; define role hierarchy: `OWNER` > `ADMIN` > `OPERATOR` > `CUSTOMER_SERVICE`; player tokens use separate auth guard
- [x] T171 [US12] Apply `requireRole` guards to all admin routes: `AdminRoutes` (campaign CRUD) requires `OPERATOR` or above; pricing/fee routes require `ADMIN` or above; staff management routes require `ADMIN` or above; audit log and report routes require `OWNER` or above; support routes require `CUSTOMER_SERVICE` or above
- [x] T172 [US12] Write `server/src/main/kotlin/application/usecases/admin/CreateStaffUseCase.kt`, `UpdateStaffRoleUseCase.kt`, `DeactivateStaffUseCase.kt`; write `server/src/main/kotlin/api/routes/AdminRoutes.kt` additions: GET/POST/PATCH/DELETE `/api/v1/admin/staff`, GET `/api/v1/admin/audit-logs` (paginated, filterable by actor, action, date range, entity type)
- [x] T173 [US12] Write player activity tracking: add `AuditLog` recording to all player-facing use cases (DrawKuji, DrawUnlimited, PurchaseTradeListing, CreateTradeListing, Buyback, CreateShippingOrder, CreateWithdrawalRequest) — each records `actor_type=PLAYER`, `player_id`, `action`, relevant entity ids

### 14b. Admin — Staff & Audit Pages

- [x] T174 [US12] Write `admin/src/app/staff/page.tsx`: staff management table (name, email, role, status, last login); invite new staff form; role assignment dropdown (scoped: admin can assign up to ADMIN, owner can assign OWNER); write `admin/src/app/audit/page.tsx`: audit log viewer with filters (actor, action type, date range, entity type); expandable rows showing before/after JSON values

---

## Phase 15: US13 — 優惠券與折扣碼

### 15a. Server — Coupon System

- [x] T175 [US13] Write `server/src/main/kotlin/application/ports/input/coupon/ICreateCouponUseCase.kt`, `IRedeemDiscountCodeUseCase.kt`, `IApplyCouponToDrawUseCase.kt`; implement `CreateCouponUseCase.kt` (admin): creates `Coupon` + optional `DiscountCode` records; validates `discount_rate_bps` in (0, 10000]; validates `valid_from < valid_until`
- [x] T176 [US13] Implement `RedeemDiscountCodeUseCase.kt`: finds `DiscountCode` by code string; validates `is_active`, `redeemed_count < redemption_limit`; validates `Coupon.issued_count < total_supply` (if supply-limited); atomically increments `redeemed_count` and `issued_count`; creates `PlayerCoupon` for the player
- [x] T177 [US13] Implement coupon application in draw use cases: in `DrawKujiUseCase` and `DrawUnlimitedUseCase`, if `playerCouponId` is provided: validate `PlayerCoupon` exists, `is_used = false`, not expired, `applicable_type` matches; compute `discounted_price = ROUND(original_price * (10000 - discount_rate_bps) / 10000)`; in DB transaction: mark `PlayerCoupon.is_used = true`, `used_at = NOW()`; charge `discounted_price` instead of full price; set `discount_amount = original - discounted` in `DrawPointTransaction`
- [x] T178 [US13] Write `server/src/main/kotlin/api/routes/CouponRoutes.kt`: GET `/api/v1/players/me/coupons`, POST `/api/v1/coupons/redeem` (input discount code); admin: GET/POST/PATCH `/api/v1/admin/coupons`

### 15b. Mobile & Web — Coupon UI

- [x] T179 [US13] Add coupon selector to draw confirmation flow in `KujiBoardScreen.kt` and `UnlimitedDrawScreen.kt` (mobile): "Apply Coupon" bottom sheet showing available valid coupons; selected coupon shows discounted price; add same to `web/src/app/campaigns/[id]/board/page.tsx` and unlimited draw page
- [x] T180 [US13] Write `admin/src/app/coupons/page.tsx`: coupon list with issued/used counts; write `admin/src/app/coupons/new/page.tsx`: coupon creation form with discount rate, validity, supply limit, applicable type, and optional discount code string

---

## Phase 16: US14 — 開獎動畫

### 16a. Animation Architecture

- [x] T181 [US14] Write `server/src/main/kotlin/application/usecases/admin/ManageAnimationModeUseCase.kt`: enables/disables animation mode flags (stored as feature flags keyed `animation:tear`, `animation:scratch`, `animation:flip`, `animation:instant`); when a mode is disabled, backend returns flag state in `GET /api/v1/players/me` response so clients can fall back to default
- [x] T182 [US14] Write `mobile/composeApp/src/commonMain/kotlin/components/AnimatedReveal.kt`: sealed `AnimationMode` matching `DrawAnimationMode` enum; `@Composable fun AnimatedReveal(mode: AnimationMode, prizePhotoUrl: String, onRevealed: () -> Unit)` dispatches to mode-specific composables: `TearRevealAnimation`, `ScratchRevealAnimation`, `FlipRevealAnimation`, `InstantReveal`
- [x] T183 [US14] Write `mobile/composeApp/src/commonMain/kotlin/components/TearRevealAnimation.kt`: Canvas-based tear animation using Compose `DrawScope`; gesture-driven horizontal swipe reveals prize photo layer beneath; completes in ≤3s (FR-070); write `ScratchRevealAnimation.kt`: Canvas with masked paint, finger/pointer scrub gesture removes overlay; write `FlipRevealAnimation.kt`: 3D card flip using `graphicsLayer(rotationY = ...)` animated via `AnimatedFloat`; write `InstantReveal.kt`: immediate image display with fade-in only
- [x] T184 [US14] Write `web/src/animations/TearReveal.tsx`, `ScratchReveal.tsx`, `FlipReveal.tsx`, `InstantReveal.tsx`: Canvas-based (2D Context API) or CSS animation implementations targeting 60fps; write `web/src/animations/AnimatedReveal.tsx` dispatcher component; write `web/src/hooks/useAnimationMode.ts` reading player preference from store with fallback logic when mode is disabled
- [x] T185 [US14] Add animation mode selector to player settings: `mobile/composeApp/src/commonMain/kotlin/screens/settings/SettingsScreen.kt` (add animation preference section with preview thumbnails of each mode); `web/src/app/settings/page.tsx` (same); `admin/src/app/settings/animations/page.tsx`: toggle enable/disable per mode with "players using this mode will fall back to INSTANT" warning

---

## Phase 17: US15 — 排行榜

### 17a. Server — Leaderboard

- [x] T186 [US15] Write `server/src/main/kotlin/application/ports/input/leaderboard/IGetLeaderboardUseCase.kt`; implement `GetLeaderboardUseCase.kt`: queries pre-aggregated Redis sorted sets keyed `leaderboard:{type}:{period}` (e.g., `leaderboard:draw_count:this_week`); returns top N entries + self-rank via `ZREVRANK`; if Redis miss, falls back to DB query and re-populates cache
- [x] T187 [US15] Write `server/src/main/kotlin/application/usecases/leaderboard/LeaderboardAggregationJob.kt`: scheduled coroutine (every 5 minutes) computing leaderboard scores from DB: draw_count from `draw_point_transactions`, prize_grade from `prize_instances`, trade_volume from `trade_orders`; writes to Redis sorted sets with appropriate TTL; writes `server/src/main/kotlin/api/routes/LeaderboardRoutes.kt`: GET `/api/v1/leaderboard?type=&period=`
- [x] T188 [US15] Write `mobile/composeApp/src/commonMain/kotlin/screens/leaderboard/LeaderboardScreen.kt`: type selector (Draw Count / Prize Grade / Trade Volume), period picker (Today/Week/Month/All Time); ranked list with avatars; self-rank highlighted row pinned at bottom if not in top list; write `web/src/app/leaderboard/page.tsx`: same layout
- [x] T189 [US15] Write `admin/src/app/leaderboard/page.tsx`: leaderboard configuration — toggle types on/off, set display count per type, configure which time periods are shown; changes stored as feature flags

---

## Phase 18: US16 — 一番賞即時觀戰

### 18a. Spectator Mode Enhancements

- [x] T190 [US16] Enhance `server/src/main/kotlin/infrastructure/websocket/KujiWebSocketHandler.kt`: add spectator-mode connection path that skips queue validation; spectators receive the same `TicketDrawnEvent` broadcasts as active players but send no draw commands; add `SpectatorJoinedEvent` and `SpectatorLeftEvent` to connection manager for player count display
- [x] T191 [US16] Enhance `mobile/composeApp/src/commonMain/kotlin/screens/campaign/KujiBoardScreen.kt`: add spectator UI mode — "Watching" badge, live queue size + active player nickname display, real-time draw feed ticker at bottom; non-queue players entering the campaign page automatically enter spectator mode
- [x] T192 [US16] Enhance `web/src/app/campaigns/[id]/board/page.tsx`: spectator overlay banner showing current drawer and queue count; animated draw feed panel (slide-in notifications of each drawn ticket + prize revealed); "Join Queue" CTA for non-queued authenticated players; implement `web/src/features/kuji/useSpectatorMode.ts` hook

---

## Phase 19: Polish & Cross-Cutting

### 19a. Internationalization (i18n)

- [x] T193 [P] Write `mobile/shared/src/commonMain/kotlin/` i18n resources: create `Strings.kt` as `expect object Strings` with all UI string keys; provide `zh-TW` as default actualisation; use Lyricist or equivalent KMP i18n library; cover all screens including error messages, notification titles, prize grades
- [x] T194 [P] Configure `next-intl` in `web/` and `admin/`: create `web/src/i18n/zh-TW.json` and `admin/src/i18n/zh-TW.json` with all string keys (menu labels, button text, error messages, prize states, campaign statuses); add locale middleware in `web/src/middleware.ts`; wrap all hardcoded strings in `useTranslations()`
- [x] T195 [P] Externalize all server-side error messages and notification content: create `server/src/main/resources/i18n/messages_zh-TW.properties`; update `StatusPages.kt` to read localized error messages; update push notification payloads in outbox event handlers to use localized strings

### 19b. Performance Optimization

- [x] T196 [P] Run `EXPLAIN ANALYZE` on all critical query paths; add missing composite indexes identified: `draw_point_transactions(player_id, type, created_at)`, `prize_instances(owner_id, state, deleted_at)`, `trade_orders(status, prize_instance_id)` (already partial indexed), `queue_entries(queue_id, position, status)`; write new migration `server/src/main/kotlin/infrastructure/persistence/migrations/V013__add_performance_indexes.sql`
- [x] T197 [P] Implement Redis caching for hot reads: cache `GET /api/v1/campaigns/kuji` (active campaigns list) with 30s TTL; cache `PrizeDefinition` lookups (used in unlimited draw spin) with 60s TTL; cache `FeatureFlag` state with 30s TTL; implement cache invalidation in respective `save`/`update` repository methods
- [x] T198 [P] Add Ktor response compression plugin for JSON responses >1KB; configure HikariCP pool size (min 5, max 20 per pod) in `DatabaseModule.kt`; configure PgBouncer connection pooling in `infra/docker/docker-compose.yml`; add PgBouncer K8s sidecar in `infra/k8s/server/deployment.yaml`
- [x] T199 [P] Audit Next.js bundle sizes: run `pnpm --filter web build` with `ANALYZE=true`; lazy-load animation components (`dynamic(() => import('../animations/TearReveal'), { ssr: false })`); lazy-load Lottie player; ensure page load < 2s on 4G (target initial JS bundle <200KB gzipped)

### 19c. Observability

- [x] T200 [P] Write `server/src/main/kotlin/api/plugins/Monitoring.kt`: configure OpenTelemetry SDK with OTLP exporter (Jaeger/Tempo endpoint from config); instrument all Ktor routes with `TracingPlugin`; add custom spans in `DrawKujiUseCase`, `PurchaseTradeListingUseCase` for financial operation tracing
- [x] T201 [P] Write `infra/monitoring/prometheus/prometheus.yml`: scrape config for server (`:8080/metrics`), postgres exporter, redis exporter; write alert rules in `infra/monitoring/prometheus/alerts.yml`: alert on `payment_failure_rate > 5%`, `websocket_broadcast_latency_p95 > 2s`, `http_error_rate_5xx > 1%`, `db_pool_exhausted > 0`
- [x] T202 [P] Write `infra/monitoring/grafana/dashboards/api-overview.json`: panels for API p95 latency, request rate, error rate; `kuji-realtime.json`: WebSocket connection count, broadcast latency, active queue size; `financial.json`: payment success rate, withdrawal queue depth, points ledger mutation rate
- [x] T203 [P] Configure structured logging in server: add `Kermit` logger with JSON formatter; include `traceId`, `playerId`, `campaignId` in log context via MDC; configure Loki log shipper in `infra/monitoring/loki/loki-config.yaml`

### 19d. Kubernetes Manifests

- [x] T204 [P] Write `infra/k8s/server/deployment.yaml`: 3-replica Deployment with `image: prizeDraw/server`, env from ConfigMap/Secret, liveness probe GET `/health`, readiness probe GET `/ready`; write `infra/k8s/server/hpa.yaml`: HorizontalPodAutoscaler min=2 max=10 scaling on CPU>70% and custom metric `websocket_active_connections>1000`; write `infra/k8s/server/service.yaml` and `configmap.yaml`
- [x] T205 [P] Write `infra/k8s/web/deployment.yaml`, `infra/k8s/admin/deployment.yaml`: Next.js standalone deployments with HPA; write `infra/k8s/postgres/statefulset.yaml`: PostgreSQL StatefulSet with PVC; write `infra/k8s/redis/statefulset.yaml`: Redis StatefulSet; write `infra/k8s/ingress/ingress.yaml`: Nginx Ingress with TLS termination, routes to server/web/admin services
- [x] T206 [P] Write `infra/ci/deploy.yml`: GitHub Actions deploy workflow triggered on merge to main; steps: build Docker images, push to registry, run Flyway migration job (`kubectl apply -f migrate-job.yaml`), rolling restart server/web/admin deployments, smoke test (curl `/health`)

### 19e. Security Hardening

- [x] T207 [P] Audit all input validation: ensure every request DTO is validated in `RequestValidation.kt` — string length limits, integer range checks, UUID format validation, phone E.164 regex; add `@Size`, `@Min`, `@Max` annotations or equivalent manual checks in use cases
- [x] T208 [P] Configure CORS in `server/src/main/kotlin/api/plugins/CORS.kt`: allow only `web` and `admin` origins from environment config; set `allowCredentials = false` (using Bearer tokens not cookies); configure CSP headers in Next.js `next.config.js` for both `web/` and `admin/`
- [x] T209 [P] Add global rate limiting in `server/src/main/kotlin/api/plugins/RateLimit.kt` using Ktor `RateLimit` plugin: 100 req/min per IP for unauthenticated routes, 1000 req/min per player for authenticated routes, 10 req/min for OTP send; document that draw-specific rate limiting is handled at use case layer via Redis

### 19f. Testing

- [x] T210 [P] Write Kotest unit tests for all domain services: `KujiDrawDomainServiceTest.kt` (test ticket selection, multi-draw validation, edge cases — 0 remaining, exact quantity); `UnlimitedDrawDomainServiceTest.kt` (test CDF distribution, probability sum validation); `PointsLedgerServiceTest.kt` (test optimistic lock retry, insufficient balance); target 80% branch coverage on `domain/` and `application/services/`
- [x] T211 [P] Write Ktor `testApplication` integration tests for all financial flows: `DrawKujiIntegrationTest.kt` (full draw loop: join queue, draw ticket, verify prize created, verify points debited atomically); `TradeIntegrationTest.kt` (list → purchase → verify transfer, test concurrent purchase with only one success); `WithdrawalIntegrationTest.kt` (create → approve → verify balance deducted)
- [x] T212 [P] Write Playwright E2E tests `web/tests/e2e/`: `kuji-draw.spec.ts` (login → browse campaign → join queue → draw ticket → verify prize in inventory); `trade.spec.ts` (list prize → buy with second account → verify ownership transfer); `auth.spec.ts` (OAuth login → phone binding → wallet top-up flow)
- [x] T213 [P] Write k6 load test scripts `infra/ci/k6/`: `kuji-load.js` (simulate 100 concurrent users joining kuji queue and drawing, assert p95 < 500ms); `unlimited-load.js` (10,000 concurrent unlimited draws, assert p95 < 200ms, verify rate limiting kicks in); `websocket-broadcast.js` (1,000 WebSocket connections receiving draw events, assert broadcast latency < 2s)
- [x] T214 [P] Write Maestro E2E flows `mobile/tests/`: `login_flow.yaml` (launch app → OAuth login → phone binding); `kuji_draw_flow.yaml` (browse campaign → join queue → draw single ticket → verify result screen); `trade_flow.yaml` (open marketplace → buy listing → verify in prizes)

### 19g. Documentation

- [x] T215 [P] Write `specs/001-ichiban-kuji-platform/contracts/api-rest.md`: document all REST endpoints (method, path, auth requirement, request schema, response schema, error codes) organized by domain; reference api-contracts DTOs
- [x] T216 [P] Write `specs/001-ichiban-kuji-platform/contracts/api-websocket.md`: document WebSocket events (`TicketDrawnEvent`, `QueueUpdateEvent`, `SpectatorJoinedEvent`, `SessionStartedEvent`, `SessionExpiredEvent`, `BoxSoldOutEvent`) with full JSON schemas
- [x] T217 [P] Write `specs/001-ichiban-kuji-platform/contracts/api-webhooks.md`: document payment gateway webhook payloads (ECPay, NewebPay, Stripe) and LINE Messaging API webhook; include signature verification algorithm for each
- [x] T218 Write `infra/docker/docker-compose.yml` usage section in `specs/001-ichiban-kuji-platform/quickstart.md`: step-by-step local dev setup (prerequisites, `docker-compose up`, Flyway migration, seed data script, accessing web/admin/API)

---

## Checkpoint: Phase 19 Complete — Platform Ready for Production

All 16 user stories implemented. Performance targets validated. K8s manifests ready. CI/CD pipeline configured.

---

## Dependencies & Execution Order

```
Phase 1 (Setup)
  └─> Phase 2 (Foundational — ALL of T017-T080 must complete)
        └─> Phase 3 (US10 Auth — prerequisite for everything)
              ├─> Phase 4 (US1 Kuji Draw) ─────────────────────┐
              ├─> Phase 5 (US2 Unlimited Draw) ────────────────┤
              │                                                  │
              ├─> Phase 6 (US3 Prizes + Shipping) ─────────────┤
              ├─> Phase 7 (US4 Trade) ───────────────────────── These 4 can run in parallel
              ├─> Phase 8 (US5 Exchange) ─────────────────────┤
              └─> Phase 9 (US6 Buyback) ──────────────────────┘
                    │
                    └─> Phase 10 (US11 Dual Points + Withdrawal)
                          ├─> Phase 11 (US7 Admin Campaigns) ─┐
                          ├─> Phase 12 (US8 Admin Pricing) ───┤ Parallel
                          └─> Phase 13 (US9 Support) ─────────┘
                                │
                                └─> Phase 14 (US12 RBAC + Audit)
                                      └─> Phase 15 (US13 Coupons)
                                            ├─> Phase 16 (US14 Animations) ─┐
                                            ├─> Phase 17 (US15 Leaderboard) ┤ Parallel
                                            └─> Phase 18 (US16 Spectator) ──┘
                                                  └─> Phase 19 (Polish)
```

## Parallel Opportunities

The following groups of tasks within phases can be parallelized across engineers:

**Phase 2 parallelism**:
- Database migrations (T017-T028): sequential (each migration depends on prior table existence for FKs) — assign one engineer
- api-contracts enums + DTOs + endpoints (T029-T055): fully parallel across 2-3 engineers
- Server domain entities + value objects (T056-T060): parallel with api-contracts work
- Server port interfaces (T061-T067): parallel after domain entities complete
- Exposed table definitions (T068-T069): parallel with port interfaces
- Repository implementations (T070-T071): after table definitions
- Infrastructure (Redis, Storage, Auth) (T072-T080): parallel with repositories

**Phase 4 parallelism**:
- Server kuji domain + queue service (T101-T106): backend engineer
- Mobile kuji screens (T107-T110): mobile engineer (can use mock API)
- Web kuji pages (T111-T113): web engineer (can use mock API)

**Phases 6-9**: All four prize management phases (US3, US4, US5, US6) can be developed in parallel by separate engineers after Phase 3 completes, as they share only the `PrizeInstance` state machine (coordinate on state transition conflicts).

**Phases 11-13**: Admin campaign management, admin pricing, and support integration can be parallelized after Phase 10 (dual points) completes.

**Phase 19**: All polish tasks (T193-T218) are fully parallel.

## Implementation Strategy

**Financial integrity first**: All use cases that mutate point balances MUST use `PointsLedgerService` (T147). The optimistic lock retry pattern on `Player.version` is the single source of truth for preventing double-spend. Never update `draw_points_balance` or `revenue_points_balance` directly in repositories — always go through `PointsLedgerService`.

**WebSocket horizontal scaling**: The `ConnectionManager` (T104) + `RedisPubSub` (T072) pattern ensures that when the server scales to multiple pods, draw events published by any pod are fanned out to all WebSocket connections regardless of which pod they are connected to. This is critical for the kuji real-time sync requirement (SC-002, <2s broadcast).

**Distributed lock scope**: Use `DistributedLock` (T072) only at use-case boundaries for operations that must be serialized: queue join/advance (`queue:{boxId}`), trade purchase (`trade:{listingId}`), exchange accept (`exchange:{requestId}`). Do NOT hold Redis locks across DB transactions — acquire lock, execute DB transaction, release lock.

**Outbox pattern**: Every financial domain event (draw complete, trade complete, buyback, payment confirmed) MUST write to `outbox_events` within the same DB transaction as the primary mutation. The `OutboxWorker` (T079) handles async delivery. This guarantees push notifications and leaderboard updates are never lost even if the process crashes mid-operation.

**API contracts first**: When adding new endpoints in any phase, always update `api-contracts` DTOs and endpoint constants first (Phase 2c-2d pattern), then implement server routes, then mobile/web clients. This ensures type safety across the entire stack from day one.

**Feature flags for progressive rollout**: Exchange (US5), animations (US14), leaderboard (US15), and spectator mode (US16) are all controlled by feature flags seeded in the `feature_flags` table migration (T028). New deployments should seed these as `enabled=false` and operators enable them progressively via the admin dashboard.
```
