# REST API Contract — Prize Draw Platform

**Version**: 1.0.0
**Base URL**: `/api/v1`
**Content-Type**: `application/json`
**Auth header**: `Authorization: Bearer <jwt>`

All timestamps are ISO 8601 UTC strings. All point amounts are integers (no decimals). Error responses follow the standard envelope defined in the [Error Format](#error-format) section at the bottom.

---

## Auth

### POST /auth/oauth
Social login or registration via OAuth provider.

**Auth**: Public

**Request body**:
```json
{
  "provider": "google" | "apple" | "line",
  "idToken": "string"          // ID token from the provider SDK
}
```

**Response `200`**:
```json
{
  "accessToken": "string",
  "refreshToken": "string",
  "expiresIn": 3600,
  "player": {
    "id": "uuid",
    "phoneVerified": false,     // false until OTP bind is complete
    "nickname": "string | null"
  }
}
```

**Notes**: If the OAuth subject already exists the response is identical (login). If it is new, the account is created in a `pending_phone` state. All subsequent requests with this token that require core features will receive `403 PHONE_NOT_VERIFIED` until OTP binding is complete.

---

### POST /auth/phone/send-otp
Send SMS OTP to bind a phone number.

**Auth**: Player (any state, including `pending_phone`)

**Request body**:
```json
{
  "phone": "+886912345678"      // E.164 format
}
```

**Response `204`**: Empty body on success.

**Notes**: Rate-limited to 3 attempts per phone per 10 minutes. Returns `409 PHONE_ALREADY_BOUND` if the number is already bound to a different account.

---

### POST /auth/phone/verify
Verify the OTP and complete phone binding.

**Auth**: Player (any state)

**Request body**:
```json
{
  "phone": "+886912345678",
  "otp": "123456"
}
```

**Response `200`**:
```json
{
  "accessToken": "string",     // re-issued token with full permissions
  "refreshToken": "string",
  "expiresIn": 3600
}
```

**Notes**: OTP expires after 5 minutes. Max 5 failed attempts before the OTP is invalidated and must be re-sent.

---

### POST /auth/refresh
Exchange a refresh token for a new access token.

**Auth**: Public (refresh token in body)

**Request body**:
```json
{
  "refreshToken": "string"
}
```

**Response `200`**:
```json
{
  "accessToken": "string",
  "refreshToken": "string",    // rotated on each refresh
  "expiresIn": 3600
}
```

---

## Player

### GET /players/me
Fetch the authenticated player's profile and point balances.

**Auth**: Player

**Response `200`**:
```json
{
  "id": "uuid",
  "nickname": "string",
  "avatarUrl": "string | null",
  "phone": "+886912345678",
  "phoneVerified": true,
  "drawPoints": 1500,          // consumable points balance
  "revenuePoints": 320,        // withdrawable points balance
  "preferredAnimation": "scratch" | "tear" | "flip" | "instant",
  "locale": "zh-TW",
  "createdAt": "timestamp"
}
```

---

### PATCH /players/me
Update mutable profile fields.

**Auth**: Player

**Request body** (all fields optional):
```json
{
  "nickname": "string",
  "avatarUrl": "string",
  "preferredAnimation": "scratch" | "tear" | "flip" | "instant",
  "locale": "zh-TW" | "en" | "ja"
}
```

**Response `200`**: Updated player object (same shape as `GET /players/me`).

---

### GET /players/me/prizes
List the authenticated player's prize inventory.

**Auth**: Player

**Query params**:
| Param | Type | Description |
|---|---|---|
| `status` | `string` | Filter: `holding`, `trading`, `exchanging`, `pending_shipment`, `shipped`, `delivered`, `recycled`, `sold`. Comma-separated for multiple. |
| `campaignId` | `uuid` | Filter by source campaign. |
| `page` | `integer` | Default `1`. |
| `limit` | `integer` | Default `20`, max `100`. |

**Response `200`**:
```json
{
  "data": [
    {
      "id": "uuid",
      "prizeDefinition": {
        "id": "uuid",
        "grade": "A",
        "name": "string",
        "imageUrls": ["string"]
      },
      "campaign": {
        "id": "uuid",
        "name": "string",
        "type": "kuji" | "unlimited"
      },
      "acquiredVia": "kuji_draw" | "unlimited_draw" | "trade_purchase" | "exchange",
      "status": "holding",
      "acquiredAt": "timestamp"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 84,
    "totalPages": 5
  }
}
```

---

### GET /players/me/draw-points/transactions
Paginated history of consumable point movements.

**Auth**: Player

**Query params**: `page`, `limit`, `type` (`purchase` | `draw_kuji` | `draw_unlimited` | `trade_buy`)

**Response `200`**:
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "purchase" | "draw_kuji" | "draw_unlimited" | "trade_buy",
      "amount": -50,            // negative = debit, positive = credit
      "balanceAfter": 1450,
      "referenceId": "uuid",    // payment order ID or draw ID
      "referenceType": "payment_order" | "draw" | "trade_order",
      "originalAmount": 50,     // before coupon discount
      "discountAmount": 0,      // points saved via coupon
      "createdAt": "timestamp"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 60, "totalPages": 3 }
}
```

---

### GET /players/me/revenue-points/transactions
Paginated history of withdrawable point movements.

**Auth**: Player

**Query params**: `page`, `limit`, `type` (`trade_sale` | `buyback` | `withdrawal`)

**Response `200`**: Same envelope as draw-points transactions. `type` values: `trade_sale`, `buyback`, `withdrawal`.

---

## Campaign

### GET /campaigns
List campaigns with optional filters.

**Auth**: Public

**Query params**:
| Param | Type | Description |
|---|---|---|
| `type` | `kuji` \| `unlimited` | Filter by campaign type. |
| `status` | `open` \| `sold_out` \| `closed` | Filter by status. Default excludes `draft`. |
| `page` | `integer` | Default `1`. |
| `limit` | `integer` | Default `20`, max `50`. |

**Response `200`**:
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "kuji" | "unlimited",
      "name": "string",
      "coverImageUrl": "string",
      "pricePerDraw": 50,
      "status": "open" | "sold_out" | "closed",
      "totalTickets": 160,      // kuji only
      "remainingTickets": 88,   // kuji only
      "createdAt": "timestamp"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 12, "totalPages": 1 }
}
```

---

### GET /campaigns/:id
Fetch a single campaign with full detail.

**Auth**: Public

**Response `200`** — kuji campaign:
```json
{
  "id": "uuid",
  "type": "kuji",
  "name": "string",
  "description": "string",
  "coverImageUrl": "string",
  "pricePerDraw": 50,
  "turnDurationSeconds": 300,
  "status": "open",
  "ticketBoxes": [
    {
      "id": "uuid",
      "name": "Box A",
      "totalTickets": 80,
      "remainingTickets": 34,
      "queueLength": 2,
      "status": "available" | "sold_out"
    }
  ],
  "createdAt": "timestamp"
}
```

**Response `200`** — unlimited campaign:
```json
{
  "id": "uuid",
  "type": "unlimited",
  "name": "string",
  "description": "string",
  "coverImageUrl": "string",
  "pricePerDraw": 30,
  "status": "open",
  "prizes": [
    {
      "prizeDefinitionId": "uuid",
      "grade": "A",
      "name": "string",
      "imageUrls": ["string"],
      "probability": 0.5         // percentage, e.g. 0.5 = 0.5%
    }
  ],
  "createdAt": "timestamp"
}
```

---

### GET /campaigns/:id/ticket-boxes
List all ticket boxes for a kuji campaign with queue state.

**Auth**: Public

**Response `200`**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "totalTickets": 80,
      "remainingTickets": 34,
      "status": "available" | "sold_out",
      "queue": {
        "length": 2,
        "currentPlayerId": "uuid | null",
        "estimatedWaitSeconds": 360
      }
    }
  ]
}
```

---

### GET /campaigns/:id/ticket-boxes/:boxId/tickets
Full ticket grid for a single box (drawn and undrawn).

**Auth**: Public

**Response `200`**:
```json
{
  "boxId": "uuid",
  "tickets": [
    {
      "id": "uuid",
      "position": 1,
      "status": "drawn" | "available",
      "drawnBy": {
        "playerId": "uuid",
        "nickname": "string"
      } | null,
      "prize": {
        "grade": "A",
        "name": "string",
        "imageUrls": ["string"]
      } | null,                  // null when status is "available"
      "drawnAt": "timestamp | null"
    }
  ]
}
```

**Notes**: Prize info is revealed only after the ticket has been drawn (`status: "drawn"`). Undrawn tickets return `prize: null` to preserve fairness.

---

## Draw

All draw endpoints require the player to have a verified phone and sufficient draw points. If points are insufficient the server returns `402 INSUFFICIENT_POINTS` so the client can surface the top-up screen.

### POST /draw/kuji/queue/join
Join the queue for a specific ticket box.

**Auth**: Player

**Request body**:
```json
{
  "boxId": "uuid",
  "couponId": "uuid | null"    // optional coupon to reserve for this turn
}
```

**Response `200`**:
```json
{
  "queuePosition": 3,
  "estimatedWaitSeconds": 600,
  "boxId": "uuid"
}
```

**Notes**: Returns `409 ALREADY_IN_QUEUE` if the player is already queued for any box in this campaign. Returns `410 BOX_SOLD_OUT` if the box has no remaining tickets.

---

### POST /draw/kuji/pick
Pick a specific ticket by ID during the player's active turn.

**Auth**: Player

**Request body**:
```json
{
  "ticketId": "uuid",
  "couponId": "uuid | null"
}
```

**Response `200`**:
```json
{
  "drawId": "uuid",
  "ticket": {
    "id": "uuid",
    "position": 12
  },
  "prize": {
    "instanceId": "uuid",
    "grade": "A",
    "name": "string",
    "imageUrls": ["string"]
  },
  "pointsCharged": 45,          // after coupon
  "drawPointsBalance": 1405,
  "turnExpiresAt": "timestamp"
}
```

**Notes**: Returns `403 NOT_YOUR_TURN` if the player does not hold the active draw token for the box. Returns `409 TICKET_ALREADY_DRAWN` if another request raced to draw the same ticket. Entire operation is atomic.

---

### POST /draw/kuji/multi-draw
Draw multiple tickets randomly in a single request.

**Auth**: Player

**Request body**:
```json
{
  "boxId": "uuid",
  "quantity": 1 | 3 | 5 | 12,
  "couponId": "uuid | null"
}
```

**Response `200`**:
```json
{
  "draws": [
    {
      "drawId": "uuid",
      "ticket": { "id": "uuid", "position": 7 },
      "prize": {
        "instanceId": "uuid",
        "grade": "B",
        "name": "string",
        "imageUrls": ["string"]
      }
    }
  ],
  "totalPointsCharged": 225,
  "drawPointsBalance": 1180,
  "turnExpiresAt": "timestamp"
}
```

**Notes**: Returns `422 INSUFFICIENT_TICKETS` if the remaining ticket count is less than `quantity`. Each draw in the array is ordered by reveal sequence. All draws are committed atomically — either all succeed or none do.

---

### POST /draw/kuji/queue/leave
Leave the queue voluntarily. No points are deducted.

**Auth**: Player

**Request body**:
```json
{
  "boxId": "uuid"
}
```

**Response `204`**: Empty body.

---

### POST /draw/kuji/switch-box
Switch to a different ticket box within the same campaign during an active turn.

**Auth**: Player

**Request body**:
```json
{
  "fromBoxId": "uuid",
  "toBoxId": "uuid"
}
```

**Response `200`**:
```json
{
  "newBoxId": "uuid",
  "turnExpiresAt": "timestamp"  // unchanged — timer is not reset
}
```

**Notes**: Returns `409 BOX_IN_USE` if `toBoxId` already has an active player. Returns `410 BOX_SOLD_OUT` if `toBoxId` has no remaining tickets. The player's position in the original box is released and the next queued player for that box is promoted.

---

### POST /draw/kuji/end-turn
Voluntarily end the active turn and yield to the next player in queue.

**Auth**: Player

**Request body**:
```json
{
  "boxId": "uuid"
}
```

**Response `204`**: Empty body.

---

### POST /draw/unlimited
Perform a single draw for an unlimited-type campaign.

**Auth**: Player

**Request body**:
```json
{
  "campaignId": "uuid",
  "couponId": "uuid | null"
}
```

**Response `200`**:
```json
{
  "drawId": "uuid",
  "prize": {
    "instanceId": "uuid",
    "grade": "C",
    "name": "string",
    "imageUrls": ["string"]
  },
  "pointsCharged": 27,
  "drawPointsBalance": 1153
}
```

**Notes**: Rate-limited per player (default 1 request/second, configurable by admin). Returns `429 RATE_LIMIT_EXCEEDED` on abuse.

---

## Trade

### GET /trades
Browse the marketplace listing.

**Auth**: Public

**Query params**:
| Param | Type | Description |
|---|---|---|
| `grade` | `string` | Comma-separated prize grades, e.g. `A,B`. |
| `campaignId` | `uuid` | Filter by source campaign. |
| `campaignType` | `kuji` \| `unlimited` | Filter by campaign type. |
| `minPrice` | `integer` | Minimum asking price in points. |
| `maxPrice` | `integer` | Maximum asking price in points. |
| `sort` | `price_asc` \| `price_desc` \| `newest` | Default `newest`. |
| `page` | `integer` | Default `1`. |
| `limit` | `integer` | Default `20`, max `100`. |

**Response `200`**:
```json
{
  "data": [
    {
      "id": "uuid",
      "prizeInstance": {
        "id": "uuid",
        "grade": "A",
        "name": "string",
        "imageUrls": ["string"],
        "campaign": { "id": "uuid", "name": "string", "type": "kuji" }
      },
      "seller": { "id": "uuid", "nickname": "string" },
      "askingPrice": 200,
      "listedAt": "timestamp"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 348, "totalPages": 18 }
}
```

---

### POST /trades
List a prize for sale.

**Auth**: Player

**Request body**:
```json
{
  "prizeInstanceId": "uuid",
  "askingPrice": 200            // in draw points
}
```

**Response `201`**:
```json
{
  "id": "uuid",
  "prizeInstanceId": "uuid",
  "askingPrice": 200,
  "status": "active",
  "listedAt": "timestamp"
}
```

**Notes**: Returns `409 PRIZE_NOT_AVAILABLE` if the prize is not in `holding` status. Returns `403 CANNOT_SELL_OWN_BUY` (listing is fine; purchasing own listing is blocked at buy time). Minimum price is 1 point.

---

### POST /trades/:id/buy
Purchase a listed prize.

**Auth**: Player

**Request body**: Empty `{}` (idempotency key via `Idempotency-Key` header recommended).

**Response `200`**:
```json
{
  "tradeId": "uuid",
  "prizeInstance": {
    "id": "uuid",
    "grade": "A",
    "name": "string"
  },
  "drawPointsCharged": 200,
  "drawPointsBalance": 953,
  "sellerRevenuePointsReceived": 190   // price minus platform fee
}
```

**Notes**: Returns `403 CANNOT_BUY_OWN_LISTING` if caller is the seller. Returns `409 ALREADY_SOLD` if the listing was purchased by a concurrent request. Uses optimistic locking to guarantee only one buyer succeeds.

---

### DELETE /trades/:id
Cancel and delist a trade listing.

**Auth**: Player (owner only)

**Response `204`**: Empty body. Prize status reverts to `holding`.

---

## Exchange

Exchange is gated by the `exchange` feature flag. All endpoints return `503 FEATURE_DISABLED` when the flag is off.

### POST /exchanges
Initiate an exchange request.

**Auth**: Player

**Request body**:
```json
{
  "targetPlayerId": "uuid",
  "offeredPrizeInstanceIds": ["uuid"],    // prizes the requester offers
  "requestedPrizeInstanceIds": ["uuid"]   // prizes the requester wants
}
```

**Response `201`**:
```json
{
  "id": "uuid",
  "status": "pending",
  "initiator": { "id": "uuid", "nickname": "string" },
  "respondent": { "id": "uuid", "nickname": "string" },
  "offeredPrizes": [{ "id": "uuid", "grade": "A", "name": "string", "imageUrls": ["string"] }],
  "requestedPrizes": [{ "id": "uuid", "grade": "B", "name": "string", "imageUrls": ["string"] }],
  "createdAt": "timestamp"
}
```

**Notes**: All prizes in both arrays must be in `holding` status and owned by the respective players. Returns `422 PRIZE_NOT_AVAILABLE` for any prize that fails this check.

---

### POST /exchanges/:id/accept
Accept an incoming exchange request.

**Auth**: Player (respondent only)

**Request body**: Empty `{}`.

**Response `200`**:
```json
{
  "id": "uuid",
  "status": "completed",
  "completedAt": "timestamp"
}
```

**Notes**: Prize ownership is swapped atomically. No point movements occur.

---

### POST /exchanges/:id/reject
Reject an incoming exchange request.

**Auth**: Player (respondent only)

**Request body**:
```json
{
  "reason": "string | null"
}
```

**Response `200`**:
```json
{
  "id": "uuid",
  "status": "rejected"
}
```

---

### POST /exchanges/:id/counter
Propose a counter-offer.

**Auth**: Player (respondent only)

**Request body**:
```json
{
  "offeredPrizeInstanceIds": ["uuid"],
  "requestedPrizeInstanceIds": ["uuid"]
}
```

**Response `200`**:
```json
{
  "id": "uuid",
  "status": "counter_pending",
  "counterOffer": {
    "offeredPrizes": [{ "id": "uuid", "grade": "C", "name": "string" }],
    "requestedPrizes": [{ "id": "uuid", "grade": "A", "name": "string" }]
  }
}
```

**Notes**: The original initiator receives a `notification:new` event and must accept or reject the counter.

---

### DELETE /exchanges/:id
Cancel an exchange request.

**Auth**: Player (initiator before acceptance; either party if status is `counter_pending`)

**Response `204`**: Empty body. All prizes revert to `holding` status.

---

## Buyback

### POST /buyback
Recycle a prize back to the platform for revenue points.

**Auth**: Player

**Request body**:
```json
{
  "prizeInstanceId": "uuid"
}
```

**Response `200`**:
```json
{
  "buybackId": "uuid",
  "prizeInstanceId": "uuid",
  "revenuePointsReceived": 15,
  "revenuePointsBalance": 335,
  "processedAt": "timestamp"
}
```

**Notes**: Buyback price is applied at the moment of submission (not at any later processing step). Returns `409 PRIZE_NOT_AVAILABLE` if the prize is not in `holding` status. Returns `503 BUYBACK_DISABLED` if the admin has disabled buyback for this prize grade.

---

## Shipping

### POST /shipping
Request physical shipment of a prize.

**Auth**: Player

**Request body**:
```json
{
  "prizeInstanceId": "uuid",
  "recipient": {
    "name": "string",
    "phone": "+886912345678",
    "addressLine1": "string",
    "addressLine2": "string | null",
    "city": "string",
    "postalCode": "string",
    "countryCode": "TW"
  }
}
```

**Response `201`**:
```json
{
  "id": "uuid",
  "prizeInstanceId": "uuid",
  "status": "pending_shipment",
  "recipient": { "name": "string", "phone": "string", "addressLine1": "string" },
  "createdAt": "timestamp"
}
```

**Notes**: Prize status changes to `pending_shipment` immediately. Returns `409 PRIZE_NOT_AVAILABLE` if the prize is not in `holding` status.

---

### GET /shipping/:id
Get shipment status and tracking info.

**Auth**: Player (owner of the associated prize) or Staff

**Response `200`**:
```json
{
  "id": "uuid",
  "prizeInstanceId": "uuid",
  "status": "pending_shipment" | "shipped" | "delivered",
  "trackingNumber": "string | null",
  "carrier": "string | null",
  "recipient": { "name": "string", "phone": "string", "addressLine1": "string" },
  "shippedAt": "timestamp | null",
  "deliveredAt": "timestamp | null",
  "createdAt": "timestamp"
}
```

---

### PATCH /shipping/:id
Update shipment tracking info (staff only — after physical dispatch).

**Auth**: Staff (`operations` role or above)

**Request body**:
```json
{
  "status": "shipped" | "delivered",
  "trackingNumber": "string",
  "carrier": "string"
}
```

**Response `200`**: Updated shipping object (same shape as `GET /shipping/:id`).

**Notes**: Triggers a `notification:new` event to the prize owner. Once `status` is `shipped`, a cancel request from the player is no longer accepted.

---

## Payment

### POST /payment/topup
Initiate a point purchase order and obtain the payment gateway redirect URL.

**Auth**: Player

**Request body**:
```json
{
  "planId": "uuid",             // point plan as configured by admin
  "paymentMethod": "credit_card" | "mobile_pay" | "cvs_code",
  "returnUrl": "string"         // client deep-link for redirect after payment
}
```

**Response `201`**:
```json
{
  "orderId": "uuid",
  "gatewayUrl": "string",       // redirect the user here
  "gatewayForm": { },           // optional: POST form fields for gateway
  "status": "pending",
  "expiresAt": "timestamp"      // order expiry (typically 30 min)
}
```

**Notes**: If the payment gateway is in degraded state (feature flag `payment_gateway` = off), returns `503 PAYMENT_GATEWAY_UNAVAILABLE`. Other platform functions remain operational.

---

### POST /payment/webhook
Payment gateway callback — see `/contracts/api-webhooks.md` for full payload contract.

**Auth**: Gateway HMAC signature (not player JWT)

**Response `200`**: `{ "received": true }`

---

## Withdrawal

### POST /withdrawals
Submit a cash withdrawal request for revenue points.

**Auth**: Player

**Request body**:
```json
{
  "revenuePoints": 500,
  "bankAccount": {
    "bankCode": "012",
    "accountNumber": "123456789012",
    "accountName": "王小明"
  }
}
```

**Response `201`**:
```json
{
  "id": "uuid",
  "revenuePoints": 500,
  "estimatedCashAmount": 500,   // platform currently 1 point = 1 TWD
  "status": "pending_review",
  "createdAt": "timestamp"
}
```

**Notes**: Revenue points are debited immediately on submission and held until admin approves or rejects. Returns `422 INSUFFICIENT_REVENUE_POINTS` if balance is too low. Returns `403 DRAW_POINTS_NOT_WITHDRAWABLE` if player tries to withdraw draw points.

---

### GET /withdrawals
List the authenticated player's withdrawal requests.

**Auth**: Player

**Query params**: `status` (`pending_review` | `approved` | `transferred` | `rejected`), `page`, `limit`

**Response `200`**:
```json
{
  "data": [
    {
      "id": "uuid",
      "revenuePoints": 500,
      "estimatedCashAmount": 500,
      "status": "pending_review" | "approved" | "transferred" | "rejected",
      "bankAccount": { "bankCode": "012", "accountNumberMasked": "****6789" },
      "reviewedBy": "string | null",
      "rejectionReason": "string | null",
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 4, "totalPages": 1 }
}
```

---

### PATCH /withdrawals/:id
Approve or reject a withdrawal request.

**Auth**: Staff (`admin` role or above)

**Request body**:
```json
{
  "action": "approve" | "reject",
  "rejectionReason": "string"   // required when action is "reject"
}
```

**Response `200`**:
```json
{
  "id": "uuid",
  "status": "approved" | "rejected",
  "reviewedBy": "string",
  "updatedAt": "timestamp"
}
```

**Notes**: Rejection returns the held revenue points to the player's balance.

---

## Coupon

### POST /coupons/redeem
Redeem a discount code and obtain a coupon.

**Auth**: Player

**Request body**:
```json
{
  "code": "WELCOME20"
}
```

**Response `200`**:
```json
{
  "coupon": {
    "id": "uuid",
    "discountPercent": 20,
    "applicableTo": "all" | "kuji" | "unlimited",
    "expiresAt": "timestamp",
    "usesRemaining": 1
  }
}
```

**Notes**: Returns `422 CODE_INVALID` if the code does not exist, is expired, or has reached its redemption limit.

---

### GET /coupons/me
List the authenticated player's available coupons.

**Auth**: Player

**Query params**: `status` (`active` | `used` | `expired`), `page`, `limit`

**Response `200`**:
```json
{
  "data": [
    {
      "id": "uuid",
      "discountPercent": 20,
      "applicableTo": "all" | "kuji" | "unlimited",
      "expiresAt": "timestamp",
      "usesRemaining": 1,
      "status": "active"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 }
}
```

---

## Leaderboard

### GET /leaderboards
Fetch a ranked leaderboard.

**Auth**: Public

**Query params**:
| Param | Type | Description |
|---|---|---|
| `type` | `draw_count` \| `top_prizes` \| `trade_volume` \| `campaign` | Leaderboard type. Required. |
| `period` | `daily` \| `weekly` \| `monthly` \| `all_time` | Time window. Default `weekly`. |
| `campaignId` | `uuid` | Required when `type=campaign`. |
| `limit` | `integer` | Max entries to return. Default `50`, max `100`. |

**Response `200`**:
```json
{
  "type": "draw_count",
  "period": "weekly",
  "generatedAt": "timestamp",
  "entries": [
    {
      "rank": 1,
      "player": { "id": "uuid", "nickname": "string", "avatarUrl": "string | null" },
      "value": 142,             // draws, points, etc. depending on type
      "isCurrentPlayer": false
    }
  ],
  "currentPlayerEntry": {       // always present for authenticated callers
    "rank": 87,
    "value": 12,
    "isCurrentPlayer": true
  } | null
}
```

---

## Support

### POST /support/tickets
Create a new support ticket.

**Auth**: Player

**Request body**:
```json
{
  "category": "trade_dispute" | "draw_issue" | "account" | "payment" | "shipping" | "other",
  "subject": "string",
  "description": "string",
  "referenceId": "uuid | null",      // optional: related trade/draw/order ID
  "referenceType": "trade" | "draw" | "payment_order" | "shipping" | null
}
```

**Response `201`**:
```json
{
  "id": "uuid",
  "ticketNumber": "TK-00123",
  "status": "open",
  "category": "trade_dispute",
  "subject": "string",
  "createdAt": "timestamp"
}
```

---

### GET /support/tickets
List the authenticated player's support tickets.

**Auth**: Player

**Query params**: `status` (`open` | `in_progress` | `resolved`), `page`, `limit`

**Response `200`**:
```json
{
  "data": [
    {
      "id": "uuid",
      "ticketNumber": "TK-00123",
      "category": "string",
      "subject": "string",
      "status": "open" | "in_progress" | "resolved",
      "lastMessageAt": "timestamp",
      "createdAt": "timestamp"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

---

### POST /support/tickets/:id/messages
Send a message on an existing ticket (player or staff reply).

**Auth**: Player (own ticket) or Staff (`support` role)

**Request body**:
```json
{
  "body": "string",
  "attachmentUrls": ["string"]   // pre-signed S3 URLs, optional
}
```

**Response `201`**:
```json
{
  "id": "uuid",
  "ticketId": "uuid",
  "senderType": "player" | "staff",
  "body": "string",
  "attachmentUrls": ["string"],
  "createdAt": "timestamp"
}
```

---

## Admin

All admin endpoints require `Authorization: Bearer <staff-jwt>`. Role requirements are noted per endpoint.

### Campaigns (Admin)

#### POST /admin/campaigns
Create a new campaign (kuji or unlimited).

**Auth**: Staff (`operations` role)

**Request body** — kuji:
```json
{
  "type": "kuji",
  "name": "string",
  "description": "string",
  "coverImageUrl": "string",
  "pricePerDraw": 50,
  "turnDurationSeconds": 300,
  "ticketBoxes": [
    {
      "name": "Box A",
      "tickets": [
        {
          "position": 1,
          "prizeGrade": "A",
          "prizeName": "string",
          "prizeImageUrls": ["string"],
          "buybackPrice": 20
        }
      ]
    }
  ]
}
```

**Request body** — unlimited:
```json
{
  "type": "unlimited",
  "name": "string",
  "description": "string",
  "coverImageUrl": "string",
  "pricePerDraw": 30,
  "drawRateLimitPerSecond": 1,
  "prizes": [
    {
      "grade": "A",
      "name": "string",
      "imageUrls": ["string"],
      "probability": 0.5,
      "buybackPrice": 25
    }
  ]
}
```

**Response `201`**: Full campaign object.

**Notes**: For unlimited campaigns, server validates that `sum(probability) == 100`. Returns `422 PROBABILITY_SUM_INVALID` on mismatch. For kuji campaigns, every ticket position must map to a prize definition.

---

#### GET /admin/campaigns
List all campaigns (all statuses).

**Auth**: Staff (`operations` role)

**Query params**: `type` (`kuji` | `unlimited`), `status` (`draft` | `open` | `closed` | `sold_out`), `search` (name), `page`, `limit`

**Response `200`**: Same envelope as public `GET /campaigns` but includes `draft` status and audit fields (`createdBy`, `lastModifiedAt`).

---

#### GET /admin/campaigns/:id
Fetch a single campaign with full admin detail.

**Auth**: Staff (`operations` role)

**Response `200`**: Full campaign object plus `auditLog` summary.

---

#### PATCH /admin/campaigns/:id
Update mutable campaign fields.

**Auth**: Staff (`operations` role)

**Request body** (all optional):
```json
{
  "name": "string",
  "description": "string",
  "coverImageUrl": "string",
  "status": "open" | "closed",
  "pricePerDraw": 50,
  "turnDurationSeconds": 300,   // kuji only
  "drawRateLimitPerSecond": 2   // unlimited only
}
```

**Notes**: Ticket box ticket content cannot be modified once `status` has ever been `open` (FR-020f). Attempting to do so returns `403 TICKET_GRID_LOCKED`. Probability changes for an unlimited campaign in `open` status require a second PATCH field `"confirmProbabilityChange": true`.

---

#### PATCH /admin/campaigns/:id/prizes/:prizeId
Update the probability or buyback price of a prize on an unlimited campaign.

**Auth**: Staff (`operations` role)

**Request body**:
```json
{
  "probability": 1.5,
  "buybackPrice": 20,
  "confirmLiveChange": true    // must be true for campaigns with status "open"
}
```

**Response `200`**: Updated prize object.

---

### Staff (Admin)

#### GET /admin/staff
List all staff accounts.

**Auth**: Staff (`admin` role)

**Response `200`**:
```json
{
  "data": [
    {
      "id": "uuid",
      "email": "string",
      "name": "string",
      "role": "support" | "operations" | "admin" | "owner",
      "createdAt": "timestamp",
      "lastLoginAt": "timestamp | null"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 8, "totalPages": 1 }
}
```

---

#### POST /admin/staff
Create a staff account.

**Auth**: Staff (`admin` role)

**Request body**:
```json
{
  "email": "string",
  "name": "string",
  "role": "support" | "operations" | "admin"
}
```

**Response `201`**: Staff object. An invitation email is dispatched.

---

#### PATCH /admin/staff/:id
Update role or deactivate a staff member.

**Auth**: Staff (`admin` role)

**Request body**:
```json
{
  "role": "support" | "operations" | "admin",
  "active": false
}
```

**Response `200`**: Updated staff object.

---

### Feature Flags (Admin)

#### GET /admin/feature-flags
List all feature flags and their current state.

**Auth**: Staff (`admin` role)

**Response `200`**:
```json
{
  "data": [
    {
      "key": "exchange",
      "enabled": true,
      "targeting": {
        "platforms": ["android", "ios", "web"],
        "playerGroups": ["all"],
        "rolloutPercent": 100
      },
      "updatedAt": "timestamp",
      "updatedBy": "string"
    }
  ]
}
```

---

#### PATCH /admin/feature-flags/:key
Update a feature flag.

**Auth**: Staff (`admin` role)

**Request body**:
```json
{
  "enabled": false,
  "targeting": {
    "platforms": ["android", "ios"],
    "playerGroups": ["vip", "tester"],
    "rolloutPercent": 20
  }
}
```

**Response `200`**: Updated flag object. Change is effective within 30 seconds on all clients. Change is recorded in audit log.

---

### Coupons (Admin)

#### POST /admin/coupons
Create a coupon campaign with optional discount codes.

**Auth**: Staff (`operations` role)

**Request body**:
```json
{
  "name": "string",
  "discountPercent": 20,
  "applicableTo": "all" | "kuji" | "unlimited",
  "expiresAt": "timestamp",
  "maxUsesPerPlayer": 1,
  "totalIssuance": 1000,
  "codes": ["WELCOME20", "VIP2026"]   // optional; omit for system-auto-issued coupons
}
```

**Response `201`**: Coupon campaign object.

---

#### GET /admin/coupons
List coupon campaigns.

**Auth**: Staff (`operations` role)

**Response `200`**: Paginated list of coupon campaign summaries with `usedCount` and `remainingCount`.

---

#### PATCH /admin/coupons/:id
Edit or disable a coupon campaign.

**Auth**: Staff (`operations` role)

**Request body**:
```json
{
  "active": false,
  "expiresAt": "timestamp"
}
```

**Response `200`**: Updated coupon object.

---

### Point Plans (Admin)

#### GET /admin/point-plans
List purchasable point plans.

**Auth**: Staff (`operations` role)

**Response `200`**:
```json
{
  "data": [
    {
      "id": "uuid",
      "label": "500 Points",
      "drawPoints": 500,
      "priceNtd": 500,
      "bonusPoints": 50,
      "active": true
    }
  ]
}
```

---

#### POST /admin/point-plans
Create a point plan.

**Auth**: Staff (`operations` role)

**Request body**:
```json
{
  "label": "string",
  "drawPoints": 500,
  "priceNtd": 500,
  "bonusPoints": 0,
  "active": true
}
```

**Response `201`**: Point plan object.

---

#### PATCH /admin/point-plans/:id
Update or deactivate a point plan.

**Auth**: Staff (`operations` role)

**Response `200`**: Updated plan object.

---

### Audit Logs (Admin)

#### GET /admin/audit-logs
Query the audit log.

**Auth**: Staff (`admin` or `owner` role)

**Query params**: `actorId`, `actorType` (`player` | `staff`), `action`, `targetType`, `from` (ISO date), `to` (ISO date), `page`, `limit`

**Response `200`**:
```json
{
  "data": [
    {
      "id": "uuid",
      "actor": { "id": "uuid", "type": "staff", "name": "string" },
      "action": "campaign.status_change",
      "targetType": "campaign",
      "targetId": "uuid",
      "before": { "status": "open" },
      "after": { "status": "closed" },
      "ip": "string",
      "createdAt": "timestamp"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 2048, "totalPages": 41 }
}
```

---

### Dashboard (Admin)

#### GET /admin/dashboard
Aggregate platform statistics for the operations dashboard.

**Auth**: Staff (`operations`, `admin`, or `owner` role)

**Query params**: `from` (ISO date), `to` (ISO date)

**Response `200`**:
```json
{
  "period": { "from": "2026-03-01", "to": "2026-03-24" },
  "revenue": {
    "totalDrawPointsSold": 450000,
    "totalNtdCollected": 450000,
    "pendingWithdrawals": 12000
  },
  "activity": {
    "totalDraws": 18500,
    "kujiDraws": 9200,
    "unlimitedDraws": 9300,
    "activePlayers": 3400,
    "newPlayers": 820
  },
  "trades": {
    "totalVolume": 85000,
    "completedOrders": 1240,
    "platformFeeCollected": 4250
  },
  "campaigns": [
    {
      "id": "uuid",
      "name": "string",
      "type": "kuji",
      "drawCount": 320,
      "revenue": 16000,
      "soldOutAt": "timestamp | null"
    }
  ]
}
```

---

## Feature Flag (Client SDK)

### GET /feature-flags
Fetch the effective feature flag state for the current session context.

**Auth**: Public (anonymous) or Player

**Query params**: `platform` (`android` | `ios` | `web`) — required

**Response `200`**:
```json
{
  "flags": {
    "exchange": true,
    "leaderboard": true,
    "coupon_system": true,
    "draw_animation": true,
    "spectator_mode": true,
    "line_support": true,
    "payment_gateway": true
  },
  "evaluatedAt": "timestamp",
  "ttlSeconds": 30
}
```

**Notes**: Clients MUST re-fetch or re-evaluate flags when `ttlSeconds` elapses. Backend evaluates targeting rules (platform, player group, rollout percent) server-side so the client only receives a flat boolean map.

---

## Error Format

All error responses use the following envelope:

```json
{
  "statusCode": 422,
  "error": "PROBABILITY_SUM_INVALID",
  "message": "Prize probabilities must sum to exactly 100. Current sum: 98.5",
  "details": { }                // optional structured context
}
```

### Common Error Codes

| HTTP | Code | Description |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Request body or query params failed schema validation. `details` contains field-level errors. |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT. |
| 402 | `INSUFFICIENT_POINTS` | Player does not have enough draw points. `details.required` and `details.current` are provided. |
| 403 | `FORBIDDEN` | Authenticated but not permitted (wrong role, wrong ownership, feature lock). |
| 403 | `PHONE_NOT_VERIFIED` | Account exists but phone binding is incomplete. |
| 403 | `TICKET_GRID_LOCKED` | Attempt to edit ticket content of a campaign that has been published. |
| 403 | `NOT_YOUR_TURN` | Draw attempted outside the player's active queue turn. |
| 403 | `CANNOT_BUY_OWN_LISTING` | Player attempted to purchase their own trade listing. |
| 404 | `NOT_FOUND` | Resource does not exist or is not visible to the caller. |
| 409 | `CONFLICT` | State conflict (already in queue, ticket already drawn, prize not available, etc.). |
| 409 | `ALREADY_SOLD` | Trade listing purchased by a concurrent request. |
| 410 | `BOX_SOLD_OUT` | Ticket box has no remaining tickets. |
| 422 | `PROBABILITY_SUM_INVALID` | Unlimited campaign prize probabilities do not sum to 100. |
| 422 | `INSUFFICIENT_TICKETS` | Multi-draw quantity exceeds remaining ticket count. |
| 422 | `CODE_INVALID` | Discount code does not exist, is expired, or is exhausted. |
| 422 | `INSUFFICIENT_REVENUE_POINTS` | Withdrawal amount exceeds revenue points balance. |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests. `Retry-After` header present. |
| 503 | `PAYMENT_GATEWAY_UNAVAILABLE` | Payment gateway is in degraded state; top-up is temporarily disabled. |
| 503 | `FEATURE_DISABLED` | The requested feature is turned off via feature flag. |
