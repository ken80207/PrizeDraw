# Data Model: Prize Draw Platform (賞品抽獎平台)

**Feature Branch**: `001-ichiban-kuji-platform`
**Created**: 2026-03-24
**Stack**: PostgreSQL 16 + Prisma ORM + TypeScript

---

## Design Principles

- **UUID v4** for all primary keys (no sequential integer IDs exposed externally)
- **`created_at` + `updated_at`** on every table, managed by Prisma middleware
- **Soft delete** via `deleted_at` on entities requiring audit trail (Player, Campaign types, PrizeInstance, TradeOrder, Coupon, DiscountCode)
- **All monetary / point amounts stored as integers** (e.g., 1000 = 1000 points; no decimals, no floating point)
- **Double-entry bookkeeping** for all point mutations: every balance change is backed by an immutable transaction row; balances are derived columns on Player kept in sync transactionally
- **Dual point system**: `draw_points_balance` (purchasable, spend-only) and `revenue_points_balance` (earned from sales/buyback, withdrawable only) are separate columns on Player with separate transaction ledgers
- **Enum values** use `SCREAMING_SNAKE_CASE` in PostgreSQL, mapped to TypeScript union types via Prisma
- **JSON columns** (`rules`, `metadata`, `before_value`, `after_value`, etc.) typed as `Json` in Prisma and `Record<string, unknown>` in TypeScript
- **Optimistic locking** on `draw_points_balance` and `revenue_points_balance` via `version` column (integer, default 0, incremented on each balance mutation) to prevent lost-update race conditions
- **Foreign key constraints** enforced at the database level; Prisma relations used for type safety
- **Indexes** defined per table for query patterns identified in the spec

---

## Entity Index

1. [Player (玩家)](#1-player-玩家)
2. [Kuji Campaign (一番賞活動)](#2-kuji-campaign-一番賞活動)
3. [Ticket Box (籤盒)](#3-ticket-box-籤盒)
4. [Unlimited Campaign (無限賞活動)](#4-unlimited-campaign-無限賞活動)
5. [Draw Ticket (籤)](#5-draw-ticket-籤)
6. [Prize Definition (賞品定義)](#6-prize-definition-賞品定義)
7. [Prize Instance (賞品實例)](#7-prize-instance-賞品實例)
8. [Queue (排隊佇列)](#8-queue-排隊佇列)
9. [Queue Entry (佇列項目)](#9-queue-entry-佇列項目)
10. [Shipping Order (寄送訂單)](#10-shipping-order-寄送訂單)
11. [Exchange Request (交換請求)](#11-exchange-request-交換請求)
12. [Exchange Request Item (交換請求賞品項目)](#12-exchange-request-item-交換請求賞品項目)
13. [Trade Order (交易訂單)](#13-trade-order-交易訂單)
14. [Buyback Record (回收紀錄)](#14-buyback-record-回收紀錄)
15. [Draw Point Transaction (消費點數紀錄)](#15-draw-point-transaction-消費點數紀錄)
16. [Revenue Point Transaction (收益點數紀錄)](#16-revenue-point-transaction-收益點數紀錄)
17. [Payment Order (金流訂單)](#17-payment-order-金流訂單)
18. [Withdrawal Request (提領申請)](#18-withdrawal-request-提領申請)
19. [Support Ticket (客服工單)](#19-support-ticket-客服工單)
20. [Support Ticket Message (工單訊息)](#20-support-ticket-message-工單訊息)
21. [Coupon (優惠券)](#21-coupon-優惠券)
22. [Discount Code (折扣碼)](#22-discount-code-折扣碼)
23. [Player Coupon (玩家優惠券)](#23-player-coupon-玩家優惠券)
24. [Audit Log (操作紀錄)](#24-audit-log-操作紀錄)
25. [Staff (後台人員)](#25-staff-後台人員)
26. [Feature Flag (功能開關)](#26-feature-flag-功能開關)

---

## 1. Player (玩家)

The central user entity. Players authenticate exclusively via third-party OAuth2 providers; a phone number binding is mandatory before core platform features are unlocked. Dual point balances are maintained directly on this row, protected by optimistic locking.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK, default `gen_random_uuid()` | Surrogate primary key |
| `nickname` | `VARCHAR(64)` | NOT NULL | Display name shown in UI and on ticket boards |
| `avatar_url` | `TEXT` | NULLABLE | Profile image URL (CDN path) |
| `phone_number` | `VARCHAR(20)` | UNIQUE, NULLABLE | E.164 format; NULL until binding is completed |
| `phone_verified_at` | `TIMESTAMPTZ` | NULLABLE | Timestamp of successful OTP verification |
| `oauth_provider` | `player_oauth_provider` ENUM | NOT NULL | `GOOGLE`, `APPLE`, `LINE` |
| `oauth_subject` | `VARCHAR(255)` | NOT NULL | Provider-issued user identifier (`sub` claim) |
| `draw_points_balance` | `INTEGER` | NOT NULL, default 0, CHECK >= 0 | Current spendable draw points (消費點數) |
| `revenue_points_balance` | `INTEGER` | NOT NULL, default 0, CHECK >= 0 | Current withdrawable revenue points (收益點數) |
| `version` | `INTEGER` | NOT NULL, default 0 | Optimistic lock version; incremented on every balance mutation |
| `preferred_animation_mode` | `draw_animation_mode` ENUM | NOT NULL, default `TEAR` | Player's default reveal animation; `TEAR`, `SCRATCH`, `FLIP`, `INSTANT` |
| `locale` | `VARCHAR(10)` | NOT NULL, default `zh-TW` | BCP-47 locale code for i18n |
| `is_active` | `BOOLEAN` | NOT NULL, default TRUE | FALSE when account is frozen/suspended |
| `deleted_at` | `TIMESTAMPTZ` | NULLABLE | Soft delete timestamp |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | Account creation time |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | Last mutation timestamp |

### Relationships

- `hasMany` DrawPointTransaction (via `player_id`)
- `hasMany` RevenuePointTransaction (via `player_id`)
- `hasMany` PaymentOrder (via `player_id`)
- `hasMany` WithdrawalRequest (via `player_id`)
- `hasMany` PrizeInstance (via `owner_id`)
- `hasMany` TradeOrder as seller (via `seller_id`)
- `hasMany` TradeOrder as buyer (via `buyer_id`)
- `hasMany` BuybackRecord (via `player_id`)
- `hasMany` ShippingOrder (via `player_id`)
- `hasMany` ExchangeRequest as initiator (via `initiator_id`)
- `hasMany` ExchangeRequest as recipient (via `recipient_id`)
- `hasMany` SupportTicket (via `player_id`)
- `hasMany` PlayerCoupon (via `player_id`)
- `hasMany` QueueEntry (via `player_id`)

### Validation Rules

- `oauth_provider` + `oauth_subject` must be unique (composite unique index) — prevents the same external account creating two players
- `phone_number` uniqueness enforced at DB level; application layer rejects with a descriptive error when a second account attempts binding of an already-bound number
- `draw_points_balance >= 0` enforced by DB CHECK constraint; application must verify sufficient balance before deduct operations
- `revenue_points_balance >= 0` enforced by DB CHECK constraint
- Players with `phone_number IS NULL` (unverified) are blocked from: draw, trade, exchange, buyback, withdrawal — enforced at service layer, not DB layer
- Players with `is_active = FALSE` are blocked from all write operations; their listed `TradeOrder` rows must be auto-cancelled by a background job
- Soft-deleted players (`deleted_at IS NOT NULL`) must not be returned by public queries

### State Transitions (Account Activation)

```
[unverified]  -- phone OTP verified       --> [active]
[active]      -- admin freeze              --> [suspended]
[suspended]   -- admin unfreeze            --> [active]
[active]      -- player or admin delete    --> [deleted]  (soft delete, deleted_at set)
```

`is_active` column encodes `active` vs `suspended`. `deleted_at IS NOT NULL` encodes `deleted`.

### Indexes

```sql
CREATE UNIQUE INDEX uq_player_oauth ON players(oauth_provider, oauth_subject);
CREATE UNIQUE INDEX uq_player_phone ON players(phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX idx_player_is_active ON players(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_player_created_at ON players(created_at DESC);
```

---

## 2. Kuji Campaign (一番賞活動)

Represents a finite, queue-based draw event. A campaign owns one or more TicketBoxes. Once all boxes are sold out the campaign transitions to `SOLD_OUT` automatically. The ticket layout (籤面) is immutable after the campaign reaches `ACTIVE` status to guarantee fairness.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Surrogate primary key |
| `title` | `VARCHAR(255)` | NOT NULL | Campaign display name |
| `description` | `TEXT` | NULLABLE | Rich-text description shown to players |
| `cover_image_url` | `TEXT` | NULLABLE | CDN URL for campaign cover art |
| `price_per_draw` | `INTEGER` | NOT NULL, CHECK > 0 | Draw points cost per single draw (1 ticket) |
| `draw_session_seconds` | `INTEGER` | NOT NULL, default 300, CHECK > 0 | Exclusive draw session duration in seconds (default 5 min) |
| `status` | `kuji_campaign_status` ENUM | NOT NULL, default `DRAFT` | `DRAFT`, `ACTIVE`, `SUSPENDED`, `SOLD_OUT` |
| `activated_at` | `TIMESTAMPTZ` | NULLABLE | Timestamp of first `ACTIVE` transition |
| `sold_out_at` | `TIMESTAMPTZ` | NULLABLE | Timestamp when all boxes sold out |
| `created_by_staff_id` | `UUID` | FK → Staff, NOT NULL | Operator who created the campaign |
| `deleted_at` | `TIMESTAMPTZ` | NULLABLE | Soft delete; used when campaign is purged |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

### Relationships

- `hasMany` TicketBox (via `kuji_campaign_id`)
- `belongsTo` Staff (via `created_by_staff_id`)
- `hasMany` PrizeInstance (indirectly, through DrawTicket → PrizeInstance)

### Validation Rules

- `price_per_draw > 0` enforced by CHECK constraint
- `draw_session_seconds > 0`; maximum value (e.g. 3600) can be enforced at service layer
- Transition to `ACTIVE` requires all TicketBoxes to be fully configured (every ticket has an assigned PrizeDefinition and photo) — validated at service layer before status update
- Once `ACTIVE`, ticket layout fields on child TicketBox and DrawTicket rows are locked; only `title`, `description`, `cover_image_url` may be updated (FR-020f)
- `SOLD_OUT` is a terminal state driven by system events (last ticket drawn), not manual operator action
- Operators can suspend (`ACTIVE` → `SUSPENDED`) and reactivate (`SUSPENDED` → `ACTIVE`)

### State Transitions

```
[DRAFT]      -- operator publishes (all boxes configured)  --> [ACTIVE]
[ACTIVE]     -- operator suspends                          --> [SUSPENDED]
[SUSPENDED]  -- operator reactivates                       --> [ACTIVE]
[ACTIVE]     -- last ticket across all boxes drawn         --> [SOLD_OUT]  (system, automatic)
[SUSPENDED]  -- last ticket across all boxes drawn         --> [SOLD_OUT]  (system, automatic)
```

`SOLD_OUT` is irreversible. `DRAFT` cannot be reached again once `ACTIVE`.

### Indexes

```sql
CREATE INDEX idx_kuji_campaign_status ON kuji_campaigns(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_kuji_campaign_created_at ON kuji_campaigns(created_at DESC);
CREATE INDEX idx_kuji_campaign_created_by ON kuji_campaigns(created_by_staff_id);
```

---

## 3. Ticket Box (籤盒)

A draw pool inside a KujiCampaign. Each box has a fixed set of DrawTickets and an independent queue. Multiple boxes can exist within one campaign; players may switch between boxes during their session window.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Surrogate primary key |
| `kuji_campaign_id` | `UUID` | FK → KujiCampaign, NOT NULL | Parent campaign |
| `name` | `VARCHAR(64)` | NOT NULL | Box label, e.g., "籤盒 A", "籤盒 B" |
| `total_tickets` | `INTEGER` | NOT NULL, CHECK > 0 | Total fixed ticket count (immutable after `ACTIVE`) |
| `remaining_tickets` | `INTEGER` | NOT NULL, CHECK >= 0 | Decremented atomically on each draw; derived from `total_tickets - drawn_count` but stored for fast reads |
| `status` | `ticket_box_status` ENUM | NOT NULL, default `AVAILABLE` | `AVAILABLE`, `SOLD_OUT` |
| `sold_out_at` | `TIMESTAMPTZ` | NULLABLE | Set when `remaining_tickets` reaches 0 |
| `display_order` | `INTEGER` | NOT NULL, default 0 | Rendering order within the campaign |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

### Relationships

- `belongsTo` KujiCampaign (via `kuji_campaign_id`)
- `hasMany` DrawTicket (via `ticket_box_id`)
- `hasOne` Queue (via `ticket_box_id`)

### Validation Rules

- `total_tickets` must equal the number of associated DrawTicket rows; verified at service layer before campaign activation
- `remaining_tickets` is decremented inside the same database transaction as the DrawTicket status update — never updated independently
- `remaining_tickets >= 0` enforced by CHECK constraint; application should also check before attempting a draw
- When `remaining_tickets` reaches 0 the service layer sets `status = SOLD_OUT` and `sold_out_at = NOW()` atomically; it also evaluates whether all sibling boxes are `SOLD_OUT`, and if so, transitions the parent KujiCampaign to `SOLD_OUT`
- `display_order` must be unique within a campaign (composite unique index)

### State Transitions

```
[AVAILABLE]  -- remaining_tickets reaches 0 (atomic draw transaction)  --> [SOLD_OUT]
```

`SOLD_OUT` is terminal and irreversible for a given box.

### Indexes

```sql
CREATE INDEX idx_ticket_box_campaign ON ticket_boxes(kuji_campaign_id);
CREATE INDEX idx_ticket_box_status ON ticket_boxes(kuji_campaign_id, status);
CREATE UNIQUE INDEX uq_ticket_box_order ON ticket_boxes(kuji_campaign_id, display_order);
```

---

## 4. Unlimited Campaign (無限賞活動)

A probability-based draw with no fixed ticket pool. Players draw independently and simultaneously with no queuing. Prize probabilities must sum to exactly 100% before the campaign can be activated. Probability configuration can be updated live (with operator confirmation).

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Surrogate primary key |
| `title` | `VARCHAR(255)` | NOT NULL | Campaign display name |
| `description` | `TEXT` | NULLABLE | Rich-text description |
| `cover_image_url` | `TEXT` | NULLABLE | CDN URL for cover art |
| `price_per_draw` | `INTEGER` | NOT NULL, CHECK > 0 | Draw points cost per single draw |
| `rate_limit_per_second` | `INTEGER` | NOT NULL, default 1, CHECK > 0 | Max draws per second per player (FR-011, FR-021c) |
| `status` | `unlimited_campaign_status` ENUM | NOT NULL, default `DRAFT` | `DRAFT`, `ACTIVE`, `SUSPENDED` |
| `activated_at` | `TIMESTAMPTZ` | NULLABLE | Timestamp of first `ACTIVE` transition |
| `created_by_staff_id` | `UUID` | FK → Staff, NOT NULL | Operator who created the campaign |
| `deleted_at` | `TIMESTAMPTZ` | NULLABLE | Soft delete |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

### Relationships

- `hasMany` PrizeDefinition (via `unlimited_campaign_id`)
- `belongsTo` Staff (via `created_by_staff_id`)
- `hasMany` PrizeInstance (indirectly through PrizeDefinition)

### Validation Rules

- The sum of `probability_bps` across all PrizeDefinitions linked to this campaign must equal 1,000,000 (representing 100.000000%) before status can be set to `ACTIVE` (FR-008)
- During probability updates on a live campaign, the atomic swap (deactivate old definitions, insert new, validate sum) must complete before acknowledgment (FR-021b)
- `rate_limit_per_second >= 1`; capped at reasonable maximum (e.g. 60) at service layer

### State Transitions

```
[DRAFT]      -- operator publishes (probability sum = 100%)  --> [ACTIVE]
[ACTIVE]     -- operator suspends                            --> [SUSPENDED]
[SUSPENDED]  -- operator reactivates                         --> [ACTIVE]
```

No `SOLD_OUT` state: unlimited campaigns have no ticket ceiling.

### Indexes

```sql
CREATE INDEX idx_unlimited_campaign_status ON unlimited_campaigns(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_unlimited_campaign_created_at ON unlimited_campaigns(created_at DESC);
```

---

## 5. Draw Ticket (籤)

One physical ticket slot inside a TicketBox. Every ticket has a fixed PrizeDefinition assigned at campaign creation time. Ticket layout is immutable once the parent campaign is `ACTIVE`. A ticket may be drawn by a player (changing status to `DRAWN`) exactly once.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Surrogate primary key |
| `ticket_box_id` | `UUID` | FK → TicketBox, NOT NULL | Parent ticket box |
| `prize_definition_id` | `UUID` | FK → PrizeDefinition, NOT NULL | The prize behind this ticket slot |
| `position` | `INTEGER` | NOT NULL, CHECK > 0 | 1-based slot number shown on the ticket board |
| `status` | `draw_ticket_status` ENUM | NOT NULL, default `AVAILABLE` | `AVAILABLE`, `DRAWN` |
| `drawn_by_player_id` | `UUID` | FK → Player, NULLABLE | Set when drawn |
| `drawn_at` | `TIMESTAMPTZ` | NULLABLE | Timestamp of draw event |
| `prize_instance_id` | `UUID` | FK → PrizeInstance, UNIQUE, NULLABLE | The PrizeInstance created by this draw; NULL until drawn |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

### Relationships

- `belongsTo` TicketBox (via `ticket_box_id`)
- `belongsTo` PrizeDefinition (via `prize_definition_id`)
- `belongsTo` Player (via `drawn_by_player_id`) — NULLABLE
- `hasOne` PrizeInstance (via `prize_instance_id`) — NULLABLE

### Validation Rules

- `position` must be unique within a TicketBox (composite unique index)
- `status`, `drawn_by_player_id`, `drawn_at`, and `prize_instance_id` are all set atomically in a single transaction when a draw occurs
- Once `DRAWN`, a ticket record is immutable (application must refuse any further updates)
- `drawn_by_player_id` and `drawn_at` must both be NULL when `status = AVAILABLE`, and both NOT NULL when `status = DRAWN`

### State Transitions

```
[AVAILABLE]  -- player draws this ticket (atomic transaction)  --> [DRAWN]
```

`DRAWN` is terminal and irreversible.

### Indexes

```sql
CREATE UNIQUE INDEX uq_draw_ticket_position ON draw_tickets(ticket_box_id, position);
CREATE INDEX idx_draw_ticket_box_status ON draw_tickets(ticket_box_id, status);
CREATE INDEX idx_draw_ticket_drawn_by ON draw_tickets(drawn_by_player_id) WHERE drawn_by_player_id IS NOT NULL;
CREATE INDEX idx_draw_ticket_prize_def ON draw_tickets(prize_definition_id);
```

---

## 6. Prize Definition (賞品定義)

A prize template shared by multiple tickets (kuji) or referenced probabilistically (unlimited). Stores grade, display name, images, buyback price, and — depending on campaign type — either the count of tickets assigned to it (kuji) or the draw probability (unlimited). Each photo is stored as an element in a JSONB array to support multiple images per prize.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Surrogate primary key |
| `kuji_campaign_id` | `UUID` | FK → KujiCampaign, NULLABLE | Set for kuji prizes; mutually exclusive with `unlimited_campaign_id` |
| `unlimited_campaign_id` | `UUID` | FK → UnlimitedCampaign, NULLABLE | Set for unlimited prizes; mutually exclusive with `kuji_campaign_id` |
| `grade` | `VARCHAR(32)` | NOT NULL | Prize grade label, e.g., `A賞`, `B賞`, `Last賞` |
| `name` | `VARCHAR(255)` | NOT NULL | Product/prize name |
| `photos` | `JSONB` | NOT NULL, default `[]` | Ordered array of CDN URLs: `[{ "url": "...", "sort_order": 1 }, ...]` |
| `buyback_price` | `INTEGER` | NOT NULL, default 0, CHECK >= 0 | Official buyback amount in revenue points; 0 means buyback disabled |
| `buyback_enabled` | `BOOLEAN` | NOT NULL, default TRUE | Operator can disable buyback for this prize grade (FR-006 edge case) |
| `probability_bps` | `INTEGER` | NULLABLE, CHECK >= 0 | Probability in basis points of 0.0001% (i.e., 1,000,000 = 100%). NULL for kuji prizes |
| `ticket_count` | `INTEGER` | NULLABLE, CHECK >= 0 | Number of tickets in the box assigned to this definition. NULL for unlimited prizes |
| `display_order` | `INTEGER` | NOT NULL, default 0 | Rendering order within a campaign's prize list |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

**Note on probability representation**: Using integer basis points (`probability_bps`) avoids floating-point precision issues. `probability_bps = 50000` means 5.0000%. The invariant `SUM(probability_bps) = 1,000,000` for all definitions of one unlimited campaign is validated in application code and enforced by a DB trigger or application-level constraint before activation.

### Relationships

- `belongsTo` KujiCampaign (via `kuji_campaign_id`) — NULLABLE
- `belongsTo` UnlimitedCampaign (via `unlimited_campaign_id`) — NULLABLE
- `hasMany` DrawTicket (via `prize_definition_id`)
- `hasMany` PrizeInstance (via `prize_definition_id`)

### Validation Rules

- Exactly one of `kuji_campaign_id` or `unlimited_campaign_id` must be non-NULL (CHECK constraint: `(kuji_campaign_id IS NULL) != (unlimited_campaign_id IS NULL)`)
- For kuji definitions: `probability_bps` must be NULL; `ticket_count` must be NOT NULL and > 0
- For unlimited definitions: `ticket_count` must be NULL; `probability_bps` must be NOT NULL and >= 0
- `photos` array must contain at least one element before the parent campaign can be activated (FR-001a, FR-020b)
- `buyback_price >= 0`; the business rule that buyback price cannot exceed `price_per_draw` of the parent campaign is enforced at service layer

### Indexes

```sql
CREATE INDEX idx_prize_def_kuji ON prize_definitions(kuji_campaign_id) WHERE kuji_campaign_id IS NOT NULL;
CREATE INDEX idx_prize_def_unlimited ON prize_definitions(unlimited_campaign_id) WHERE unlimited_campaign_id IS NOT NULL;
CREATE INDEX idx_prize_def_grade ON prize_definitions(kuji_campaign_id, grade);
```

---

## 7. Prize Instance (賞品實例)

A concrete prize owned by a player. Created when a ticket is drawn (kuji) or when an unlimited draw resolves. Tracks the full lifecycle of a prize from acquisition through to final disposition (shipped, sold, exchanged, recycled). The `state` field is the central state machine.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Surrogate primary key |
| `prize_definition_id` | `UUID` | FK → PrizeDefinition, NOT NULL | The template this instance is based on |
| `owner_id` | `UUID` | FK → Player, NOT NULL | Current owner |
| `acquisition_method` | `prize_acquisition_method` ENUM | NOT NULL | `KUJI_DRAW`, `UNLIMITED_DRAW`, `TRADE_PURCHASE`, `EXCHANGE` |
| `source_draw_ticket_id` | `UUID` | FK → DrawTicket, UNIQUE, NULLABLE | Set when acquired via `KUJI_DRAW` |
| `source_trade_order_id` | `UUID` | FK → TradeOrder, NULLABLE | Set when acquired via `TRADE_PURCHASE` |
| `source_exchange_request_id` | `UUID` | FK → ExchangeRequest, NULLABLE | Set when acquired via `EXCHANGE` |
| `state` | `prize_instance_state` ENUM | NOT NULL, default `HOLDING` | See state machine below |
| `acquired_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | When the player first received this prize |
| `deleted_at` | `TIMESTAMPTZ` | NULLABLE | Soft delete (used when prize is recycled, sold, delivered — final states) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

### Relationships

- `belongsTo` PrizeDefinition (via `prize_definition_id`)
- `belongsTo` Player as owner (via `owner_id`)
- `belongsTo` DrawTicket (via `source_draw_ticket_id`) — NULLABLE
- `belongsTo` TradeOrder (via `source_trade_order_id`) — NULLABLE
- `belongsTo` ExchangeRequest (via `source_exchange_request_id`) — NULLABLE
- `hasOne` ShippingOrder (via `prize_instance_id`) — NULLABLE
- `hasOne` TradeOrder as item (via `prize_instance_id`) — NULLABLE
- `hasMany` ExchangeRequestItem (via `prize_instance_id`)
- `hasOne` BuybackRecord (via `prize_instance_id`) — NULLABLE

### Validation Rules

- Only one active disposition is permitted at a time: a prize in `TRADING` cannot simultaneously be in `EXCHANGING` or `PENDING_BUYBACK` — enforced by state machine transitions
- Ownership transfer (trade, exchange) must update `owner_id` atomically together with `state` changes in both source and destination instances
- `source_draw_ticket_id` must be unique across non-deleted PrizeInstance rows (a ticket can only produce one prize instance)
- Players with `is_active = FALSE` cannot initiate new state transitions; their `TRADING` instances must be auto-listed-cancelled by a background job

### State Transitions

```
[HOLDING]          -- player lists for sale                    --> [TRADING]
[HOLDING]          -- player initiates exchange offer          --> [EXCHANGING]
[HOLDING]          -- player requests official buyback         --> [PENDING_BUYBACK]
[HOLDING]          -- player requests shipment                 --> [PENDING_SHIPMENT]

[TRADING]          -- buyer completes purchase                 --> [SOLD]           (terminal; new instance created for buyer in HOLDING)
[TRADING]          -- player cancels listing                   --> [HOLDING]
[TRADING]          -- account frozen (background job)          --> [HOLDING]

[EXCHANGING]       -- exchange request accepted & completed    --> [RECYCLED]*      (ownership transferred; new instance for other party in HOLDING)
[EXCHANGING]       -- exchange request rejected / cancelled    --> [HOLDING]

[PENDING_BUYBACK]  -- system processes buyback                 --> [RECYCLED]       (terminal)

[PENDING_SHIPMENT] -- operator marks shipped                   --> [SHIPPED]
[PENDING_SHIPMENT] -- player cancels before shipment           --> [HOLDING]

[SHIPPED]          -- player confirms receipt / auto-confirm   --> [DELIVERED]      (terminal)
```

*Note: When an exchange completes, the outgoing instance transitions to `RECYCLED` (logically consumed) and a new PrizeInstance is created for the receiving player with `acquisition_method = EXCHANGE`.

Terminal states: `SOLD`, `RECYCLED`, `DELIVERED`. These records are soft-deleted (`deleted_at` set) and removed from active prize inventory queries but retained for history.

### Indexes

```sql
CREATE INDEX idx_prize_instance_owner ON prize_instances(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_prize_instance_state ON prize_instances(state) WHERE deleted_at IS NULL;
CREATE INDEX idx_prize_instance_owner_state ON prize_instances(owner_id, state) WHERE deleted_at IS NULL;
CREATE INDEX idx_prize_instance_definition ON prize_instances(prize_definition_id);
CREATE UNIQUE INDEX uq_prize_instance_ticket ON prize_instances(source_draw_ticket_id) WHERE source_draw_ticket_id IS NOT NULL;
```

---

## 8. Queue (排隊佇列)

One persistent queue per TicketBox. Tracks the active draw session holder and the ordered waiting list. The queue is the concurrency control boundary for kuji draws: only the player holding the active session may draw tickets from the associated box.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Surrogate primary key |
| `ticket_box_id` | `UUID` | FK → TicketBox, UNIQUE, NOT NULL | Each box has exactly one queue |
| `active_player_id` | `UUID` | FK → Player, NULLABLE | The player currently holding the draw session; NULL when idle |
| `session_started_at` | `TIMESTAMPTZ` | NULLABLE | When the current session began |
| `session_expires_at` | `TIMESTAMPTZ` | NULLABLE | `session_started_at + draw_session_seconds` from the campaign; NULL when idle |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

### Relationships

- `belongsTo` TicketBox (via `ticket_box_id`) — 1-to-1
- `belongsTo` Player (via `active_player_id`) — NULLABLE
- `hasMany` QueueEntry (via `queue_id`)

### Validation Rules

- `ticket_box_id` is UNIQUE — enforced at DB level
- `session_started_at` and `session_expires_at` must both be NULL or both be NOT NULL (paired)
- Session expiry is enforced by a background timer service (or Lua script on Redis for distributed locking); when `NOW() >= session_expires_at`, the service advances the queue to the next QueueEntry
- When `active_player_id` is set, there must be a corresponding QueueEntry in `ACTIVE` state for that player

### Indexes

```sql
CREATE UNIQUE INDEX uq_queue_box ON queues(ticket_box_id);
CREATE INDEX idx_queue_active_player ON queues(active_player_id) WHERE active_player_id IS NOT NULL;
CREATE INDEX idx_queue_session_expires ON queues(session_expires_at) WHERE session_expires_at IS NOT NULL;
```

---

## 9. Queue Entry (佇列項目)

A single player's presence in a TicketBox queue. Ordered by `position` (assigned on join). Exactly one entry per queue may be `ACTIVE` at a time (the current draw session holder); all others are `WAITING`.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Surrogate primary key |
| `queue_id` | `UUID` | FK → Queue, NOT NULL | Parent queue |
| `player_id` | `UUID` | FK → Player, NOT NULL | The queued player |
| `position` | `INTEGER` | NOT NULL, CHECK > 0 | 1-based position (1 = currently drawing or first in line) |
| `status` | `queue_entry_status` ENUM | NOT NULL, default `WAITING` | `WAITING`, `ACTIVE`, `COMPLETED`, `ABANDONED`, `EVICTED` |
| `joined_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | When the player joined the queue |
| `activated_at` | `TIMESTAMPTZ` | NULLABLE | When this entry's session started |
| `completed_at` | `TIMESTAMPTZ` | NULLABLE | When the player voluntarily ended or the session expired |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

### Relationships

- `belongsTo` Queue (via `queue_id`)
- `belongsTo` Player (via `player_id`)

### Validation Rules

- A player may only have one non-terminal entry per queue at a time: composite unique index on `(queue_id, player_id)` filtered to `status IN ('WAITING', 'ACTIVE')`
- `position` must be unique within a queue for non-terminal entries
- Terminal states: `COMPLETED`, `ABANDONED`, `EVICTED` — entries in these states are retained for history but excluded from active queue computations
- `EVICTED` is used when the box sells out while the player is waiting (not holding the active session) — player is notified and removed
- When a player switches TicketBoxes, their entry in the original queue transitions to `ABANDONED` and a new entry is inserted in the target queue

### State Transitions

```
[WAITING]   -- queue advances (previous session ends)       --> [ACTIVE]
[WAITING]   -- player leaves queue voluntarily              --> [ABANDONED]
[WAITING]   -- box sells out while waiting                  --> [EVICTED]

[ACTIVE]    -- session expires or player ends session       --> [COMPLETED]
[ACTIVE]    -- player switches to another box               --> [ABANDONED]
[ACTIVE]    -- box sells out during active session          --> [COMPLETED]  (player finishes remaining draws if any)
```

### Indexes

```sql
CREATE INDEX idx_queue_entry_queue ON queue_entries(queue_id, status);
CREATE INDEX idx_queue_entry_player ON queue_entries(player_id) WHERE status IN ('WAITING', 'ACTIVE');
CREATE UNIQUE INDEX uq_queue_entry_active ON queue_entries(queue_id, player_id) WHERE status IN ('WAITING', 'ACTIVE');
CREATE INDEX idx_queue_entry_position ON queue_entries(queue_id, position) WHERE status IN ('WAITING', 'ACTIVE');
```

---

## 10. Shipping Order (寄送訂單)

Records a player's request to have a physical prize mailed to them. One-to-one with the PrizeInstance it covers. Operators fulfill and track shipment from the back-office.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Surrogate primary key |
| `player_id` | `UUID` | FK → Player, NOT NULL | Requesting player |
| `prize_instance_id` | `UUID` | FK → PrizeInstance, UNIQUE, NOT NULL | The prize being shipped (1-to-1) |
| `recipient_name` | `VARCHAR(128)` | NOT NULL | Recipient full name |
| `recipient_phone` | `VARCHAR(20)` | NOT NULL | Recipient contact phone (E.164) |
| `address_line1` | `VARCHAR(255)` | NOT NULL | Street address |
| `address_line2` | `VARCHAR(255)` | NULLABLE | Apt, floor, additional info |
| `city` | `VARCHAR(128)` | NOT NULL | City |
| `postal_code` | `VARCHAR(20)` | NOT NULL | Postal / ZIP code |
| `country_code` | `CHAR(2)` | NOT NULL, default `TW` | ISO 3166-1 alpha-2 country code |
| `tracking_number` | `VARCHAR(128)` | NULLABLE | Courier tracking number; set by operator on shipment |
| `carrier` | `VARCHAR(64)` | NULLABLE | Carrier name, e.g., `黑貓宅急便`, `郵局` |
| `status` | `shipping_order_status` ENUM | NOT NULL, default `PENDING_SHIPMENT` | `PENDING_SHIPMENT`, `SHIPPED`, `DELIVERED`, `CANCELLED` |
| `shipped_at` | `TIMESTAMPTZ` | NULLABLE | Set by operator |
| `delivered_at` | `TIMESTAMPTZ` | NULLABLE | Set on player confirmation or auto-confirm |
| `cancelled_at` | `TIMESTAMPTZ` | NULLABLE | Set when order is cancelled |
| `fulfilled_by_staff_id` | `UUID` | FK → Staff, NULLABLE | Operator who marked shipment |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

### Relationships

- `belongsTo` Player (via `player_id`)
- `belongsTo` PrizeInstance (via `prize_instance_id`)
- `belongsTo` Staff (via `fulfilled_by_staff_id`) — NULLABLE

### Validation Rules

- `prize_instance_id` is UNIQUE — a prize can only have one shipping order at a time
- Cancellation is only allowed while `status = PENDING_SHIPMENT`; once `SHIPPED`, cancellation requires a support ticket workflow
- `tracking_number` and `carrier` must be provided together when transitioning to `SHIPPED`
- Auto-confirm to `DELIVERED` triggered by a scheduled job N days (configurable) after `shipped_at` if player has not confirmed

### State Transitions

```
[PENDING_SHIPMENT]  -- operator marks shipped (fills tracking_number)  --> [SHIPPED]
[PENDING_SHIPMENT]  -- player cancels request                           --> [CANCELLED]

[SHIPPED]           -- player confirms receipt                          --> [DELIVERED]
[SHIPPED]           -- auto-confirm after timeout                       --> [DELIVERED]
```

`DELIVERED` and `CANCELLED` are terminal states.

### Indexes

```sql
CREATE UNIQUE INDEX uq_shipping_order_prize ON shipping_orders(prize_instance_id);
CREATE INDEX idx_shipping_order_player ON shipping_orders(player_id);
CREATE INDEX idx_shipping_order_status ON shipping_orders(status);
CREATE INDEX idx_shipping_order_staff ON shipping_orders(fulfilled_by_staff_id) WHERE fulfilled_by_staff_id IS NOT NULL;
```

---

## 11. Exchange Request (交換請求)

Represents a multi-to-multi prize swap proposal between two players. No points are involved. Either party can counter-propose (changing the offered prize sets) before acceptance. Subject to the global exchange feature flag.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Surrogate primary key |
| `initiator_id` | `UUID` | FK → Player, NOT NULL | Player who originated the request |
| `recipient_id` | `UUID` | FK → Player, NOT NULL | Player who received the request |
| `parent_request_id` | `UUID` | FK → ExchangeRequest, NULLABLE | Points to the request this is a counter-proposal of; NULL for root requests |
| `status` | `exchange_request_status` ENUM | NOT NULL, default `PENDING` | See state machine below |
| `message` | `TEXT` | NULLABLE | Optional note from initiator to recipient |
| `responded_at` | `TIMESTAMPTZ` | NULLABLE | When recipient accepted, rejected, or counter-proposed |
| `completed_at` | `TIMESTAMPTZ` | NULLABLE | When the swap was executed |
| `cancelled_at` | `TIMESTAMPTZ` | NULLABLE | When cancelled |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

### Relationships

- `belongsTo` Player as initiator (via `initiator_id`)
- `belongsTo` Player as recipient (via `recipient_id`)
- `belongsTo` ExchangeRequest as parent (via `parent_request_id`) — NULLABLE (self-referential)
- `hasMany` ExchangeRequest as counter-proposals (via `parent_request_id`)
- `hasMany` ExchangeRequestItem (via `exchange_request_id`)

### Validation Rules

- `initiator_id != recipient_id` — enforced by CHECK constraint
- A player cannot initiate a new exchange if they have an unresolved `PENDING` or `COUNTER_PROPOSED` exchange involving the same prize (application-layer check via PrizeInstance state)
- PrizeInstance items offered must be in `HOLDING` state at the time of request creation; the service layer transitions them to `EXCHANGING` atomically
- When the feature flag `exchange_feature` is disabled, new requests are rejected; existing `PENDING` or `COUNTER_PROPOSED` requests may still be resolved

### State Transitions

```
[PENDING]          -- recipient accepts                              --> [ACCEPTED] (then immediately COMPLETED atomically)
[PENDING]          -- recipient rejects                              --> [REJECTED]       (terminal)
[PENDING]          -- recipient counter-proposes                     --> [COUNTER_PROPOSED]
[PENDING]          -- initiator cancels                             --> [CANCELLED]       (terminal)
[PENDING]          -- one of the offered prizes is traded/bought     --> [CANCELLED]       (system, automatic)

[COUNTER_PROPOSED] -- original initiator accepts counter-proposal   --> [ACCEPTED] (then COMPLETED atomically)
[COUNTER_PROPOSED] -- original initiator rejects counter-proposal   --> [REJECTED]       (terminal)
[COUNTER_PROPOSED] -- either party cancels                          --> [CANCELLED]       (terminal)

[ACCEPTED]         -- swap executes successfully                     --> [COMPLETED]       (terminal)

[COMPLETED]        -- (terminal)
[REJECTED]         -- (terminal)
[CANCELLED]        -- (terminal)
```

### Indexes

```sql
CREATE INDEX idx_exchange_initiator ON exchange_requests(initiator_id, status);
CREATE INDEX idx_exchange_recipient ON exchange_requests(recipient_id, status);
CREATE INDEX idx_exchange_parent ON exchange_requests(parent_request_id) WHERE parent_request_id IS NOT NULL;
CREATE INDEX idx_exchange_status ON exchange_requests(status) WHERE status IN ('PENDING', 'COUNTER_PROPOSED');
```

---

## 12. Exchange Request Item (交換請求賞品項目)

Junction table that records which PrizeInstances each party is offering in an ExchangeRequest. The `side` column identifies whether the item belongs to the initiator or the recipient.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Surrogate primary key |
| `exchange_request_id` | `UUID` | FK → ExchangeRequest, NOT NULL | Parent request |
| `prize_instance_id` | `UUID` | FK → PrizeInstance, NOT NULL | The offered prize |
| `side` | `exchange_item_side` ENUM | NOT NULL | `INITIATOR`, `RECIPIENT` |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

### Relationships

- `belongsTo` ExchangeRequest (via `exchange_request_id`)
- `belongsTo` PrizeInstance (via `prize_instance_id`)

### Validation Rules

- A PrizeInstance may only appear once per request (composite unique index on `exchange_request_id, prize_instance_id`)
- Each side must offer at least one prize (validated at service layer before persisting)
- `side` must match the player role: items offered by `initiator_id` must have `side = INITIATOR`; items offered by `recipient_id` must have `side = RECIPIENT`

### Indexes

```sql
CREATE UNIQUE INDEX uq_exchange_item ON exchange_request_items(exchange_request_id, prize_instance_id);
CREATE INDEX idx_exchange_item_prize ON exchange_request_items(prize_instance_id);
```

---

## 13. Trade Order (交易訂單)

Records a player-to-player prize sale via the marketplace. The seller lists the prize at a draw-point price; a buyer purchases it. A platform fee (configurable percentage) is deducted from the seller's revenue points credit.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Surrogate primary key |
| `seller_id` | `UUID` | FK → Player, NOT NULL | Seller (current prize owner at listing time) |
| `buyer_id` | `UUID` | FK → Player, NULLABLE | Buyer; NULL until purchased |
| `prize_instance_id` | `UUID` | FK → PrizeInstance, NOT NULL | The prize for sale |
| `list_price` | `INTEGER` | NOT NULL, CHECK > 0 | Asking price in draw points |
| `fee_rate_bps` | `INTEGER` | NOT NULL, CHECK >= 0 | Platform fee rate at listing time in basis points (e.g., 500 = 5.00%) |
| `fee_amount` | `INTEGER` | NULLABLE, CHECK >= 0 | Computed fee in points = `ROUND(list_price * fee_rate_bps / 10000)` |
| `seller_proceeds` | `INTEGER` | NULLABLE, CHECK >= 0 | `list_price - fee_amount`; credited to seller as revenue points |
| `status` | `trade_order_status` ENUM | NOT NULL, default `LISTED` | `LISTED`, `COMPLETED`, `CANCELLED` |
| `listed_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | When the item was listed |
| `completed_at` | `TIMESTAMPTZ` | NULLABLE | When the sale completed |
| `cancelled_at` | `TIMESTAMPTZ` | NULLABLE | When the listing was cancelled |
| `deleted_at` | `TIMESTAMPTZ` | NULLABLE | Soft delete |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

### Relationships

- `belongsTo` Player as seller (via `seller_id`)
- `belongsTo` Player as buyer (via `buyer_id`) — NULLABLE
- `belongsTo` PrizeInstance (via `prize_instance_id`)
- `hasMany` DrawPointTransaction (buyer debit, via `trade_order_id`)
- `hasMany` RevenuePointTransaction (seller credit, via `trade_order_id`)

### Validation Rules

- `seller_id != buyer_id` — system MUST reject self-purchase (FR-014 edge case); enforced at application layer with a clear error
- A prize may only have one `LISTED` trade order at a time: partial unique index on `(prize_instance_id)` where `status = 'LISTED'`
- `fee_amount` and `seller_proceeds` are calculated and stored at the time of purchase (not at listing time), using the `fee_rate_bps` captured at listing
- The purchase must be atomic: debit buyer's draw points, credit seller's revenue points, update PrizeInstance ownership and state, update TradeOrder status — all in one database transaction
- Optimistic locking on Player balances (via `version` column) prevents double-spend

### State Transitions

```
[LISTED]     -- buyer purchases                           --> [COMPLETED]  (terminal)
[LISTED]     -- seller cancels listing                    --> [CANCELLED]  (terminal)
[LISTED]     -- account frozen (background job)           --> [CANCELLED]  (terminal)
```

### Indexes

```sql
CREATE INDEX idx_trade_order_seller ON trade_orders(seller_id, status);
CREATE INDEX idx_trade_order_buyer ON trade_orders(buyer_id) WHERE buyer_id IS NOT NULL;
CREATE UNIQUE INDEX uq_trade_order_listed ON trade_orders(prize_instance_id) WHERE status = 'LISTED';
CREATE INDEX idx_trade_order_status ON trade_orders(status, listed_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_trade_order_listed_at ON trade_orders(listed_at DESC) WHERE status = 'LISTED';
```

---

## 14. Buyback Record (回收紀錄)

An immutable record of a prize being sold back to the platform at the official buyback price. The price is captured at submission time so retroactive price changes do not affect already-submitted records.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Surrogate primary key |
| `player_id` | `UUID` | FK → Player, NOT NULL | Player who initiated buyback |
| `prize_instance_id` | `UUID` | FK → PrizeInstance, UNIQUE, NOT NULL | The recycled prize (1-to-1) |
| `prize_definition_id` | `UUID` | FK → PrizeDefinition, NOT NULL | Snapshotted for analytics (definition may change) |
| `buyback_price` | `INTEGER` | NOT NULL, CHECK >= 0 | Revenue points credited; snapshotted at submission (FR-018 edge case) |
| `processed_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | When points were credited and prize removed |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

### Relationships

- `belongsTo` Player (via `player_id`)
- `belongsTo` PrizeInstance (via `prize_instance_id`)
- `belongsTo` PrizeDefinition (via `prize_definition_id`)
- `hasOne` RevenuePointTransaction (via `buyback_record_id`)

### Validation Rules

- `prize_instance_id` is UNIQUE — a prize can only be bought back once
- `buyback_price` is snapshotted from `PrizeDefinition.buyback_price` at the moment the player confirms buyback — immutable thereafter
- The buyback transaction (credit revenue points + set PrizeInstance to `RECYCLED` + insert BuybackRecord) is a single atomic DB transaction

### Indexes

```sql
CREATE UNIQUE INDEX uq_buyback_prize ON buyback_records(prize_instance_id);
CREATE INDEX idx_buyback_player ON buyback_records(player_id, processed_at DESC);
CREATE INDEX idx_buyback_prize_def ON buyback_records(prize_definition_id);
```

---

## 15. Draw Point Transaction (消費點數紀錄)

Immutable ledger entry for every mutation to a player's `draw_points_balance`. Follows double-entry principles: debit entries are negative `amount`, credit entries are positive. The balance on Player is the authoritative number; this table provides the audit trail and reconciliation source.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Surrogate primary key |
| `player_id` | `UUID` | FK → Player, NOT NULL | Account holder |
| `type` | `draw_point_tx_type` ENUM | NOT NULL | `PURCHASE_CREDIT`, `KUJI_DRAW_DEBIT`, `UNLIMITED_DRAW_DEBIT`, `TRADE_PURCHASE_DEBIT`, `COUPON_DISCOUNT_CREDIT`, `REFUND_CREDIT`, `ADMIN_ADJUSTMENT` |
| `amount` | `INTEGER` | NOT NULL | Positive = credit, Negative = debit; non-zero enforced by CHECK `amount != 0` |
| `balance_after` | `INTEGER` | NOT NULL, CHECK >= 0 | Player's `draw_points_balance` immediately after this transaction; for audit/reconciliation |
| `payment_order_id` | `UUID` | FK → PaymentOrder, NULLABLE | Linked for `PURCHASE_CREDIT` and `REFUND_CREDIT` |
| `trade_order_id` | `UUID` | FK → TradeOrder, NULLABLE | Linked for `TRADE_PURCHASE_DEBIT` |
| `draw_ticket_id` | `UUID` | FK → DrawTicket, NULLABLE | Linked for `KUJI_DRAW_DEBIT` |
| `unlimited_campaign_id` | `UUID` | FK → UnlimitedCampaign, NULLABLE | Linked for `UNLIMITED_DRAW_DEBIT` |
| `player_coupon_id` | `UUID` | FK → PlayerCoupon, NULLABLE | Linked when a coupon discount applies |
| `original_amount` | `INTEGER` | NULLABLE | Pre-discount amount for coupon-discounted draws |
| `discount_amount` | `INTEGER` | NULLABLE, CHECK >= 0 | Points saved by coupon; `original_amount - ABS(amount)` |
| `description` | `TEXT` | NULLABLE | Human-readable note for admin adjustments |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | Immutable timestamp |

### Relationships

- `belongsTo` Player (via `player_id`)
- `belongsTo` PaymentOrder (via `payment_order_id`) — NULLABLE
- `belongsTo` TradeOrder (via `trade_order_id`) — NULLABLE
- `belongsTo` DrawTicket (via `draw_ticket_id`) — NULLABLE
- `belongsTo` UnlimitedCampaign (via `unlimited_campaign_id`) — NULLABLE
- `belongsTo` PlayerCoupon (via `player_coupon_id`) — NULLABLE

### Validation Rules

- Records are INSERT-only; no UPDATE or DELETE operations are permitted (enforced via PostgreSQL row-level security or application policy)
- `balance_after` must equal the player's `draw_points_balance` after applying `amount`; validated in the transaction before commit
- Exactly one reference FK should be non-NULL matching the `type`; validated at service layer

### Indexes

```sql
CREATE INDEX idx_draw_tx_player ON draw_point_transactions(player_id, created_at DESC);
CREATE INDEX idx_draw_tx_payment ON draw_point_transactions(payment_order_id) WHERE payment_order_id IS NOT NULL;
CREATE INDEX idx_draw_tx_trade ON draw_point_transactions(trade_order_id) WHERE trade_order_id IS NOT NULL;
CREATE INDEX idx_draw_tx_type ON draw_point_transactions(type, created_at DESC);
```

---

## 16. Revenue Point Transaction (收益點數紀錄)

Immutable ledger entry for every mutation to a player's `revenue_points_balance`. Mirrors the structure of DrawPointTransaction but for the separate revenue points ledger.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Surrogate primary key |
| `player_id` | `UUID` | FK → Player, NOT NULL | Account holder |
| `type` | `revenue_point_tx_type` ENUM | NOT NULL | `TRADE_SALE_CREDIT`, `BUYBACK_CREDIT`, `WITHDRAWAL_DEBIT`, `ADMIN_ADJUSTMENT` |
| `amount` | `INTEGER` | NOT NULL | Positive = credit, Negative = debit; CHECK `amount != 0` |
| `balance_after` | `INTEGER` | NOT NULL, CHECK >= 0 | Player's `revenue_points_balance` after this transaction |
| `trade_order_id` | `UUID` | FK → TradeOrder, NULLABLE | Linked for `TRADE_SALE_CREDIT` |
| `buyback_record_id` | `UUID` | FK → BuybackRecord, NULLABLE | Linked for `BUYBACK_CREDIT` |
| `withdrawal_request_id` | `UUID` | FK → WithdrawalRequest, NULLABLE | Linked for `WITHDRAWAL_DEBIT` |
| `description` | `TEXT` | NULLABLE | Human-readable note |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | Immutable timestamp |

### Relationships

- `belongsTo` Player (via `player_id`)
- `belongsTo` TradeOrder (via `trade_order_id`) — NULLABLE
- `belongsTo` BuybackRecord (via `buyback_record_id`) — NULLABLE
- `belongsTo` WithdrawalRequest (via `withdrawal_request_id`) — NULLABLE

### Validation Rules

- Records are INSERT-only (same as DrawPointTransaction)
- `balance_after >= 0` enforced by CHECK
- `WITHDRAWAL_DEBIT` amount must be negative; `TRADE_SALE_CREDIT` and `BUYBACK_CREDIT` must be positive

### Indexes

```sql
CREATE INDEX idx_rev_tx_player ON revenue_point_transactions(player_id, created_at DESC);
CREATE INDEX idx_rev_tx_trade ON revenue_point_transactions(trade_order_id) WHERE trade_order_id IS NOT NULL;
CREATE INDEX idx_rev_tx_buyback ON revenue_point_transactions(buyback_record_id) WHERE buyback_record_id IS NOT NULL;
CREATE INDEX idx_rev_tx_withdrawal ON revenue_point_transactions(withdrawal_request_id) WHERE withdrawal_request_id IS NOT NULL;
```

---

## 17. Payment Order (金流訂單)

Records a player's fiat-currency purchase of draw points via a third-party payment gateway. Points are only credited once the gateway confirms payment (via callback). Gateway-specific details are stored in a JSONB metadata column.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Surrogate primary key; also used as the merchant order ID sent to gateway |
| `player_id` | `UUID` | FK → Player, NOT NULL | Purchasing player |
| `fiat_amount` | `INTEGER` | NOT NULL, CHECK > 0 | Charge amount in the smallest currency unit (e.g., TWD cents; 1 TWD = 1 unit for TWD which has no sub-units) |
| `currency_code` | `CHAR(3)` | NOT NULL, default `TWD` | ISO 4217 currency code |
| `draw_points_granted` | `INTEGER` | NOT NULL, CHECK > 0 | Draw points credited on success |
| `gateway` | `payment_gateway` ENUM | NOT NULL | `ECPAY`, `NEWEBPAY`, `STRIPE`, `APPLEPAY`, `GOOGLEPAY` |
| `gateway_transaction_id` | `VARCHAR(255)` | NULLABLE | Third-party transaction reference; unique when non-NULL |
| `payment_method` | `VARCHAR(64)` | NULLABLE | e.g., `credit_card`, `atm`, `cvs_code`, `apple_pay` |
| `gateway_metadata` | `JSONB` | NOT NULL, default `{}` | Raw gateway response data for debugging / reconciliation |
| `status` | `payment_order_status` ENUM | NOT NULL, default `PENDING` | `PENDING`, `PAID`, `FAILED`, `REFUNDED` |
| `paid_at` | `TIMESTAMPTZ` | NULLABLE | Gateway-confirmed payment timestamp |
| `failed_at` | `TIMESTAMPTZ` | NULLABLE | |
| `refunded_at` | `TIMESTAMPTZ` | NULLABLE | |
| `expires_at` | `TIMESTAMPTZ` | NULLABLE | Payment window expiry (e.g., CVS code expires in 3 days) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

### Relationships

- `belongsTo` Player (via `player_id`)
- `hasOne` DrawPointTransaction of type `PURCHASE_CREDIT` (via `payment_order_id`)

### Validation Rules

- `gateway_transaction_id` must be unique when non-NULL (partial unique index); duplicate callbacks for the same gateway transaction are idempotently ignored
- Points are credited (`status → PAID` + insert DrawPointTransaction + increment `draw_points_balance`) in a single atomic transaction triggered by the gateway callback
- If the callback arrives but the player account no longer exists (soft-deleted), the payment is recorded as `PAID` but points are held for manual resolution
- Retry logic for callback processing must be idempotent: check `status = PAID` before crediting

### State Transitions

```
[PENDING]   -- gateway callback confirms payment     --> [PAID]       (terminal; points credited)
[PENDING]   -- gateway callback reports failure      --> [FAILED]     (terminal)
[PENDING]   -- payment window expires (scheduled)    --> [FAILED]     (terminal)
[PAID]      -- admin initiates refund                --> [REFUNDED]   (terminal; points debited via REFUND_CREDIT tx)
```

### Indexes

```sql
CREATE INDEX idx_payment_order_player ON payment_orders(player_id, created_at DESC);
CREATE INDEX idx_payment_order_status ON payment_orders(status, created_at DESC);
CREATE UNIQUE INDEX uq_payment_gateway_tx ON payment_orders(gateway, gateway_transaction_id) WHERE gateway_transaction_id IS NOT NULL;
CREATE INDEX idx_payment_order_expires ON payment_orders(expires_at) WHERE status = 'PENDING' AND expires_at IS NOT NULL;
```

---

## 18. Withdrawal Request (提領申請)

A player's request to convert revenue points to fiat currency via bank transfer. Requires manual staff approval. The revenue points are reserved (debited) on submission; if rejected, they are refunded.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Surrogate primary key |
| `player_id` | `UUID` | FK → Player, NOT NULL | Requesting player |
| `points_amount` | `INTEGER` | NOT NULL, CHECK > 0 | Revenue points to withdraw |
| `fiat_amount` | `INTEGER` | NOT NULL, CHECK > 0 | Equivalent fiat in smallest currency unit |
| `currency_code` | `CHAR(3)` | NOT NULL, default `TWD` | ISO 4217 |
| `bank_name` | `VARCHAR(128)` | NOT NULL | Bank name |
| `bank_code` | `VARCHAR(16)` | NOT NULL | Bank routing / branch code |
| `account_holder_name` | `VARCHAR(128)` | NOT NULL | Account holder legal name |
| `account_number` | `VARCHAR(64)` | NOT NULL | Bank account number (stored encrypted at rest) |
| `status` | `withdrawal_status` ENUM | NOT NULL, default `PENDING_REVIEW` | `PENDING_REVIEW`, `APPROVED`, `TRANSFERRED`, `REJECTED` |
| `reviewed_by_staff_id` | `UUID` | FK → Staff, NULLABLE | Staff who approved or rejected |
| `reviewed_at` | `TIMESTAMPTZ` | NULLABLE | |
| `transferred_at` | `TIMESTAMPTZ` | NULLABLE | When the bank transfer was executed |
| `rejection_reason` | `TEXT` | NULLABLE | Staff's reason for rejection |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

### Relationships

- `belongsTo` Player (via `player_id`)
- `belongsTo` Staff (via `reviewed_by_staff_id`) — NULLABLE
- `hasOne` RevenuePointTransaction of type `WITHDRAWAL_DEBIT` (via `withdrawal_request_id`)

### Validation Rules

- `points_amount` must not exceed the player's current `revenue_points_balance` at submission time
- Revenue points are debited (`WITHDRAWAL_DEBIT` transaction) atomically at submission — balance is reserved; if rejected, a compensating `ADMIN_ADJUSTMENT` credit is issued
- `account_number` must be encrypted at rest (application-layer encryption before persistence)
- A player may have multiple simultaneous withdrawal requests; no uniqueness constraint on player/status
- `fiat_amount` is calculated from `points_amount` using the platform's current point-to-fiat conversion rate (configurable, stored elsewhere); snapshotted at request time

### State Transitions

```
[PENDING_REVIEW]  -- staff approves                     --> [APPROVED]
[PENDING_REVIEW]  -- staff rejects (reason required)    --> [REJECTED]  (terminal; points refunded via ADMIN_ADJUSTMENT)

[APPROVED]        -- bank transfer executed              --> [TRANSFERRED]  (terminal)
[APPROVED]        -- staff reverses approval             --> [REJECTED]     (terminal; points refunded)
```

### Indexes

```sql
CREATE INDEX idx_withdrawal_player ON withdrawal_requests(player_id, created_at DESC);
CREATE INDEX idx_withdrawal_status ON withdrawal_requests(status, created_at ASC);
CREATE INDEX idx_withdrawal_reviewer ON withdrawal_requests(reviewed_by_staff_id) WHERE reviewed_by_staff_id IS NOT NULL;
```

---

## 19. Support Ticket (客服工單)

A player-submitted issue report. Supports multi-message conversation between player and customer service staff. Optionally synced with LINE Official Account (Taiwan market). Linked to optional context entities (trade order, draw ticket, etc.) for faster agent resolution.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Surrogate primary key |
| `player_id` | `UUID` | FK → Player, NOT NULL | Player who submitted |
| `assigned_to_staff_id` | `UUID` | FK → Staff, NULLABLE | Assigned CS agent |
| `category` | `support_ticket_category` ENUM | NOT NULL | `DRAW_DISPUTE`, `TRADE_DISPUTE`, `PAYMENT_ISSUE`, `ACCOUNT_ISSUE`, `SHIPPING_ISSUE`, `OTHER` |
| `subject` | `VARCHAR(255)` | NOT NULL | Short description |
| `status` | `support_ticket_status` ENUM | NOT NULL, default `OPEN` | `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED` |
| `priority` | `support_ticket_priority` ENUM | NOT NULL, default `NORMAL` | `LOW`, `NORMAL`, `HIGH`, `URGENT` |
| `satisfaction_score` | `SMALLINT` | NULLABLE, CHECK BETWEEN 1 AND 5 | Player satisfaction rating on close |
| `line_thread_id` | `VARCHAR(255)` | NULLABLE | LINE conversation thread ID for sync |
| `context_trade_order_id` | `UUID` | FK → TradeOrder, NULLABLE | Related trade order for context |
| `context_payment_order_id` | `UUID` | FK → PaymentOrder, NULLABLE | Related payment for context |
| `context_shipping_order_id` | `UUID` | FK → ShippingOrder, NULLABLE | Related shipping order for context |
| `context_withdrawal_id` | `UUID` | FK → WithdrawalRequest, NULLABLE | Related withdrawal for context |
| `resolved_at` | `TIMESTAMPTZ` | NULLABLE | When marked resolved |
| `closed_at` | `TIMESTAMPTZ` | NULLABLE | When fully closed |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

### Relationships

- `belongsTo` Player (via `player_id`)
- `belongsTo` Staff (via `assigned_to_staff_id`) — NULLABLE
- `hasMany` SupportTicketMessage (via `support_ticket_id`)

### Validation Rules

- At most one open ticket per player per category per day (advisory limit; enforced at service layer to reduce spam)
- `satisfaction_score` can only be set when `status = CLOSED`
- Context FK fields are optional hints for agents; their presence is not validated against ticket category

### State Transitions

```
[OPEN]         -- agent picks up / assigns              --> [IN_PROGRESS]
[OPEN]         -- agent resolves directly               --> [RESOLVED]
[IN_PROGRESS]  -- agent marks resolved                  --> [RESOLVED]
[RESOLVED]     -- player or auto-close after N days     --> [CLOSED]      (terminal)
[RESOLVED]     -- player reopens (within grace period)  --> [IN_PROGRESS]
```

### Indexes

```sql
CREATE INDEX idx_support_ticket_player ON support_tickets(player_id, created_at DESC);
CREATE INDEX idx_support_ticket_status ON support_tickets(status, priority, created_at ASC) WHERE status IN ('OPEN', 'IN_PROGRESS');
CREATE INDEX idx_support_ticket_assigned ON support_tickets(assigned_to_staff_id) WHERE assigned_to_staff_id IS NOT NULL;
```

---

## 20. Support Ticket Message (工單訊息)

A single message in a SupportTicket conversation. Authored by either a player or a staff member. LINE-sourced messages carry a `line_message_id` for deduplication.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Surrogate primary key |
| `support_ticket_id` | `UUID` | FK → SupportTicket, NOT NULL | Parent ticket |
| `author_player_id` | `UUID` | FK → Player, NULLABLE | Set when authored by player |
| `author_staff_id` | `UUID` | FK → Staff, NULLABLE | Set when authored by staff |
| `body` | `TEXT` | NOT NULL | Message content |
| `attachments` | `JSONB` | NOT NULL, default `[]` | Array of `{ "url": "...", "mime_type": "..." }` |
| `channel` | `message_channel` ENUM | NOT NULL, default `PLATFORM` | `PLATFORM`, `LINE` |
| `line_message_id` | `VARCHAR(255)` | UNIQUE, NULLABLE | LINE message ID; for deduplication |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

### Relationships

- `belongsTo` SupportTicket (via `support_ticket_id`)
- `belongsTo` Player (via `author_player_id`) — NULLABLE
- `belongsTo` Staff (via `author_staff_id`) — NULLABLE

### Validation Rules

- Exactly one of `author_player_id` or `author_staff_id` must be non-NULL (CHECK: `(author_player_id IS NULL) != (author_staff_id IS NULL)`)
- `line_message_id` is UNIQUE to prevent duplicate LINE webhook deliveries
- Messages are append-only; no UPDATE or DELETE

### Indexes

```sql
CREATE INDEX idx_ticket_message_ticket ON support_ticket_messages(support_ticket_id, created_at ASC);
CREATE UNIQUE INDEX uq_ticket_message_line ON support_ticket_messages(line_message_id) WHERE line_message_id IS NOT NULL;
```

---

## 21. Coupon (優惠券)

A discount template created by operators. Multiple players can hold instances of the same coupon (via PlayerCoupon). Coupons can be distributed automatically (system push) or redeemed via a DiscountCode.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Surrogate primary key |
| `name` | `VARCHAR(128)` | NOT NULL | Internal coupon name |
| `description` | `TEXT` | NULLABLE | Player-facing description |
| `discount_type` | `coupon_discount_type` ENUM | NOT NULL | `PERCENTAGE` (e.g., 20% off), `FIXED_POINTS` (e.g., 100 points off) |
| `discount_value` | `INTEGER` | NOT NULL, CHECK > 0 | Percentage (e.g., 20 = 20%) or fixed points depending on `discount_type` |
| `applicable_to` | `coupon_applicable_to` ENUM | NOT NULL, default `ALL` | `ALL`, `KUJI_ONLY`, `UNLIMITED_ONLY` |
| `max_uses_per_player` | `INTEGER` | NOT NULL, default 1, CHECK > 0 | Maximum times a single player may use this coupon |
| `total_issued` | `INTEGER` | NOT NULL, default 0, CHECK >= 0 | Total PlayerCoupon rows created from this coupon |
| `total_used` | `INTEGER` | NOT NULL, default 0, CHECK >= 0 | Total times coupon was applied to a draw |
| `issue_limit` | `INTEGER` | NULLABLE, CHECK > 0 | Max total issues; NULL = unlimited |
| `valid_from` | `TIMESTAMPTZ` | NOT NULL | Coupon becomes usable from this time |
| `valid_until` | `TIMESTAMPTZ` | NOT NULL | Coupon expires at this time |
| `is_active` | `BOOLEAN` | NOT NULL, default TRUE | Operator can disable without deleting |
| `created_by_staff_id` | `UUID` | FK → Staff, NOT NULL | |
| `deleted_at` | `TIMESTAMPTZ` | NULLABLE | Soft delete |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

### Relationships

- `hasMany` PlayerCoupon (via `coupon_id`)
- `hasMany` DiscountCode (via `coupon_id`)
- `belongsTo` Staff (via `created_by_staff_id`)

### Validation Rules

- `valid_from < valid_until`
- `discount_value` for `PERCENTAGE` type must be between 1 and 99 (inclusive) — enforced at service layer
- `total_issued <= issue_limit` when `issue_limit IS NOT NULL`; enforced with a FOR UPDATE lock on the Coupon row during issue

### Indexes

```sql
CREATE INDEX idx_coupon_active ON coupons(is_active, valid_from, valid_until) WHERE deleted_at IS NULL;
CREATE INDEX idx_coupon_created_by ON coupons(created_by_staff_id);
```

---

## 22. Discount Code (折扣碼)

A redeemable code string that, when entered by a player, issues them a PlayerCoupon from the associated Coupon template. Codes can be single-use or multi-use with a cap.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Surrogate primary key |
| `coupon_id` | `UUID` | FK → Coupon, NOT NULL | The coupon issued on redemption |
| `code` | `VARCHAR(64)` | NOT NULL, UNIQUE | Case-insensitive redemption code (stored uppercase) |
| `redemption_limit` | `INTEGER` | NULLABLE, CHECK > 0 | Total redemptions allowed; NULL = unlimited |
| `redemption_count` | `INTEGER` | NOT NULL, default 0, CHECK >= 0 | Current redemption count |
| `is_active` | `BOOLEAN` | NOT NULL, default TRUE | Operator can deactivate |
| `deleted_at` | `TIMESTAMPTZ` | NULLABLE | Soft delete |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

### Relationships

- `belongsTo` Coupon (via `coupon_id`)

### Validation Rules

- `code` is stored uppercase and indexed with a unique constraint (case-insensitive lookup via `UPPER(code)`)
- `redemption_count < redemption_limit` (when `redemption_limit IS NOT NULL`) enforced with FOR UPDATE lock on DiscountCode row during redemption
- A player may only redeem the same code once (enforced via PlayerCoupon + unique constraint on `(player_id, discount_code_id)` in PlayerCoupon)

### Indexes

```sql
CREATE UNIQUE INDEX uq_discount_code ON discount_codes(UPPER(code));
CREATE INDEX idx_discount_code_coupon ON discount_codes(coupon_id);
```

---

## 23. Player Coupon (玩家優惠券)

The join entity between a Player and a Coupon. Represents a specific coupon instance in a player's wallet. Tracks per-instance usage count.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Surrogate primary key |
| `player_id` | `UUID` | FK → Player, NOT NULL | Coupon holder |
| `coupon_id` | `UUID` | FK → Coupon, NOT NULL | Source coupon template |
| `discount_code_id` | `UUID` | FK → DiscountCode, NULLABLE | Source discount code if redeemed via code |
| `use_count` | `INTEGER` | NOT NULL, default 0, CHECK >= 0 | How many times this instance has been used |
| `status` | `player_coupon_status` ENUM | NOT NULL, default `ACTIVE` | `ACTIVE`, `EXHAUSTED`, `EXPIRED` |
| `issued_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | When this coupon was added to the player's wallet |
| `last_used_at` | `TIMESTAMPTZ` | NULLABLE | Last draw time this coupon was applied |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

### Relationships

- `belongsTo` Player (via `player_id`)
- `belongsTo` Coupon (via `coupon_id`)
- `belongsTo` DiscountCode (via `discount_code_id`) — NULLABLE
- `hasMany` DrawPointTransaction (via `player_coupon_id`)

### Validation Rules

- Composite unique on `(player_id, coupon_id)` if the Coupon's `max_uses_per_player` design requires one wallet entry per coupon (service layer decides whether to increment `use_count` or reject); alternatively, one row per issuance up to `max_uses_per_player` uses
- Composite unique on `(player_id, discount_code_id)` where `discount_code_id IS NOT NULL` — a player can only redeem a specific code once
- `status` transitions to `EXHAUSTED` when `use_count >= coupon.max_uses_per_player`; transitions to `EXPIRED` when current time > `coupon.valid_until`

### Indexes

```sql
CREATE UNIQUE INDEX uq_player_coupon ON player_coupons(player_id, coupon_id);
CREATE UNIQUE INDEX uq_player_discount_code ON player_coupons(player_id, discount_code_id) WHERE discount_code_id IS NOT NULL;
CREATE INDEX idx_player_coupon_status ON player_coupons(player_id, status);
```

---

## 24. Audit Log (操作紀錄)

Append-only log of all significant system events: staff back-office operations and player key actions. Stores a structured JSON snapshot of the change for forensic replay.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Surrogate primary key |
| `actor_type` | `audit_actor_type` ENUM | NOT NULL | `PLAYER`, `STAFF`, `SYSTEM` |
| `actor_player_id` | `UUID` | FK → Player, NULLABLE | Set when `actor_type = PLAYER` |
| `actor_staff_id` | `UUID` | FK → Staff, NULLABLE | Set when `actor_type = STAFF` |
| `action` | `VARCHAR(128)` | NOT NULL | Dot-namespaced action key, e.g., `campaign.kuji.activated`, `prize_instance.sold`, `feature_flag.updated` |
| `entity_type` | `VARCHAR(64)` | NOT NULL | Target entity name, e.g., `KujiCampaign`, `Player`, `FeatureFlag` |
| `entity_id` | `UUID` | NULLABLE | Target entity PK; NULL for collection-level actions |
| `before_value` | `JSONB` | NULLABLE | Entity state snapshot before the mutation |
| `after_value` | `JSONB` | NULLABLE | Entity state snapshot after the mutation |
| `metadata` | `JSONB` | NOT NULL, default `{}` | Additional context (IP address, user agent, session ID, request ID) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | Immutable event time |

### Relationships

- `belongsTo` Player (via `actor_player_id`) — NULLABLE
- `belongsTo` Staff (via `actor_staff_id`) — NULLABLE

### Validation Rules

- Records are INSERT-only; no UPDATE or DELETE (enforced via PostgreSQL RLS or application policy)
- Exactly one of `actor_player_id`, `actor_staff_id` must be non-NULL when `actor_type` is `PLAYER` or `STAFF` respectively; both NULL when `actor_type = SYSTEM`
- `before_value` and `after_value` are both NULL for pure read events (e.g., login); at least `after_value` is non-NULL for mutations
- Retained indefinitely for compliance; archival strategy (e.g., to cold storage after 2 years) is an operational concern

### Indexes

```sql
CREATE INDEX idx_audit_actor_player ON audit_logs(actor_player_id, created_at DESC) WHERE actor_player_id IS NOT NULL;
CREATE INDEX idx_audit_actor_staff ON audit_logs(actor_staff_id, created_at DESC) WHERE actor_staff_id IS NOT NULL;
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at DESC);
```

---

## 25. Staff (後台人員)

Platform employees with back-office access. Role determines permission scope. Staff authenticate via the internal admin SSO; they are distinct from the Player table.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Surrogate primary key |
| `name` | `VARCHAR(128)` | NOT NULL | Display name |
| `email` | `VARCHAR(255)` | NOT NULL, UNIQUE | Login email |
| `hashed_password` | `VARCHAR(255)` | NOT NULL | Bcrypt hash (min cost 12); Staff use email+password login |
| `role` | `staff_role` ENUM | NOT NULL | `CUSTOMER_SERVICE`, `OPERATOR`, `ADMIN`, `OWNER` |
| `is_active` | `BOOLEAN` | NOT NULL, default TRUE | Set to FALSE to revoke access without deletion |
| `last_login_at` | `TIMESTAMPTZ` | NULLABLE | For security auditing |
| `created_by_staff_id` | `UUID` | FK → Staff, NULLABLE | Admin who created this account |
| `deleted_at` | `TIMESTAMPTZ` | NULLABLE | Soft delete |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

### Role Permission Matrix

| Capability | CUSTOMER_SERVICE | OPERATOR | ADMIN | OWNER |
|---|---|---|---|---|
| View / respond to support tickets | Yes | No | Yes | Yes |
| View player records & history | Yes | No | Yes | Yes |
| Create / manage campaigns | No | Yes | Yes | Yes |
| Manage prize prices & fee rates | No | Yes | Yes | Yes |
| Manage coupons & discount codes | No | Yes | Yes | Yes |
| Fulfill shipping orders | No | Yes | Yes | Yes |
| Review withdrawal requests | No | Yes | Yes | Yes |
| Manage staff accounts & roles | No | No | Yes | Yes |
| Manage feature flags | No | No | Yes | Yes |
| View operational dashboard | No | Yes | Yes | Yes |
| View full financial reports | No | No | No | Yes |

### Relationships

- `hasMany` KujiCampaign (via `created_by_staff_id`)
- `hasMany` UnlimitedCampaign (via `created_by_staff_id`)
- `hasMany` WithdrawalRequest (via `reviewed_by_staff_id`)
- `hasMany` ShippingOrder (via `fulfilled_by_staff_id`)
- `hasMany` SupportTicket (via `assigned_to_staff_id`)
- `hasMany` SupportTicketMessage (via `author_staff_id`)
- `hasMany` AuditLog (via `actor_staff_id`)
- `hasMany` Coupon (via `created_by_staff_id`)
- `hasMany` FeatureFlag (via `updated_by_staff_id`)

### Validation Rules

- `email` must be unique (UNIQUE constraint)
- An `OWNER` role can only be assigned by another `OWNER` — enforced at service layer
- Self-role-demotion is prohibited — enforced at service layer
- Soft-deleted staff accounts (`deleted_at IS NOT NULL`) retain all historical associations for audit trail integrity; their `is_active` must be `FALSE`

### State Transitions (Account)

```
[active]     -- admin deactivates   --> [inactive]
[inactive]   -- admin reactivates   --> [active]
[active]     -- admin soft-deletes  --> [deleted]
```

### Indexes

```sql
CREATE UNIQUE INDEX uq_staff_email ON staff(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_staff_role ON staff(role) WHERE is_active = TRUE AND deleted_at IS NULL;
```

---

## 26. Feature Flag (功能開關)

Runtime toggles managed by administrators. Support four control dimensions: global on/off, group-based (player segment), platform-based (Android/iOS/Web), and percentage-based rollout. No code deployment is required to change a flag's state.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Surrogate primary key |
| `name` | `VARCHAR(128)` | NOT NULL, UNIQUE | Stable machine-readable key, e.g., `exchange_feature`, `leaderboard`, `coupon_system`, `animation_options`, `spectator_mode`, `line_cs_channel` |
| `display_name` | `VARCHAR(255)` | NOT NULL | Human-readable label for the admin UI |
| `description` | `TEXT` | NULLABLE | Intent and impact of this flag |
| `enabled` | `BOOLEAN` | NOT NULL, default FALSE | Global master switch; when FALSE the feature is OFF for all regardless of `rules` |
| `rules` | `JSONB` | NOT NULL, default `{}` | Structured targeting rules evaluated when `enabled = TRUE` |
| `updated_by_staff_id` | `UUID` | FK → Staff, NULLABLE | Last modifier |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

### `rules` JSONB Schema

When `enabled = TRUE`, the `rules` object is evaluated client-side (with server-side enforcement) using the following structure:

```jsonc
{
  // Global: if omitted or true, all matching sub-rules apply
  "global": true,

  // Platform targeting: restrict to specific client platforms
  "platforms": ["android", "ios", "web"],   // omit = all platforms

  // Group targeting: restrict to specific player segments
  "groups": ["new_user", "vip", "tester"],  // omit = all players

  // Percentage rollout: enable for X% of players (stable hash on player ID)
  "percentage": 25,  // 0-100; omit or 100 = all players

  // Combination logic: all listed dimensions must match ("AND" semantics)
}
```

The evaluation priority is: `enabled (global master)` → `platforms` → `groups` → `percentage`. A feature is ON for a given request if `enabled = TRUE` AND all specified dimensions match.

### Relationships

- `belongsTo` Staff (via `updated_by_staff_id`) — NULLABLE

### Validation Rules

- `name` must match `^[a-z][a-z0-9_]*$` (snake_case, application layer validation) and is immutable after creation
- `rules.percentage` must be between 0 and 100 (inclusive) when present
- Every change to a FeatureFlag MUST produce an AuditLog entry (FR-088)
- The seeded set of named flags for this platform:

| `name` | Default | Description |
|---|---|---|
| `exchange_feature` | `false` | Player-to-player prize exchange |
| `leaderboard` | `true` | Public leaderboards |
| `coupon_system` | `true` | Coupon & discount code usage |
| `animation_options` | `true` | Player animation mode selection |
| `spectator_mode` | `true` | Live kuji draw spectating |
| `line_cs_channel` | `false` | LINE Official Account CS integration |

### Indexes

```sql
CREATE UNIQUE INDEX uq_feature_flag_name ON feature_flags(name);
```

---

## Enum Types Summary

The following PostgreSQL `ENUM` types are defined in the migration and mapped to TypeScript union types via Prisma:

```sql
CREATE TYPE player_oauth_provider       AS ENUM ('GOOGLE', 'APPLE', 'LINE');
CREATE TYPE draw_animation_mode         AS ENUM ('TEAR', 'SCRATCH', 'FLIP', 'INSTANT');
CREATE TYPE kuji_campaign_status        AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'SOLD_OUT');
CREATE TYPE ticket_box_status           AS ENUM ('AVAILABLE', 'SOLD_OUT');
CREATE TYPE unlimited_campaign_status   AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED');
CREATE TYPE draw_ticket_status          AS ENUM ('AVAILABLE', 'DRAWN');
CREATE TYPE prize_acquisition_method    AS ENUM ('KUJI_DRAW', 'UNLIMITED_DRAW', 'TRADE_PURCHASE', 'EXCHANGE');
CREATE TYPE prize_instance_state        AS ENUM (
    'HOLDING', 'TRADING', 'EXCHANGING', 'PENDING_BUYBACK',
    'RECYCLED', 'SOLD', 'PENDING_SHIPMENT', 'SHIPPED', 'DELIVERED'
);
CREATE TYPE queue_entry_status          AS ENUM ('WAITING', 'ACTIVE', 'COMPLETED', 'ABANDONED', 'EVICTED');
CREATE TYPE shipping_order_status       AS ENUM ('PENDING_SHIPMENT', 'SHIPPED', 'DELIVERED', 'CANCELLED');
CREATE TYPE exchange_request_status     AS ENUM ('PENDING', 'COUNTER_PROPOSED', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED');
CREATE TYPE exchange_item_side          AS ENUM ('INITIATOR', 'RECIPIENT');
CREATE TYPE trade_order_status          AS ENUM ('LISTED', 'COMPLETED', 'CANCELLED');
CREATE TYPE draw_point_tx_type          AS ENUM (
    'PURCHASE_CREDIT', 'KUJI_DRAW_DEBIT', 'UNLIMITED_DRAW_DEBIT',
    'TRADE_PURCHASE_DEBIT', 'COUPON_DISCOUNT_CREDIT', 'REFUND_CREDIT', 'ADMIN_ADJUSTMENT'
);
CREATE TYPE revenue_point_tx_type       AS ENUM (
    'TRADE_SALE_CREDIT', 'BUYBACK_CREDIT', 'WITHDRAWAL_DEBIT', 'ADMIN_ADJUSTMENT'
);
CREATE TYPE payment_order_status        AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');
CREATE TYPE payment_gateway             AS ENUM ('ECPAY', 'NEWEBPAY', 'STRIPE', 'APPLEPAY', 'GOOGLEPAY');
CREATE TYPE withdrawal_status           AS ENUM ('PENDING_REVIEW', 'APPROVED', 'TRANSFERRED', 'REJECTED');
CREATE TYPE support_ticket_category     AS ENUM ('DRAW_DISPUTE', 'TRADE_DISPUTE', 'PAYMENT_ISSUE', 'ACCOUNT_ISSUE', 'SHIPPING_ISSUE', 'OTHER');
CREATE TYPE support_ticket_status       AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE support_ticket_priority     AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE message_channel             AS ENUM ('PLATFORM', 'LINE');
CREATE TYPE coupon_discount_type        AS ENUM ('PERCENTAGE', 'FIXED_POINTS');
CREATE TYPE coupon_applicable_to        AS ENUM ('ALL', 'KUJI_ONLY', 'UNLIMITED_ONLY');
CREATE TYPE player_coupon_status        AS ENUM ('ACTIVE', 'EXHAUSTED', 'EXPIRED');
CREATE TYPE audit_actor_type            AS ENUM ('PLAYER', 'STAFF', 'SYSTEM');
CREATE TYPE staff_role                  AS ENUM ('CUSTOMER_SERVICE', 'OPERATOR', 'ADMIN', 'OWNER');
```

---

## Critical Atomic Transaction Boundaries

The following operations MUST execute within a single PostgreSQL transaction to guarantee data consistency (SC-007):

| Operation | Tables Mutated | Invariant |
|---|---|---|
| Kuji draw (single ticket) | `draw_tickets`, `ticket_boxes`, `prize_instances`, `players` (balance), `draw_point_transactions`, `queues` (if last ticket) | Ticket status, box remaining count, prize creation, and point debit are all-or-nothing |
| Unlimited draw | `prize_instances`, `players` (balance), `draw_point_transactions` | Prize creation and point debit are atomic |
| Trade purchase | `trade_orders`, `prize_instances` (owner transfer), `players` (buyer debit + seller credit), `draw_point_transactions`, `revenue_point_transactions` | Ownership transfer and both balance changes are atomic |
| Exchange completion | `exchange_requests`, `exchange_request_items`, `prize_instances` (×N, owner transfers), (no point changes) | All prize ownership swaps succeed together or none |
| Buyback | `prize_instances`, `buyback_records`, `players` (balance), `revenue_point_transactions` | Prize recycled and revenue points credited together |
| Payment callback | `payment_orders`, `players` (balance), `draw_point_transactions` | Points credited only once per gateway transaction |
| Withdrawal submission | `withdrawal_requests`, `players` (balance), `revenue_point_transactions` | Points debited at submission, not at approval |

---

## Concurrency Control Summary

| Scenario | Mechanism |
|---|---|
| Two players simultaneously drawing the same `AVAILABLE` ticket | `SELECT ... FOR UPDATE` on the DrawTicket row within the draw transaction; only one transaction wins, the other retries or receives an error |
| Balance deduct race condition (double-spend) | Optimistic locking via `Player.version`; increment `version` in the UPDATE WHERE clause; retry on mismatch |
| Marketplace race condition (two buyers for one listing) | `SELECT ... FOR UPDATE` on the TradeOrder row; first committer wins; loser receives "already sold" error |
| Queue session advancement | Queue row is `SELECT ... FOR UPDATE`-locked during session handoff; distributed lock (Redis) for WebSocket-facing queue mutations |
| Unlimited campaign probability update | Swap within a transaction: mark old PrizeDefinitions inactive, insert new, validate sum = 100%; in-progress draws continue with snapshot read |

---

## Data Retention Notes

- `AuditLog`: retained indefinitely; archive to cold storage after 24 months
- `DrawPointTransaction` / `RevenuePointTransaction`: retained indefinitely (financial ledger)
- `PaymentOrder`: retained for 7 years (financial compliance)
- `PrizeInstance` (terminal states with `deleted_at`): soft-deleted rows retained for 2 years
- `QueueEntry` (terminal states): retained for 90 days for dispute resolution
- `SupportTicket` + messages: retained for 3 years
- `WithdrawalRequest`: retained for 7 years
