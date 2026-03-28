# Kuji Campaign Restock & Favorite Notification

## Summary

Allow admins to add new ticket boxes to existing KUJI campaigns (restock). When a SOLD_OUT campaign is restocked, notify all players who favorited the campaign via in-app notification and FCM push.

## Motivation

Players who favorited a campaign may miss the opportunity when all boxes are drawn. When new boxes are added to a sold-out campaign, these players should be notified so they can return and draw.

## Design

### 1. Admin Use Case: `AddTicketBoxUseCase`

**Location:** `server/src/main/kotlin/com/prizedraw/application/usecases/admin/AddTicketBoxUseCase.kt`

**Input:**
- `staffId: StaffId`
- `campaignId: CampaignId`
- `boxes: List<CreateKujiBoxRequest>` (reuse existing DTO)

**Behavior:**
1. Validate campaign exists and status is `ACTIVE` or `SOLD_OUT`.
2. Create new `TicketBox` records with `displayOrder` continuing from existing max.
3. Create corresponding `PrizeDefinition` records from `ticketRanges` (same pattern as `CreateKujiCampaignUseCase`). `DrawTicket` rows are seeded separately during the activation/ticket-generation step, not in this use case.
4. If campaign was `SOLD_OUT`:
   - Atomically update the campaign: set `status = ACTIVE`, `soldOutAt = null`, `lowStockNotifiedAt = null`, `updatedAt = now` via `saveKuji()` (full entity save, not `updateKujiStatus`).
   - Fan-out `FavoriteCampaignRestocked` events to all favoriting players via outbox.
5. Record `AuditLog`.

**Validation:**
- Campaign must be KUJI type.
- Campaign status must be `ACTIVE` or `SOLD_OUT`.
- `boxes` must not be empty.
- Each box must have `totalTickets > 0`.

**Concurrency:** The operation uses `saveKuji()` which performs a full entity update. For ACTIVE campaigns where draws may be in progress, `displayOrder` is assigned from `max(existing displayOrder) + 1` at read time. Concurrent admin restocks on the same campaign are unlikely in practice; no pessimistic lock is added.

### 2. Domain Event: `FavoriteCampaignRestocked`

**Location:** `server/src/main/kotlin/com/prizedraw/application/events/DomainEvent.kt`

```kotlin
data class FavoriteCampaignRestocked(
    val campaignId: UUID,
    val campaignType: String,
    val campaignTitle: String,
    val playerId: UUID,
) : DomainEvent {
    override val eventType: String = "favorite.campaign_restocked"
    override val aggregateType: String = "Campaign"
    override val aggregateId: UUID = campaignId
}
```

### 3. OutboxWorker Additions

**File:** `server/src/main/kotlin/com/prizedraw/application/events/OutboxWorker.kt`

- `extractPlayerIds`: No change needed — the default `else` branch already extracts `payload["playerId"]`.
- `notificationContent`: Add case for `"favorite.campaign_restocked"`:
  - Title: `"收藏的活動已加開"`
  - Body: `"你收藏的『{campaignTitle}』已加開新箱，快來抽！"` (includes campaign title for consistency with existing patterns)
- `dispatch`: Add `"favorite.campaign_restocked"` case routing to new FCM handler.
- `handleFavoriteCampaignRestocked`: Send FCM push with `eventType`, `campaignId`, `campaignType` data.

### 4. Admin Route

**Endpoint:** `POST /api/v1/admin/campaigns/{campaignId}/boxes`

**File:** `server/src/main/kotlin/com/prizedraw/api/routes/AdminCampaignRoutes.kt`

**Request body:** `List<CreateKujiBoxRequest>` (existing DTO).

**Response:** `201 Created` with created box DTOs.

**Authorization:** `StaffRole.OPERATOR` or above.

**Endpoint constant:** Add `CAMPAIGN_BOXES` to `AdminEndpoints`.

### 5. Campaign Repository Addition

**Method:** `resetLowStockNotified(campaignId: CampaignId)`

Sets `lowStockNotifiedAt = null` on the `kuji_campaigns` row so the `LowStockNotificationJob` can re-trigger for this campaign after restock.

Note: This is a convenience method. The main SOLD_OUT -> ACTIVE transition uses `saveKuji()` which atomically resets `status`, `soldOutAt`, and `lowStockNotifiedAt` in a single UPDATE.

### 6. Notification Dedup

Dedup key format: `favorite.campaign_restocked:{campaignId}:{playerId}:{epochMillis}`

Uses epoch millis to allow the same campaign to send restock notifications multiple times (each restock is a distinct event).

## Database Migration

No new migration needed. All required columns (`lowStockNotifiedAt`, `soldOutAt`) already exist on `kuji_campaigns`. `TicketBox` and `PrizeDefinition` tables are unchanged.

## Not In Scope

- Changing `FavoriteCampaignActivated` behavior (reserved for DRAFT -> ACTIVE).
- Modifying `UpdateCampaignStatusUseCase.validateTransition` (restock handles its own SOLD_OUT -> ACTIVE internally).
- Admin UI changes (out of scope for this spec; admin dashboard can be updated separately).

## Files to Create/Modify

| Action | File |
|--------|------|
| Create | `application/usecases/admin/AddTicketBoxUseCase.kt` |
| Create | `application/ports/input/admin/IAddTicketBoxUseCase.kt` |
| Modify | `application/events/DomainEvent.kt` — add `FavoriteCampaignRestocked` |
| Modify | `application/events/OutboxWorker.kt` — add handler + notification content |
| Modify | `api/routes/AdminCampaignRoutes.kt` — add POST route |
| Modify | `contracts/.../AdminEndpoints.kt` — add `CAMPAIGN_BOXES` constant |
| Modify | `application/ports/output/ICampaignRepository.kt` — add `resetLowStockNotified` |
| Modify | `infrastructure/persistence/repositories/CampaignRepositoryImpl.kt` — implement `resetLowStockNotified` |
| Modify | Koin module — register `AddTicketBoxUseCase` |

## Test Plan

- **Unit test:** `AddTicketBoxUseCaseTest` — happy path (SOLD_OUT -> ACTIVE with notification), ACTIVE restock (no notification), invalid status rejection, empty boxes rejection.
- **Integration test:** Full restock + notification flow — verify boxes created, status changed, notifications persisted, outbox events enqueued.
- **Edge case:** Restock on campaign with zero favorites — no notification emitted, no errors.
