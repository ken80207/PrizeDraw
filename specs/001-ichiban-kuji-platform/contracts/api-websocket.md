# WebSocket (Socket.IO) Contract — Prize Draw Platform

**Version**: 1.0.0
**Transport**: Socket.IO v4 over WebSocket (with HTTP long-polling fallback)
**Base namespace**: `/`
**Namespaces**: See per-event documentation below.

---

## Connection and Authentication

### Handshake

Pass the player's JWT in the Socket.IO `auth` object on connect. Anonymous connections (for spectating public campaign pages) are allowed but receive no personal events.

```js
// Client example
const socket = io("wss://api.prizeddraw.com", {
  auth: { token: "<jwt>" },
  query: { platform: "web" }
});
```

### Server handshake error codes

| Code | Meaning |
|---|---|
| `AUTH_INVALID` | Token is malformed or expired. |
| `AUTH_PHONE_REQUIRED` | Account is in `pending_phone` state; real-time features unavailable until OTP binding completes. |

The server emits `connect_error` with `{ code, message }` for auth failures. Unauthenticated connections are accepted and placed in public rooms only.

---

## Room Conventions

| Room key | Members |
|---|---|
| `box:{boxId}` | All clients viewing or queued for a specific ticket box. |
| `campaign:{campaignId}` | All clients viewing any page of a campaign (kuji or unlimited). |
| `player:{playerId}` | Single-player private room for personal notifications. |

Clients join rooms by emitting the `room:join` event (see below). The server validates room membership against the active campaign/box state before allowing the join.

---

## Client-to-Server Events

### `room:join`
Join a public room to receive broadcasts for a campaign or ticket box.

**Direction**: client → server

**Payload**:
```json
{
  "room": "box:{boxId}" | "campaign:{campaignId}"
}
```

**Acknowledgement**:
```json
{
  "ok": true,
  "room": "box:abc-123",
  "snapshot": {
    // Current state snapshot delivered on join to prevent a missed-event gap.
    // For box rooms: full ticket grid state (see kuji:ticket-grid-snapshot).
    // For campaign rooms: campaign summary with all boxes and queue lengths.
  }
}
```

---

### `room:leave`
Leave a room. Called when the player navigates away from the page.

**Direction**: client → server

**Payload**:
```json
{
  "room": "box:{boxId}" | "campaign:{campaignId}"
}
```

**Acknowledgement**:
```json
{ "ok": true }
```

---

## Server-to-Client Events

### `kuji:ticket-update`
Broadcast to `box:{boxId}` whenever a ticket is drawn (single pick or part of a multi-draw sequence).

**Direction**: server → client (broadcast to `box:{boxId}`)

**Payload**:
```json
{
  "event": "kuji:ticket-update",
  "boxId": "uuid",
  "campaignId": "uuid",
  "ticket": {
    "id": "uuid",
    "position": 12,
    "status": "drawn"
  },
  "prize": {
    "grade": "A",
    "name": "string",
    "imageUrls": ["string"]
  },
  "drawnBy": {
    "playerId": "uuid",
    "nickname": "string"
  },
  "remainingTickets": 27,
  "timestamp": "ISO-8601"
}
```

**Notes**: For multi-draw sequences, the server emits one `kuji:ticket-update` per ticket in reveal order with a configurable inter-event delay (default 800 ms) to support sequential animation on clients. All events share the same `drawSessionId` field so clients can group them.

---

### `kuji:queue-update`
Broadcast to `box:{boxId}` whenever the queue state changes (player joins, leaves, or the active turn ends).

**Direction**: server → client (broadcast to `box:{boxId}`)

**Payload**:
```json
{
  "event": "kuji:queue-update",
  "boxId": "uuid",
  "campaignId": "uuid",
  "queue": {
    "length": 3,
    "currentPlayer": {
      "playerId": "uuid",
      "nickname": "string"
    } | null,
    "timeRemaining": 287,       // seconds left in current player's turn; null if no active player
    "estimatedWaitSeconds": 574 // for players joining now
  },
  "timestamp": "ISO-8601"
}
```

**Notes**: `timeRemaining` is the authoritative server-side countdown. Clients SHOULD use this value to sync their local display rather than running an independent timer, but MAY interpolate between updates to avoid UI jitter.

---

### `kuji:turn-start`
Sent privately to the player whose turn has just begun.

**Direction**: server → client (private, to `player:{playerId}`)

**Payload**:
```json
{
  "event": "kuji:turn-start",
  "boxId": "uuid",
  "campaignId": "uuid",
  "turnDurationSeconds": 300,
  "expiresAt": "ISO-8601",      // absolute server timestamp — use this as the source of truth
  "remainingTickets": 34
}
```

**Notes**: The client MUST display the countdown from `expiresAt`. If the client was disconnected and reconnects during an active turn, the server will re-emit this event with the updated `expiresAt` so the client can resume correctly.

---

### `kuji:turn-end`
Sent privately to the player whose turn has just ended (timer expiry or voluntary `end-turn` REST call).

**Direction**: server → client (private, to `player:{playerId}`)

**Payload**:
```json
{
  "event": "kuji:turn-end",
  "boxId": "uuid",
  "campaignId": "uuid",
  "reason": "expired" | "ended_by_player" | "box_sold_out" | "campaign_closed",
  "drawCount": 3,               // tickets drawn during this turn
  "timestamp": "ISO-8601"
}
```

---

### `kuji:box-sold-out`
Broadcast to `campaign:{campaignId}` and `box:{boxId}` when a ticket box runs out of tickets.

**Direction**: server → client (broadcast to `campaign:{campaignId}` and `box:{boxId}`)

**Payload**:
```json
{
  "event": "kuji:box-sold-out",
  "boxId": "uuid",
  "campaignId": "uuid",
  "remainingBoxes": 1,          // how many boxes in the campaign still have tickets
  "timestamp": "ISO-8601"
}
```

**Notes**: All players queued for this box receive `kuji:turn-end` with `reason: "box_sold_out"` immediately before or simultaneously with this broadcast. No points are deducted.

---

### `kuji:campaign-sold-out`
Broadcast to `campaign:{campaignId}` when all ticket boxes in a campaign are exhausted.

**Direction**: server → client (broadcast to `campaign:{campaignId}`)

**Payload**:
```json
{
  "event": "kuji:campaign-sold-out",
  "campaignId": "uuid",
  "campaignName": "string",
  "timestamp": "ISO-8601"
}
```

---

### `kuji:ticket-grid-snapshot`
Full ticket grid state delivered to a client immediately after they join a `box:{boxId}` room, and on reconnection. Prevents the need for a separate REST call to hydrate the grid.

**Direction**: server → client (unicast, on room join acknowledgement)

**Payload**:
```json
{
  "event": "kuji:ticket-grid-snapshot",
  "boxId": "uuid",
  "campaignId": "uuid",
  "tickets": [
    {
      "id": "uuid",
      "position": 1,
      "status": "drawn" | "available",
      "prize": {
        "grade": "A",
        "name": "string",
        "imageUrls": ["string"]
      } | null,
      "drawnBy": { "playerId": "uuid", "nickname": "string" } | null,
      "drawnAt": "ISO-8601 | null"
    }
  ],
  "queue": {
    "length": 2,
    "currentPlayer": { "playerId": "uuid", "nickname": "string" } | null,
    "timeRemaining": 180
  },
  "snapshotAt": "ISO-8601"
}
```

---

### `notification:new`
Personal notification for events that concern only the authenticated player.

**Direction**: server → client (private, to `player:{playerId}`)

**Payload**:
```json
{
  "event": "notification:new",
  "notificationId": "uuid",
  "type": "trade_completed"
    | "trade_cancelled"
    | "exchange_request"
    | "exchange_accepted"
    | "exchange_rejected"
    | "exchange_counter"
    | "exchange_cancelled"
    | "shipment_dispatched"
    | "shipment_delivered"
    | "withdrawal_approved"
    | "withdrawal_rejected"
    | "support_reply"
    | "queue_position_update"
    | "box_sold_out_while_queued"
    | "turn_starting_soon"
    | "campaign_closed_while_queued",
  "title": "string",            // localised short title
  "body": "string",             // localised message body
  "data": {
    // Type-specific contextual data — examples below
  },
  "timestamp": "ISO-8601"
}
```

**`data` shapes by `type`**:

```json
// trade_completed
{ "tradeId": "uuid", "prizeInstanceId": "uuid", "prizeName": "string", "amount": 190 }

// exchange_request / exchange_counter
{ "exchangeId": "uuid", "initiatorNickname": "string", "offeredPrizes": ["string"], "requestedPrizes": ["string"] }

// shipment_dispatched
{ "shippingId": "uuid", "trackingNumber": "string", "carrier": "string" }

// withdrawal_approved / withdrawal_rejected
{ "withdrawalId": "uuid", "revenuePoints": 500, "rejectionReason": "string | null" }

// support_reply
{ "ticketId": "uuid", "ticketNumber": "TK-00123", "staffName": "string" }

// queue_position_update
{ "boxId": "uuid", "newPosition": 1, "estimatedWaitSeconds": 60 }

// turn_starting_soon (sent ~30 s before the player becomes active)
{ "boxId": "uuid", "estimatedStartAt": "ISO-8601" }
```

---

### `player:points-update`
Sent to the player's private room whenever either point balance changes.

**Direction**: server → client (private, to `player:{playerId}`)

**Payload**:
```json
{
  "event": "player:points-update",
  "drawPoints": {
    "balance": 1405,
    "delta": -45,               // signed change amount
    "reason": "draw_kuji" | "draw_unlimited" | "trade_buy" | "purchase" | "coupon_bonus"
  } | null,                     // null if draw points did not change
  "revenuePoints": {
    "balance": 335,
    "delta": 15,
    "reason": "buyback" | "trade_sale" | "withdrawal"
  } | null,
  "referenceId": "uuid",        // related draw/trade/buyback/payment ID
  "timestamp": "ISO-8601"
}
```

**Notes**: At least one of `drawPoints` or `revenuePoints` will be non-null per event. The server emits this after the database transaction is committed so the balance is always authoritative.

---

## Reconnection Behaviour

Socket.IO's built-in reconnection handles transient disconnects. On successful reconnection the server:

1. Re-places the socket in all previously joined rooms.
2. Re-emits `kuji:turn-start` if the player still holds an active draw token (with the correct remaining `expiresAt`).
3. Delivers any `notification:new` events that were missed during the offline window (up to 24 hours, stored in a notification queue in Redis).
4. Sends a fresh `kuji:ticket-grid-snapshot` for each box room the client was in.

Clients MUST handle duplicate event delivery gracefully using `notificationId` / `drawId` / `timestamp` for deduplication.

---

## Scaling Notes

- Each NestJS instance maintains Socket.IO rooms via a **Redis adapter** (`@socket.io/redis-adapter`). Box-level broadcasts originate from any instance and fan-out via Redis pub/sub.
- The `box:{boxId}` broadcast is the highest-frequency channel. Under peak load (10,000 active connections per SC-003) the server MUST emit `kuji:ticket-update` within 2 seconds of the draw transaction committing (SC-002).
- Personal rooms (`player:{playerId}`) are serviced by whichever instance holds the player's socket; cross-instance delivery uses Redis pub/sub.
