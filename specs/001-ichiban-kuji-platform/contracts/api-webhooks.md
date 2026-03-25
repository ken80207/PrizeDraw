# Inbound Webhook Contract — Prize Draw Platform

**Version**: 1.0.0

This document covers all inbound webhooks that the platform receives from external services. Outbound webhooks (if added in the future) are a separate concern.

---

## 1. Payment Gateway Callback

The platform integrates with ECPay and NewebPay as the primary payment gateways for Taiwan. Both gateways notify the platform of transaction outcomes via HTTP POST to a fixed endpoint.

### Endpoint

```
POST /api/v1/payment/webhook
```

This endpoint is **public** — it does not require a player JWT. Security is enforced via HMAC signature verification (see [Security](#security)).

---

### ECPay Payload

ECPay sends `application/x-www-form-urlencoded` POST data.

| Field | Type | Description |
|---|---|---|
| `MerchantID` | string | ECPay merchant ID; used to look up the signing key. |
| `MerchantTradeNo` | string | Merchant-side order ID. Maps to `PaymentOrder.id` in the platform. |
| `TradeNo` | string | ECPay's internal transaction reference number. |
| `RtnCode` | integer | `1` = success; any other value = failure. |
| `RtnMsg` | string | Human-readable result message from the gateway. |
| `TradeAmt` | integer | Charged amount in TWD. |
| `PaymentDate` | string | `yyyy/MM/dd HH:mm:ss` — gateway-side payment timestamp. |
| `PaymentType` | string | e.g. `Credit_CreditCard`, `CVS_CVS`, `BARCODE_BARCODE`. |
| `CheckMacValue` | string | SHA-256 HMAC of the sorted field string. |

**Example (URL-decoded)**:
```
MerchantID=2000132&MerchantTradeNo=f47ac10b58cc&TradeNo=2403241234567&RtnCode=1&RtnMsg=Succeeded&TradeAmt=500&PaymentDate=2026/03/24+14:30:00&PaymentType=Credit_CreditCard&CheckMacValue=ABCDEF...
```

---

### NewebPay Payload

NewebPay sends `application/x-www-form-urlencoded` POST data with an AES-encrypted `TradeInfo` field.

| Field | Type | Description |
|---|---|---|
| `Status` | string | `SUCCESS` = success; otherwise an error code string. |
| `MerchantID` | string | NewebPay merchant ID. |
| `TradeInfo` | string | AES-256-CBC encrypted payload (see below). |
| `TradeSha` | string | SHA-256 hash of the `TradeInfo` ciphertext for integrity verification. |
| `Version` | string | API version, e.g. `2.0`. |

**Decrypted `TradeInfo` fields**:

| Field | Type | Description |
|---|---|---|
| `Status` | string | `SUCCESS` or error code. |
| `Amt` | integer | Transaction amount in TWD. |
| `MerchantOrderNo` | string | Merchant-side order ID. Maps to `PaymentOrder.id`. |
| `TradeNo` | string | NewebPay's transaction reference. |
| `PaymentType` | string | e.g. `CREDIT`, `WEBATM`, `CVS`. |
| `PayTime` | string | `yyyy-MM-dd HH:mm:ss` format. |

---

### Normalised Internal Payload

Regardless of gateway, the webhook handler normalises the inbound data to the following internal structure before processing:

```json
{
  "gateway": "ecpay" | "newebpay",
  "orderId": "uuid",              // maps to PaymentOrder.id (MerchantTradeNo / MerchantOrderNo)
  "gatewayTransactionId": "string",
  "status": "success" | "failure",
  "amountNtd": 500,
  "paymentMethod": "credit_card" | "mobile_pay" | "cvs_code" | "web_atm",
  "paidAt": "ISO-8601",
  "rawPayload": { }               // archived original payload for audit
}
```

---

### Security

**ECPay**: Compute SHA-256 HMAC over the URL-encoded, lexicographically sorted parameter string (excluding `CheckMacValue` itself) sandwiched between `HashKey=<key>&` and `&HashIV=<iv>`. Compare with the received `CheckMacValue`. Reject with `400` if mismatch.

**NewebPay**: Verify `TradeSha` by computing `SHA256("HashKey=<key>&<TradeInfo>&HashIV=<iv>")` and comparing. Then decrypt `TradeInfo` using AES-256-CBC with the same key/IV pair. Reject with `400` if SHA check fails or decryption produces an unparseable payload.

The signing keys are stored in environment variables and never in source code.

---

### Idempotency Strategy

A payment callback may be delivered more than once (gateway retry on network timeout, ECPay's mandatory re-notification). The platform MUST handle duplicate deliveries safely.

**Deduplication key**: `(gateway, gatewayTransactionId)` stored in a `processed_webhook_events` table with a `UNIQUE` constraint.

**Algorithm**:

```
1. Parse and verify HMAC signature. If invalid → respond 400.
2. Look up PaymentOrder by orderId.
   - If not found → respond 200 with {"received": true, "skipped": "unknown_order"}.
     (Responding 200 prevents the gateway from retrying indefinitely for phantom orders.)
3. Acquire a distributed lock keyed on gatewayTransactionId (Redis SETNX, TTL 60 s).
   - If lock not acquired → respond 200 with {"received": true, "skipped": "processing"}.
4. Check processed_webhook_events for (gateway, gatewayTransactionId).
   - If already exists → respond 200 with {"received": true, "skipped": "duplicate"}.
5. Begin database transaction:
   a. Insert row into processed_webhook_events.
   b. If status == "success":
      - Verify amountNtd matches PaymentOrder.amountNtd. If mismatch → mark order as "amount_mismatch", alert ops.
      - Set PaymentOrder.status = "paid", PaymentOrder.gatewayTransactionId = gatewayTransactionId.
      - Credit drawPoints to the player's account (DrawPointTransaction inserted).
      - Emit player:points-update via Socket.IO.
   c. If status == "failure":
      - Set PaymentOrder.status = "failed".
      - Emit notification:new (type: "payment_failed") to player:{playerId}.
   d. Commit transaction.
6. Release distributed lock.
7. Respond 200 with {"received": true}.
```

---

### Response

The endpoint MUST always respond `200 OK` once the payload has been accepted (even for duplicates). Any non-200 response will trigger gateway retries.

**Success**:
```json
{ "received": true }
```

**Signature invalid** (the only case where a non-200 is appropriate — gateway should NOT retry with a forged signature):
```
HTTP 400
{ "error": "INVALID_SIGNATURE" }
```

---

### Error Handling

| Scenario | Behaviour |
|---|---|
| HMAC signature mismatch | Reject `400 INVALID_SIGNATURE`. Log with full raw payload for security review. |
| `orderId` not found in platform | Accept `200`, mark as `skipped: unknown_order`, send alert to ops Slack channel. |
| `amountNtd` mismatch | Accept the callback but flag `PaymentOrder.status = "amount_mismatch"`. Do NOT credit points. Alert ops. |
| Database error during processing | Return `500`. The gateway will retry. The idempotency key ensures safe re-processing once the DB recovers. |
| Duplicate delivery | Accept `200`, return `skipped: duplicate`. No side effects. |
| Gateway degraded mode (feature flag `payment_gateway` = off) | Callbacks are still processed normally. Only the `POST /payment/topup` endpoint is blocked for new orders. |

---

## 2. LINE Messaging API Webhook

The platform uses a LINE Official Account as a customer support channel for the Taiwan market (FR-025a). LINE delivers user message events as HTTP POST requests to the platform.

### Endpoint

```
POST /api/v1/line/webhook
```

This endpoint is **public** — no player JWT. Security is enforced via LINE's `X-Line-Signature` header.

---

### Expected Payload

LINE sends `application/json`. The full spec is at https://developers.line.biz/en/reference/messaging-api/#webhooks but the fields the platform cares about are:

```json
{
  "destination": "Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "events": [
    {
      "type": "message",
      "mode": "active",
      "timestamp": 1742815800000,
      "source": {
        "type": "user",
        "userId": "Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      },
      "webhookEventId": "01HXYZ...",
      "deliveryContext": { "isRedelivery": false },
      "replyToken": "nHuyWiB7yP5Zw52FIkcQobQuGDXCTA",
      "message": {
        "id": "468789303085056003",
        "type": "text" | "image" | "sticker" | "file",
        "text": "I have a problem with my order"  // present for type=text only
      }
    }
  ]
}
```

Additional event types that the platform handles:

| `type` | Action |
|---|---|
| `message` | Create or update a support ticket (see algorithm below). |
| `follow` | Record the LINE user ID binding if the LINE user is already a registered player; send a welcome reply. |
| `unfollow` | Mark the player's LINE channel as unlinked. |

Other event types (`postback`, `beacon`, etc.) are acknowledged (`200`) and ignored.

---

### Security

LINE signs each webhook delivery with a channel secret. Verify by computing `Base64(HMAC-SHA256(<channel_secret>, <raw_request_body>))` and comparing to the `X-Line-Signature` request header.

- If the signature is missing or invalid → respond `400`.
- The channel secret is stored in an environment variable.

**Important**: Read the raw request body bytes before any JSON parsing to ensure the HMAC is computed over the exact bytes LINE signed.

---

### Player Identity Resolution

The `source.userId` is a LINE-specific user ID (opaque string). The platform resolves it to a `Player` via the `player_line_bindings` table:

```
player_line_bindings(player_id, line_user_id, bound_at)
```

If no binding exists (the user has never linked their LINE account to a platform account), the platform:
1. Sends an automatic reply via LINE Messaging API asking the user to link their account through the mobile app or web.
2. Stores the inbound message in a `pending_line_messages` buffer keyed on `line_user_id` for up to 48 hours.
3. Once the player links their account, the buffered messages are flushed into a new support ticket.

---

### Message Processing Algorithm

```
1. Verify X-Line-Signature. If invalid → respond 400.
2. Respond 200 immediately (LINE requires a response within 1 second).
3. For each event in events[] (process asynchronously via queue):
   a. If event.deliveryContext.isRedelivery == true:
      - Check idempotency store for webhookEventId.
      - If already processed → skip.
   b. Resolve line_user_id → player_id.
      - If unresolved → buffer message, send link-account reply, skip further processing.
   c. Look up open support ticket for this player with source = "line".
      - If exists and status in ["open", "in_progress"]:
        - Append a new message to the existing ticket's conversation.
      - If none exists (or all are "resolved"):
        - Create a new SupportTicket with category="line_message", status="open", source="line".
        - Add the incoming message as the first message.
   d. Attach any media (image/file) by downloading from LINE Content API and uploading to S3.
      Store the S3 URL in the message's attachmentUrls.
   e. Emit notification:new to the assigned support agent if the ticket is already in_progress.
   f. Record webhookEventId in idempotency store (Redis SET with 72-hour TTL).
```

---

### Response

LINE requires an HTTP `200` within 1 second, or it will retry. The platform MUST respond immediately and process asynchronously.

```
HTTP 200
(empty body or)
{ "received": true }
```

**Signature invalid**:
```
HTTP 400
(empty body — LINE does not retry on 4xx)
```

---

### Idempotency Strategy

LINE may redeliver events when it does not receive a timely `200`. The `deliveryContext.isRedelivery` flag indicates a redelivery, but the platform also tracks `webhookEventId` unconditionally:

- **Store**: Redis `SET line:event:{webhookEventId} 1 EX 259200` (72-hour TTL, matching LINE's redelivery window).
- **Check**: Before processing each event, check if the key exists. If it does, skip processing and return.
- **Write**: After successfully processing and persisting the message, write the key.

Because the `200` response goes out before async processing, there is a small window where a redelivery arrives before the idempotency key is written. The deduplication logic in the async processor handles this via the unique constraint on `(ticket_id, line_message_id)` in the `support_ticket_messages` table.

---

### Error Handling

| Scenario | Behaviour |
|---|---|
| Signature mismatch | `400`. Log security alert. |
| LINE user not bound to any player | Buffer message, auto-reply with account link instructions. |
| LINE Content API download fails | Save text message; mark attachment as `pending_download`. Retry up to 3 times with exponential backoff. |
| Support ticket creation fails (DB error) | Retry up to 3 times via job queue. If still failing, alert ops and send auto-reply to user. |
| Duplicate event (isRedelivery or idempotency hit) | `200` immediately. No side effects. |
| LINE feature flag (`line_support`) disabled | Accept `200`, record raw event in `line_events_log` for replay if flag is re-enabled. Do not create tickets. |

---

## Shared Webhook Infrastructure

### IP Allowlisting

Both ECPay and LINE publish documented IP ranges for their webhook delivery servers. The platform's ingress SHOULD allowlist these ranges at the load balancer level as a defence-in-depth measure in addition to HMAC verification.

### Request Logging

All inbound webhook HTTP requests are logged with:
- Received timestamp
- `X-Request-Id` (generated by the platform's edge if not present)
- Gateway / source identifier
- Raw body (truncated to 8 KB for storage)
- Computed vs. received signature (pass/fail only — never log the signing key)
- Processing outcome

Logs are retained for 90 days to support payment dispute resolution (FR-040).

### Replay Support

The `raw_webhook_events` table stores every accepted inbound webhook payload indefinitely (compressed). An internal admin endpoint `POST /internal/webhooks/replay/:id` allows ops to re-process a specific event without re-triggering the external gateway. This is used when a processing bug is fixed and historical events need to be re-applied.
