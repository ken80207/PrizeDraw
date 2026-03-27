# Unlimited Prize CRUD & Risk Control Design

**Date:** 2026-03-27
**Status:** Approved

## Overview

Add complete prize table CRUD for unlimited campaigns (including `prizeValue`), implement shared risk control (margin analysis) across both Kuji and Unlimited campaign types, and pre-build the API layer for future manager approval workflows.

## Scope

1. Unlimited campaign prize table full CRUD (create with campaign + edit in DRAFT)
2. `prizeValue` (market retail price, denominated in draw points — same unit as `pricePerDraw`) for unlimited prizes — displayed to players
3. Shared `MarginRiskService` for Kuji and Unlimited margin calculations
4. Configurable margin threshold stored in `system_settings`
5. Soft gate on DRAFT → ACTIVE: low margin requires `confirmLowMargin: true`
6. Pre-built approval API endpoints (approve/reject) — not yet active
7. Admin frontend: prize table editor with risk display, confirmation dialog
8. New DTOs and endpoint constants added to `api-contracts` KMP module (contracts-first)

## Non-Scope

- Manager approval UI (frontend)
- Notification system for approval requests
- Hard block on low-margin campaigns
- Approval state machine / history tracking entity

---

## Data Layer

### 1. `prize_definitions` Table

No migration needed. Existing columns cover all requirements:
- `prize_value INTEGER NOT NULL DEFAULT 0` (added in V019)
- `probability_bps INTEGER` (exists since V004)

### 2. `system_settings` Table (New Migration)

```sql
CREATE TABLE system_settings (
    key        VARCHAR(128) PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID
);

-- Values are JSON primitives (number, boolean), not strings
INSERT INTO system_settings (key, value) VALUES
  ('risk.margin_threshold_pct', '20'),           -- JSON number
  ('risk.require_approval_below_threshold', 'false');  -- JSON boolean
```

- `risk.margin_threshold_pct` — margin warning threshold (default 20, JSON number)
- `risk.require_approval_below_threshold` — future toggle for manager approval (default false, JSON boolean)

### 3. Approval Columns on Campaign Tables (New Migration)

```sql
ALTER TABLE kuji_campaigns
    ADD COLUMN approval_status VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUIRED',
    ADD COLUMN approved_by     UUID,
    ADD COLUMN approved_at     TIMESTAMPTZ;

ALTER TABLE unlimited_campaigns
    ADD COLUMN approval_status VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUIRED',
    ADD COLUMN approved_by     UUID,
    ADD COLUMN approved_at     TIMESTAMPTZ;
```

`approval_status` values: `NOT_REQUIRED` (default), `PENDING`, `APPROVED`, `REJECTED`.

All campaigns default to `NOT_REQUIRED`. When `require_approval_below_threshold` is enabled, low-margin campaigns transition to `PENDING` instead of directly activating.

---

## Domain Layer

### 1. `MarginRiskService` (New Domain Service)

Pure calculation service, no I/O. Threshold is passed in as a parameter by the calling use case (which reads it from `system_settings`), keeping this service truly pure.

```kotlin
class MarginRiskService {

    fun calculateKujiMargin(
        pricePerDraw: Int,
        prizes: List<KujiPrizeInput>,   // { ticketCount, prizeValue }
        boxCount: Int,
        thresholdPct: BigDecimal        // from system_settings
    ): MarginResult

    fun calculateUnlimitedMargin(
        pricePerDraw: Int,
        prizes: List<UnlimitedPrizeInput>,  // { probabilityBps, prizeValue }
        thresholdPct: BigDecimal             // from system_settings
    ): MarginResult
}

data class MarginResult(
    val totalRevenuePerUnit: Int,
    val totalCostPerUnit: Int,
    val profitPerUnit: Int,
    val marginPct: BigDecimal,
    val belowThreshold: Boolean,
    val thresholdPct: BigDecimal
)
```

**Kuji formula:**
```
ticketsPerBox = prizes.sumOf { it.ticketCount }
totalRevenue  = ticketsPerBox * pricePerDraw * boxCount
totalCost     = Σ(ticketCount * prizeValue) * boxCount
marginPct     = (totalRevenue - totalCost) / totalRevenue * 100
```
Note: `boxCount` is derived from `ticketBoxRepository.findByCampaignId(campaignId).size` by the calling use case.

**Unlimited formula:**
All values are in draw points (same unit as `pricePerDraw`).
```
expectedPayoutPerDraw = Σ(probabilityBps / 1_000_000 * prizeValue)
marginPct = (pricePerDraw - expectedPayoutPerDraw) / pricePerDraw * 100
```

### 2. `ApprovalStatus` Enum (New)

```kotlin
enum class ApprovalStatus {
    NOT_REQUIRED, PENDING, APPROVED, REJECTED
}
```

Added to both `KujiCampaign` and `UnlimitedCampaign` entities with fields:
- `approvalStatus: ApprovalStatus`
- `approvedBy: UUID?`
- `approvedAt: Instant?`

### 3. Probability Validation

`UnlimitedDrawDomainService.validateProbabilitySum()` (existing) validates sum = 1,000,000 bps.

Validation triggers:
- **Create campaign with prize table** — reject if sum ≠ 1,000,000
- **Update prize table** — reject if sum ≠ 1,000,000
- **DRAFT → ACTIVE** — re-validate (existing behavior)

---

## API Layer

### 0. Contracts First (`api-contracts` Module)

All new DTOs and endpoint constants are added to `api-contracts` before server/client implementation:

**New endpoint constants** in `AdminEndpoints.kt`:
- `ADMIN_UNLIMITED_PRIZE_TABLE = "/api/v1/admin/campaigns/unlimited/{campaignId}/prize-table"`
- `ADMIN_CAMPAIGN_APPROVE = "/api/v1/admin/campaigns/{campaignId}/approve"`
- `ADMIN_CAMPAIGN_REJECT = "/api/v1/admin/campaigns/{campaignId}/reject"`
- `ADMIN_RISK_SETTINGS = "/api/v1/admin/settings/risk"`

**New DTOs** in `AdminDtos.kt`:
- `UnlimitedPrizeEntryRequest`
- `UpdatePrizeTableRequest`
- `MarginResultDto`
- `RiskSettingsResponse`
- `RiskSettingsUpdateRequest`

All DTOs are `@Serializable` and placed in the `com.prizedraw.contracts.dto.admin` package.

### 1. Create Unlimited Campaign (Extend Existing)

`POST /api/v1/admin/campaigns/unlimited`

**Breaking change:** The existing frontend sends `prizePool` with `probability` as a decimal fraction (e.g., 0.5 meaning 0.5%). This is replaced by `prizeTable` with `probabilityBps` as integer basis points (e.g., 5000 meaning 0.5%). This is an admin-only API, so no backward compatibility is needed.

```kotlin
data class CreateUnlimitedCampaignAdminRequest(
    val title: String,
    val description: String? = null,
    val coverImageUrl: String? = null,
    val pricePerDraw: Int,
    val rateLimitPerSecond: Int = 1,
    val prizeTable: List<UnlimitedPrizeEntryRequest>  // replaces old prizePool
)

data class UnlimitedPrizeEntryRequest(
    val grade: String,
    val name: String,
    val probabilityBps: Int,
    val prizeValue: Int,
    val photoUrl: String? = null,
    val displayOrder: Int = 0
)
```

Server-side validation:
- Probability sum = 1,000,000 bps
- Each `prizeValue >= 0`, `probabilityBps > 0`
- Response includes `MarginResultDto`

### 2. Update Prize Table (New Endpoint)

`PATCH /api/v1/admin/campaigns/unlimited/{campaignId}/prize-table`

- Unlimited-only endpoint (kuji prize management uses the existing box-based flow)
- Only allowed in DRAFT status
- Full table replacement (not individual CRUD)
- Validates probability sum + returns `MarginResultDto`

```kotlin
data class UpdatePrizeTableRequest(
    val prizeTable: List<UnlimitedPrizeEntryRequest>
)
```

### 3. Campaign Status Transition (Extend Existing)

`PATCH /api/v1/admin/campaigns/{campaignId}/status`

```kotlin
data class ChangeCampaignStatusRequest(
    val status: CampaignStatus,
    val confirmLowMargin: Boolean = false  // NEW
)
```

The `confirmLowMargin` parameter is propagated to `UpdateCampaignStatusUseCase.execute()` which gains a new `confirmLowMargin: Boolean = false` parameter.

DRAFT → ACTIVE flow:
1. Validate probability = 100%
2. Calculate margin via `MarginRiskService`
3. If margin < threshold AND `confirmLowMargin = false` → HTTP 422 with `MarginResult`
4. If margin < threshold AND `confirmLowMargin = true` → allow activation
5. Future: when `require_approval_below_threshold = true` → set `approvalStatus = PENDING`, reject direct activation

### 4. Approval Endpoints (Pre-built, Not Active)

```
POST /api/v1/admin/campaigns/{campaignId}/approve
POST /api/v1/admin/campaigns/{campaignId}/reject
```

Requires new `StaffRole.MANAGER` role. This role is added to the existing `StaffRole` enum (between `OPERATOR` and `ADMIN`): `CUSTOMER_SERVICE, OPERATOR, MANAGER, ADMIN, OWNER`. A new migration adds `'MANAGER'` to the `staff_role` PostgreSQL enum type. Existing staff records are unaffected.

When `require_approval_below_threshold = false`: returns HTTP 409 with descriptive error indicating the feature is not enabled.

When enabled (future): updates `approvalStatus`, sets `approvedBy`/`approvedAt`, and transitions campaign to ACTIVE if approved.

### 5. Risk Settings

```
GET   /api/v1/admin/settings/risk
PATCH /api/v1/admin/settings/risk
```

```kotlin
data class RiskSettingsResponse(
    val marginThresholdPct: BigDecimal,
    val requireApprovalBelowThreshold: Boolean
)
```

---

## Admin Frontend

### 1. Create Page (`campaigns/create/page.tsx`)

Unlimited form additions:
- Add `prizeValue` input to each prize row (label: "市場價值")
- UI continues to display probabilities as percentages (e.g., 0.5%). Conversion to bps (multiply by 10,000) happens at API submission time.
- Add **risk summary card** at form bottom (real-time client-side calculation):
  - Expected payout per draw
  - Margin percentage
  - Color coding: green (≥ threshold), orange (< threshold), red (< 0%)
- Probability sum real-time validation — disable submit when ≠ 100%
- Fetch threshold from `GET /admin/settings/risk` on mount

### 2. Detail Page (`campaigns/[id]/page.tsx`)

Unlimited campaign in DRAFT:
- Prize table becomes editable (replace "尚未開放" placeholder)
- Add `prizeValue` column
- Risk summary card (same as create page)
- Save button → `PATCH /admin/campaigns/{id}/prize-table`

Unlimited campaign in ACTIVE:
- Prize table read-only
- Display current margin (informational)

### 3. Status Transition UX

DRAFT → ACTIVE button:
1. Call API without `confirmLowMargin`
2. On 422 (low margin) → show confirmation dialog: "毛利率僅 X%，低於警戒線 Y%，確定上架？"
3. User confirms → re-submit with `confirmLowMargin: true`
4. Future (approval enabled): dialog changes to "已送出主管審核" message

### 4. Kuji Create Page Refactor

- Extract inline margin calculation into shared utility functions:
  - `calcKujiMargin()` / `calcUnlimitedMargin()`
- Extract shared `<MarginDisplay>` component for risk summary card
- Existing warning logic preserved, only refactored for reuse

---

## Future Extension: Manager Approval Flow

When `require_approval_below_threshold` is toggled to `true`:

1. DRAFT → ACTIVE with low margin sets `approvalStatus = PENDING`
2. Campaign stays in DRAFT, admin sees "待主管審核" status
3. Manager calls `POST /admin/campaigns/{id}/approve` → campaign activates
4. Manager calls `POST /admin/campaigns/{id}/reject` → campaign stays DRAFT, admin notified

**Not built now:** approval list UI, notification system, approval history log.

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Prize table management | Full replacement, not individual CRUD | Simpler to reason about; probability sum validation is atomic |
| Risk service | Pure domain service, no I/O | Testable, reusable across Kuji and Unlimited |
| Threshold storage | `system_settings` table (JSONB) | Flexible, no migration needed to change values |
| Approval pre-build | API endpoints + DB columns only | Minimal cost now, clean extension point later |
| `prizeValue` semantics | Market retail price (player-visible) | Consistent with Kuji, used for both display and margin calc |
| Probability enforcement | Server-side hard reject (must = 100%) | Data integrity; client validates too for UX |
| Low-margin gate | Soft (422 + confirm flag) | Gives admin flexibility while ensuring awareness |
