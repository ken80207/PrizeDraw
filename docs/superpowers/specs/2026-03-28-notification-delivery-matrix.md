# Notification Delivery Matrix

## Purpose

This document captures the current notification delivery model for PrizeDraw after the
notification routing cleanup on 2026-03-28.

It answers three questions:

1. Which server-to-client events use WebSocket
2. Which events also use push notification
3. What the intended delivery strategy should be going forward

## Delivery Channels

### Real-time WebSocket Channels

These channels are for live state sync, not generic notification history:

| Channel | Path | Purpose |
| --- | --- | --- |
| Kuji room | `/ws/kuji/{campaignId}` and `/ws/kuji/{campaignId}/rooms/{roomInstanceId}` | Draw-room sync, room assignment, spectator state |
| Queue | `/ws/queue/{ticketBoxId}` | Queue snapshot and queue updates |
| Chat | `/ws/chat/{roomId}` | Chat history and new chat messages |
| Feed | `/ws/feed` | Public live draw feed |
| Player notifications | `/ws/player/notifications` | Per-player personal notification stream |

### Persistent Notification History

Player-targeted notifications are also persisted into the `notifications` table so the client
can fetch notification history, unread count, and read state over REST.

### Push Notification

Offline / background delivery uses Firebase Cloud Messaging (FCM). The server looks up device
tokens from the `player_devices` registry and sends push notifications through
`FirebaseNotificationService`.

## Delivery Rules

### Rule 1: Live room state is WebSocket-only

The following event families are live interaction state and should stay WebSocket-only:

- Kuji room sync
- Queue updates
- Chat
- Public draw feed

These are meaningful only while the user is actively watching a screen. They are not
notification-center events.

### Rule 2: Personal notifications use DB history + player WS

For personal notifications, the canonical path is:

1. enqueue outbox event
2. resolve recipients
3. persist notification record
4. publish to `ws:player:{playerId}`

This gives immediate in-app delivery plus reconnection / unread recovery through REST.

### Rule 3: Important personal events also use push

Events that matter while the player is offline or backgrounded should additionally send FCM push.

## Event Matrix

### A. Live state channels

| Event family | DB history | Player WS | Room/feed WS | Push | Notes |
| --- | --- | --- | --- | --- | --- |
| Kuji room draw sync / room lifecycle | No | No | Yes | No | Interactive room state |
| Queue state changes | No | No | Yes | No | Interactive queue state |
| Chat messages / reactions | No | No | Yes | No | Interactive room state |
| Public live draw feed | No | No | Yes | No | Public feed, not personal |

### B. Personal notification events

| Event type | DB history | Player WS | Push | Strategy |
| --- | --- | --- | --- | --- |
| `draw.completed` | Yes | Yes | Yes | WS + push + history |
| `trade.completed` | Yes | Yes | Yes | WS + push + history |
| `exchange.completed` | Yes | Yes | Yes | WS + push + history |
| `exchange.requested` | Yes | Yes | Yes | WS + push + history |
| `exchange.counter_proposed` | Yes | Yes | Yes | WS + push + history |
| `exchange.rejected` | Yes | Yes | Yes | WS + push + history |
| `buyback.completed` | Yes | Yes | No | WS + history only |
| `shipping.status_changed` | Yes | Yes | Yes | WS + push + history |
| `payment.confirmed` | Yes | Yes | No | WS + history only |
| `payment.failed` | Yes | Yes | Yes | WS + push + history |
| `withdrawal.status_changed` | Yes | Yes | Yes | WS + push + history |
| `support_ticket.replied` | Yes | Yes | Yes | WS + push + history |
| `player.level_up` | Yes | Yes | Yes | WS + push + history |
| `following.draw_started` | Yes | Yes | Yes | WS + push + history |
| `following.rare_prize_drawn` | Yes | Yes | Yes | WS + push + history |
| `favorite.campaign_activated` | Yes | Yes | Yes | WS + push + history |
| `favorite.campaign_low_stock` | Yes | Yes | Yes | WS + push + history |

## Current Implementation Notes

### OutboxWorker

`OutboxWorker` is the central notification router for personal notifications. It:

1. extracts target player IDs
2. computes notification title/body
3. persists one notification per player
4. publishes a player-specific WebSocket payload
5. optionally sends FCM push

This should remain the single source of truth for player-targeted notification delivery.

### Player notification WebSocket

The player notification channel is backed by Redis pub/sub:

- Redis channel naming convention: `ws:player:{playerId}`
- Ktor path: `/ws/player/notifications`
- on connect: server sends unread count
- while connected: all personal events are fanned out to every active session for that player

### Subscription lifecycle

The subscription cleanup bug was fixed on 2026-03-28:

- `RedisPubSub.subscribe()` now removes listeners on collector cancellation
- `PlayerNotificationManager` now cancels the per-player subscription when the last local
  WebSocket session disconnects

This prevents stale listener and subscription accumulation.

### Event naming cleanup

The following event type mismatches were fixed on 2026-03-28:

- `exchange.request.created` -> `exchange.requested`
- `shipping.status.changed` -> `shipping.status_changed`

These names must stay aligned between event producers and `OutboxWorker`.

## Recommended Ongoing Rules

### Use WebSocket-only when:

- the event is ephemeral
- it only matters while the user is actively on the page
- it belongs to a shared room or feed

Examples: room sync, queue state, chat, public feed

### Use DB history + player WS when:

- the event belongs to one or more specific players
- it should appear in the notification center
- it should recover after reconnect

Examples: all personal notification events

### Add push when:

- the event is important if the user is offline
- the event is action-worthy or user-visible enough to justify interruption

Examples: exchange requests, shipping updates, support replies, favorite campaign alerts

### Do not add push when:

- the event is already visible in the current foreground flow
- the event is transactional feedback that would likely feel noisy

Examples: `payment.confirmed`, `buyback.completed`

## Anti-Patterns To Avoid

- Writing notification history directly in one place but sending push elsewhere
- Introducing new personal notification events without routing them through `OutboxWorker`
- Using room/feed WebSocket channels as a substitute for personal notification delivery
- Adding push for high-frequency room-like events such as queue or chat updates
- Allowing event type strings to diverge between producers and consumers

## Recommended Next Step

When a new personal notification event is introduced:

1. define the event type once
2. enqueue it through the outbox
3. add its title/body mapping in `OutboxWorker`
4. decide explicitly whether push should be sent
5. add a test covering the event contract and delivery routing
