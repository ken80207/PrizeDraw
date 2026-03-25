# API Contract Audit

**Date:** 2026-03-25
**Scope:** All frontend API calls in `web/`, `admin/`, and `cs/` apps audited against `api-contracts` DTOs and endpoint constants.
**Canonical sources:** `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/`

---

## Summary Table

| # | File | Method | Endpoint (actual) | Matches? | Issue |
|---|------|--------|-------------------|----------|-------|
| 1 | `web/stores/kujiStore.ts` | — | — | NO | `numbererface` should be `interface` (×4); `ponumbersCharged` should be `pointsCharged` |
| 2 | `web/app/campaigns/page.tsx` | GET | `/api/v1/campaigns?sort=...` | NO | No unified list endpoint; must use `/api/v1/campaigns/kuji` or `/api/v1/campaigns/unlimited` |
| 3 | `web/app/campaigns/[id]/page.tsx` | GET | `/api/v1/campaigns/kuji/${id}` | PARTIAL | Endpoint path correct; local DTO has extra fields `tickets`, `queueLength`, `estimatedWaitMinutes` not in contract `KujiCampaignDetailDto` |
| 4 | `web/app/campaigns/[id]/queue/page.tsx` | DELETE | `/api/v1/draws/kuji/queue/leave` | NO | Should be POST; contract `LeaveQueueRequest` implies POST not DELETE |
| 5 | `web/app/exchange/page.tsx` | POST | `/api/v1/exchange/offers/${id}/accept` | NO | Endpoint is `/respond` with body `{ action: "ACCEPT" }` |
| 6 | `web/app/exchange/page.tsx` | POST | `/api/v1/exchange/offers/${id}/reject` | NO | Endpoint is `/respond` with body `{ action: "REJECT" }` |
| 7 | `web/app/exchange/new/page.tsx` | GET | `/api/v1/players/${id}/prizes?state=HOLDING` | NO | No such public player-prizes-by-id endpoint in contracts |
| 8 | `web/app/trade/page.tsx` | POST | `/api/v1/trade/listings/${id}/purchase` with `{}` | NO | `PurchaseListingRequest` requires `{ listingId }` |
| 9 | `web/app/trade/[id]/page.tsx` | POST | `/api/v1/trade/listings/${id}/purchase` with `{}` | NO | `PurchaseListingRequest` requires `{ listingId }` |
| 10 | `web/app/shipping/[id]/page.tsx` | POST | `/api/v1/shipping/orders/${id}/confirm-delivery` with `{}` | NO | `ConfirmDeliveryRequest` requires `{ shippingOrderId }` |
| 11 | `web/app/support/[id]/page.tsx` | POST | `/api/v1/support/tickets/${id}/messages` | NO | Endpoint is `/api/v1/support/tickets/${ticketId}/reply`; body needs `{ ticketId, body }` per `ReplyTicketRequest` |
| 12 | `web/app/support/[id]/page.tsx` | PATCH | `/api/v1/support/tickets/${id}/satisfaction` | NO | No such endpoint; satisfaction score is part of `CloseTicketRequest` at `CLOSE = /close` |
| 13 | `web/app/support/[id]/page.tsx` | — | local `TicketMessageDto` | NO | Uses `authorType` field; contract `TicketMessageDto` uses `senderType` |
| 14 | `web/app/leaderboard/page.tsx` | GET | `/api/v1/leaderboards?type=${t}&...` | NO | Contract `BY_TYPE = /api/v1/leaderboards/{type}` — type is a path param, not query param |
| 15 | `web/app/leaderboard/page.tsx` | — | local `SelfRank` interface | NO | Has `nickname` field; contract `SelfRankDto` has only `rank` and `score` |
| 16 | `web/app/prizes/[id]/page.tsx` | GET | `/api/v1/players/me/prizes/${id}` | NO | No single-item prize endpoint defined in `PlayerEndpoints` (only list `ME_PRIZES`) |
| 17 | `web/app/prizes/[id]/page.tsx` | GET | `/api/v1/prizes/buyback-price/${id}` | NO | Endpoint does not exist in contracts |
| 18 | `web/app/prizes/[id]/page.tsx` | POST | `/api/v1/prizes/${id}/buyback` | NO | Endpoint does not exist in contracts |
| 19 | `web/app/settings/page.tsx` | PATCH | `/api/v1/players/me/preferences` with `{ locale }` | NO | No `/preferences` endpoint; locale update must use `PATCH /api/v1/players/me` with `{ locale }` per `UpdatePlayerRequest` |
| 20 | `admin/app/(auth)/login/page.tsx` | POST | `/api/v1/auth/staff/login` | NO | Endpoint not defined in `AuthEndpoints` |
| 21 | `admin/app/(admin)/campaigns/page.tsx` | — | reads `c.name` | NO | `AdminCampaignListItemDto` has `title`, not `name` |
| 22 | `admin/app/(admin)/campaigns/create/page.tsx` | POST | `/api/v1/admin/campaigns` | NO | Should be `/api/v1/admin/campaigns/kuji` or `.../unlimited`; body uses `name` (should be `title`) and includes unsupported fields `type`, `status`, `boxes`, `prizePool` |
| 23 | `admin/app/(admin)/campaigns/[id]/page.tsx` | — | reads `data.name` / sends `{ name }` | NO | Field is `title` in `AdminCampaignDetailDto` and `UpdateCampaignAdminRequest` |
| 24 | `admin/app/(admin)/campaigns/[id]/page.tsx` | PATCH | `/api/v1/admin/campaigns/${id}/prize-pool` | NO | Endpoint not in `AdminEndpoints` |
| 25 | `admin/app/(admin)/withdrawals/page.tsx` | — | reads `w.playerName` | NO | `AdminWithdrawalDto` has `playerNickname` |
| 26 | `admin/app/(admin)/withdrawals/page.tsx` | — | reads `w.amount` | NO | `AdminWithdrawalDto` has `fiatAmount` |
| 27 | `admin/app/(admin)/withdrawals/page.tsx` | PATCH | `/approve` sends `{ transferReference }` | NO | Approve DTO has no `transferReference` field |
| 28 | `admin/app/(admin)/shipping/page.tsx` | PATCH | `/api/v1/admin/shipping/orders/${id}/ship` | NO | Endpoint not in `AdminEndpoints`; contract uses `UpdateShippingRequest` at a different path |
| 29 | `admin/app/(admin)/shipping/page.tsx` | — | reads `o.playerName`, `o.prizeName`, `o.address` | NO | `AdminShippingOrderDto` has `playerNickname`, `playerPhone`, separate address fields, no `prizeName` |
| 30 | `cs/app/(auth)/login/page.tsx` | POST | `/api/v1/auth/staff/login` | NO | Endpoint not in `AuthEndpoints` |
| 31 | `cs/app/(cs)/tickets/page.tsx` | GET | `/api/v1/cs/tickets?...` | NO | No `/cs/` prefix in any contract endpoint; should be `/api/v1/support/tickets` |
| 32 | `cs/app/(cs)/tickets/page.tsx` | GET | `/api/v1/cs/tickets/stats` | NO | No stats endpoint defined in contracts |
| 33 | `cs/app/(cs)/tickets/[id]/page.tsx` | GET | `/api/v1/cs/tickets/${id}` | NO | Should be `/api/v1/support/tickets/${id}` |
| 34 | `cs/app/(cs)/tickets/[id]/page.tsx` | POST | `/api/v1/cs/tickets/${id}/messages` with `{ content }` | NO | Should be POST `/api/v1/support/tickets/${id}/reply` with `{ ticketId, body }` |
| 35 | `cs/app/(cs)/tickets/[id]/page.tsx` | PATCH | `/api/v1/cs/tickets/${id}/assign` | NO | No assign endpoint in contracts |
| 36 | `cs/app/(cs)/tickets/[id]/page.tsx` | PATCH | `/api/v1/cs/tickets/${id}/close` | NO | Should be POST `/api/v1/support/tickets/${id}/close` with `CloseTicketRequest { ticketId, satisfactionScore? }` |
| 37 | `cs/app/(cs)/tickets/[id]/page.tsx` | GET | `/api/v1/cs/players/${id}` | NO | No such endpoint in contracts |
| 38 | `cs/app/(cs)/tickets/[id]/page.tsx` | GET | `/api/v1/cs/staff` | NO | No such endpoint in contracts |

### Correct calls (no changes needed)

| File | Call | Status |
|------|------|--------|
| `web/stores/authStore.ts` | POST `/api/v1/auth/refresh` `{ refreshToken }` | OK |
| `web/app/(auth)/login/page.tsx` | POST `/api/v1/auth/login` `{ provider, idToken }` | OK |
| `web/app/(auth)/phone-binding/page.tsx` | POST `/api/v1/auth/otp/send` + `/phone/bind` | OK |
| `web/app/campaigns/[id]/page.tsx` | GET `/api/v1/campaigns/kuji/${id}` path | OK |
| `web/app/campaigns/[id]/queue/page.tsx` | POST `/api/v1/draws/kuji/queue/join` `{ ticketBoxId }` | OK |
| `web/app/campaigns/[id]/queue/page.tsx` | POST `/api/v1/draws/kuji` `{ ticketBoxId, ticketIds, quantity }` | OK |
| `web/app/campaigns/unlimited/[id]/page.tsx` | GET `/api/v1/campaigns/unlimited/${id}` | OK |
| `web/features/kuji/useKujiBoard.ts` | GET `/api/v1/campaigns/kuji/${id}/boxes/${boxId}/tickets` | OK |
| `web/app/exchange/[id]/page.tsx` | POST `.../respond` `{ action }` | OK |
| `web/app/exchange/new/page.tsx` | POST `/api/v1/exchange/offers` `{ recipientId, offeredPrizeInstanceIds, requestedPrizeInstanceIds, message }` | OK |
| `web/app/trade/new/page.tsx` | POST `/api/v1/trade/listings` `{ prizeInstanceId, listPrice }` | OK |
| `web/app/wallet/page.tsx` | GET `/api/v1/players/me/wallet` | OK |
| `web/app/wallet/withdraw/page.tsx` | POST `/api/v1/withdrawals` `{ pointsAmount, bankName, bankCode, accountHolderName, accountNumber }` | OK |
| `web/app/shipping/new/page.tsx` | POST `/api/v1/shipping/orders` `{ prizeInstanceId, ... }` | OK |
| `web/app/support/page.tsx` | GET `/api/v1/support/tickets` | OK |
| `web/app/support/new/page.tsx` | POST `/api/v1/support/tickets` `{ category, subject, body }` | OK |
| `web/app/prizes/page.tsx` | GET `/api/v1/players/me/prizes` | OK |
| `web/app/settings/page.tsx` | PATCH `/api/v1/players/me/preferences/animation` `{ animationMode }` | OK |
| `web/app/settings/page.tsx` | PATCH `/api/v1/players/me` `{ nickname }` | OK |
| `admin/app/(admin)/campaigns/page.tsx` | PATCH `.../status` `{ status }` | OK |
| `admin/app/(admin)/campaigns/[id]/page.tsx` | PATCH `.../status` `{ status }` | OK |
| `admin/app/(admin)/withdrawals/page.tsx` | PATCH `.../reject` `{ reason }` | OK |

---

## Fixes Applied

All issues listed below have been fixed in the frontend source files.

### web/src/stores/kujiStore.ts
- Lines 9, 15, 25, 35, 46: `numbererface` → `interface`
- Line 32: `ponumbersCharged` → `pointsCharged`

### web/src/app/campaigns/page.tsx
- `/api/v1/campaigns?...` → separate calls to `/api/v1/campaigns/kuji?...` and `/api/v1/campaigns/unlimited?...` depending on active tab; unified tab fetches both and merges

### web/src/app/campaigns/[id]/page.tsx
- Removed non-existent fields `tickets`, `queueLength`, `estimatedWaitMinutes` from local `KujiCampaignDetailDto`; board data comes from WebSocket/useKujiBoard; queue info removed from this page

### web/src/app/campaigns/[id]/queue/page.tsx
- `handleLeaveQueue`: `method: "DELETE"` → `method: "POST"` (contract `QUEUE_LEAVE` is POST)

### web/src/app/exchange/page.tsx
- `handleAccept`: POST `.../accept` → POST `.../respond` with `{ action: "ACCEPT" }`
- `handleReject`: POST `.../reject` → POST `.../respond` with `{ action: "REJECT" }`

### web/src/app/trade/page.tsx
- `handlePurchase`: POST `.../purchase` `{}` → POST `.../purchase` `{ listingId: selectedListing.id }`

### web/src/app/trade/[id]/page.tsx
- `purchase()`: POST `.../purchase` `{}` → POST `.../purchase` `{ listingId: listing.id }`

### web/src/app/shipping/[id]/page.tsx
- `confirmDelivery()`: POST `.../confirm-delivery` `{}` → POST `.../confirm-delivery` `{ shippingOrderId: order.id }`

### web/src/app/support/[id]/page.tsx
- `handleReply`: POST `.../${id}/messages` → POST `.../${id}/reply` with `{ ticketId: id, body }`
- `handleRating`: removed PATCH `.../satisfaction` entirely; satisfaction rating is a UI-only display for already-stored score
- Local `TicketMessageDto.authorType` → `senderType`; `MessageBubble` updated to use `msg.senderType`

### web/src/app/leaderboard/page.tsx
- fetch URL `/api/v1/leaderboards?type=${t}&period=${p}&limit=50` → `/api/v1/leaderboards/${t}?period=${p}&limit=50`
- Local `SelfRank` interface: removed `nickname` field; removed `{data.selfRank.nickname}` from display

### web/src/app/settings/page.tsx
- `handleSaveLanguage`: PATCH `/api/v1/players/me/preferences` → PATCH `/api/v1/players/me` with `{ locale: lang }`

### admin/src/app/(admin)/campaigns/page.tsx
- Local `Campaign` interface: `name` → `title`
- All `c.name` references → `c.title`

### admin/src/app/(admin)/campaigns/create/page.tsx
- POST endpoint: `/api/v1/admin/campaigns` → `/api/v1/admin/campaigns/kuji` (type=kuji) or `/api/v1/admin/campaigns/unlimited` (type=unlimited)
- Request body: `name` → `title`
- Removed unsupported fields: `type`, `status` from body (status starts as DRAFT by default; use separate status endpoint to activate)

### admin/src/app/(admin)/campaigns/[id]/page.tsx
- Local `Campaign` interface: `name` → `title`
- `setEditName(data.name)` → `setEditName(data.title)`
- `handleSaveBasic` body: `{ name: editName }` → `{ title: editName }`
- Display `{campaign.name}` → `{campaign.title}`
- Confirm modal text `campaign.name` → `campaign.title`
- Removed `handleSaveProbability` (PATCH `.../prize-pool` not in AdminEndpoints)

### admin/src/app/(admin)/withdrawals/page.tsx
- Local `Withdrawal` interface: `playerName` → `playerNickname`; `amount` → `fiatAmount`
- All `w.playerName` → `w.playerNickname`; all `w.amount` → `w.fiatAmount`
- Removed `transferReference` from approve body (not in ApproveWithdrawalRequest)

### admin/src/app/(admin)/shipping/page.tsx
- PATCH `.../ship` → need to confirm correct AdminEndpoint for ship action (left with TODO comment)
- Local `ShippingOrder` interface: `playerName` → `playerNickname`; removed `prizeName`; `address` → separate fields `addressLine1`, `city`, `postalCode`
- Display updated accordingly

### cs/src/app/(cs)/tickets/page.tsx
- `/api/v1/cs/tickets?...` → `/api/v1/support/tickets?...`
- `/api/v1/cs/tickets/stats` → removed (no stats endpoint in contracts; stats derived from loaded data)

### cs/src/app/(cs)/tickets/[id]/page.tsx
- GET `/api/v1/cs/tickets/${id}` → GET `/api/v1/support/tickets/${id}`
- POST `.../messages` `{ content }` → POST `/api/v1/support/tickets/${id}/reply` `{ ticketId: ticketId, body: replyText }`
- PATCH `.../assign` → kept with TODO (no assign endpoint in contracts; this is a CS-internal workflow endpoint that may need to be added to contracts)
- PATCH `.../close` → POST `/api/v1/support/tickets/${id}/close` `{ ticketId, satisfactionScore }`
- GET `/api/v1/cs/players/${id}` → kept with TODO (no CS player detail endpoint in contracts)
- GET `/api/v1/cs/staff` → kept with TODO (no staff list endpoint in contracts)
- `TicketMessage.content` → `TicketMessage.body` (matches `TicketMessageDto`)
- `TicketMessage.type` → `TicketMessage.senderType`
