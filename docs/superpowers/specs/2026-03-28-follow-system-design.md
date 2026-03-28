# Follow System Design

## Overview

Add a unidirectional follow (fan) system to the PrizeDraw platform. Players can follow others to receive notifications when they start drawing or hit rare prizes. No private messaging between players.

## Requirements

### Follow Mechanics
- **Unidirectional**: A follows B without B's approval (fan model)
- **No follow limit**: players can follow unlimited others
- **Follow sources**:
  - Chat room: tap player nickname → popover with follow/unfollow button
  - Search: enter player code for exact match → follow from result

### Player Code
- System-generated 8-character alphanumeric uppercase code (e.g. `A3K9X2B1`)
- Character set excludes confusable chars (`0/O`, `1/I/L`): `23456789ABCDEFGHJKMNPQRSTUVWXYZ`
- Generated at registration, immutable
- Existing players backfilled via migration
- Collision check on generation (8 chars × 30 charset = ~656M combinations)
- UI: displayed with a copy-to-clipboard button beside it

### Notifications (Two-Stage)

**Stage 1 — Draw started:**
- Triggered when a followed player begins drawing
- Push via FCM + WebSocket (`FOLLOWING_DRAW_STARTED`)
- Content: "{nickname} is drawing in {campaignName}!"
- Tap action: navigate to `/campaigns/{id}/board?spectate=true` (spectate mode + chat)

**Stage 2 — Rare prize drawn:**
- Triggered when a followed player draws a rare prize (tier-based, configurable in system settings)
- Push via FCM + WebSocket (`FOLLOWING_RARE_PRIZE_DRAWN`)
- Content: "{nickname} drew {prizeName} in {campaignName}!"
- Tap action: same as above

### Lists & Profile
- Players can view their own following list (paginated)
- Players can view their own followers list (paginated)
- Profile displays: player code (with copy button), follower count, following count

### Spectate Mode
- Notification tap navigates to `/campaigns/{id}/board?spectate=true`
- Spectate mode renders the existing board in watch-only view + chat room
- No new page needed; reuse existing campaign board + chat infrastructure

### Explicitly Out of Scope
- Private messaging between players
- Mutual/bidirectional friend confirmation
- Follow limits or tier-gated follow counts
- Dedicated spectate page (reuse existing board)
- Feed/timeline system

---

## Data Model

### Players Table (alter)

Add column:
```
player_code VARCHAR(8) UNIQUE NOT NULL
```

Index: unique constraint on `player_code` (implicit index).

### Prize Definitions Table (alter)

Add column:
```
is_rare BOOLEAN NOT NULL DEFAULT false
```

Admin sets `is_rare = true` on prize grades that should trigger follower notifications (e.g. A賞, Last賞). This avoids fragile text matching on the free-text `grade` field.

### Follows Table (new)

```
follows
├── id: UUID (PK)
├── follower_id: UUID (FK → players, ON DELETE CASCADE)
├── following_id: UUID (FK → players, ON DELETE CASCADE)
├── created_at: TIMESTAMPTZ NOT NULL DEFAULT now()
├── UNIQUE(follower_id, following_id)
└── CHECK(follower_id != following_id)
```

Indexes:
- `idx_follows_follower` on (follower_id, created_at DESC) — "who do I follow"
- `idx_follows_following` on (following_id, created_at DESC) — "who follows me"

No denormalized follower/following count columns; use COUNT queries backed by indexes.

---

## API Endpoints

### Follow Operations
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/follows/{playerId}` | Follow a player |
| DELETE | `/api/v1/follows/{playerId}` | Unfollow a player |
| GET | `/api/v1/follows/following?limit=20&offset=0` | My following list (paginated) |
| GET | `/api/v1/follows/followers?limit=20&offset=0` | My followers list (paginated) |
| GET | `/api/v1/follows/{playerId}/status` | Check if I follow this player |

### Player Search
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/players/search?code={playerCode}` | Search player by code |

### Existing Endpoint Changes
- Player profile response: add `playerCode`, `followerCount`, `followingCount`
- Chat message player info: ensure `playerId` is included for follow interaction

All endpoints require JWT authentication.

---

## Notification Flow

### Draw Started
1. Player initiates a draw
2. Draw use case writes outbox event: `following.draw_started`
3. OutboxWorker picks up → queries follower list for the drawing player
4. Sends FCM batch push to all followers' registered devices
5. Writes notification records to `notifications` table
6. Pushes `FOLLOWING_DRAW_STARTED` via PlayerNotificationManager (WebSocket) to online followers

### Rare Prize Drawn
1. Draw result produced, prize tier evaluated
2. If prize meets "rare" threshold (configurable in system_settings): write outbox event `following.rare_prize_drawn`
3. Same flow as above: FCM batch + notification record + WebSocket push

### New WebSocket Event Types
- `FOLLOWING_DRAW_STARTED`
- `FOLLOWING_RARE_PRIZE_DRAWN`

Added to `PlayerWsEventType` enum in api-contracts.

### Rare Prize Definition
- Determined by `is_rare` boolean on `prize_definitions` table (admin-managed per campaign)
- Admin explicitly marks which prize grades are "rare" when configuring a campaign
- Avoids fragile text matching on the free-text `grade` field

### Notification Fan-out Strategy
- Follower query uses cursor-based pagination (batches of 500, matching FCM batch limit)
- Notification record inserts use bulk INSERT
- Fan-out dispatched as a dedicated coroutine, does not block OutboxWorker from processing other events
- FCM batch sends in chunks of 500 devices per batch call

---

## Frontend Changes

### Chat Room
- Player nickname in chat messages becomes tappable
- Tap → popover with "Follow" or "Unfollow" button
- Calls `POST/DELETE /api/v1/follows/{playerId}`

### Follow Management Page (`/follows`)
- Search bar: input player code → exact search → display result with follow button
- "Following" tab: paginated list (avatar, nickname, player code, unfollow button)
- "Followers" tab: paginated list (avatar, nickname, player code, follow/unfollow button)

### Profile / Settings
- Display own player code with copy-to-clipboard button
- Display follower count and following count

### Notification Handling
- `FOLLOWING_DRAW_STARTED` / `FOLLOWING_RARE_PRIZE_DRAWN` notifications
- Tap → navigate to `/campaigns/{id}/board?spectate=true`
- Board page checks `spectate` query param → renders watch-only view + chat room

### Mobile (Compose Multiplatform)
- Same interaction patterns adapted to native UI
- FCM push tap → deep link to campaign board in spectate mode

---

## Architecture Alignment

This feature fully reuses existing infrastructure:
- **Outbox pattern**: transactional event publishing (existing OutboxWorker)
- **FCM**: batch push notifications (existing FirebaseNotificationService)
- **Redis pub/sub**: horizontal scaling fanout (existing ConnectionManager)
- **WebSocket**: player notification channel (existing PlayerNotificationManager)
- **Notifications table**: persistent notification history (existing schema from V020)
- **Chat room**: existing ChatWebSocketHandler + room system

New backend components follow the existing hexagonal architecture:
- Domain: `Follow` entity, `IFollowRepository` port
- Application: `FollowUseCase`, `FollowService`
- Infrastructure: `ExposedFollowRepository`, Flyway migrations
- API: `FollowRoutes`, `FollowEndpoints` (api-contracts)

### Flyway Migration Plan
- **Pre-requisite**: Resolve existing V024 duplicate (`V024__create_campaign_favorites.sql` and `V024__create_feed_events.sql`). Merge into single V024 or renumber one as V025.
- Follow system migrations come after the V024 fix. Exact version numbers determined at implementation time.
- Migrations needed:
  1. Add `player_code` column to `players` + backfill existing players (PL/pgSQL loop with collision retry)
  2. Create `follows` table
  3. Add `is_rare` column to `prize_definitions`

### Rate Limiting
- Follow/unfollow endpoints (`POST/DELETE /api/v1/follows/{playerId}`): dedicated `follow` tier at 30/min per user
- Player search (`GET /api/v1/players/search`): `default` tier (60/min) — returns empty result for non-existent codes (no 404, prevents enumeration)

### API Response Contracts

**POST /api/v1/follows/{playerId}**: 201 Created (empty body). 409 Conflict if already following. 404 if target player not found.

**DELETE /api/v1/follows/{playerId}**: 204 No Content. Idempotent (no error if not following).

**GET /api/v1/follows/following**: `{ items: [{ playerId, nickname, avatarUrl, playerCode }], total, limit, offset }`

**GET /api/v1/follows/followers**: Same shape as above.

**GET /api/v1/follows/{playerId}/status**: `{ isFollowing: boolean }`

**GET /api/v1/players/search?code={code}**: `{ player: { playerId, nickname, avatarUrl, playerCode, isFollowing } | null }`

### WebSocket Event Payloads
```
FOLLOWING_DRAW_STARTED:
  { campaignId, campaignName, playerId, nickname }

FOLLOWING_RARE_PRIZE_DRAWN:
  { campaignId, campaignName, playerId, nickname, prizeName, prizeGrade }
```

### i18n
- Notification templates use i18n keys, not hardcoded strings
- Keys added to server `messages_zh_TW.properties` / `messages_en.properties` and `I18nKeys.kt`
- Player's `locale` preference determines push notification language
- Keys: `notification.following.draw_started`, `notification.following.rare_prize_drawn`

### Chat Room Follow Interaction
- When entering a chat room, batch-preload follow statuses for visible participants via a single API call
- Cache follow statuses client-side, refresh on re-enter or follow/unfollow action
- No per-tap API call needed for status check

### Spectate Mode Edge Cases
- If campaign is no longer active (SOLD_OUT, SUSPENDED): show the board in its final state with a banner indicating the campaign has ended
- If the followed player has finished drawing: show the board normally (spectator can still browse results and chat)
- Spectate mode allows joining the queue — player can transition from spectating to participating
