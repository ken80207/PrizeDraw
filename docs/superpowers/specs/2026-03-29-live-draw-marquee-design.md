# Live Draw Marquee Design

## Overview

Add a real-time marquee on the homepage showing players currently doing multi-draws (quantity >= 2). Clicking an item navigates to the campaign board in spectate mode. Uses a hybrid approach: initial API load + WebSocket updates.

## Requirements

### Display
- Horizontal auto-scrolling marquee on homepage, between banner carousel and campaign list
- Each item: "🔴 {nickname} 正在 {campaignTitle} 連抽中！"
- Click → `/campaigns/{campaignId}/board?spectate=true`
- Hidden when no active live draws

### Data Source (Hybrid)
- Initial load via `GET /api/v1/live-draws`
- Real-time updates via feed WebSocket: `LIVE_DRAW_STARTED` and `LIVE_DRAW_ENDED` events

### Eligibility
- Draw session active (not expired) AND quantity >= 2

---

## Backend

### New API Endpoint

`GET /api/v1/live-draws` (public, no auth required)

Response:
```json
{
  "items": [
    {
      "sessionId": "uuid",
      "playerId": "uuid",
      "nickname": "string",
      "campaignId": "uuid",
      "campaignTitle": "string",
      "quantity": 5
    }
  ]
}
```

Implementation: query active draw sessions where quantity >= 2 and session not expired.

### WebSocket Events

Add to existing feed WebSocket (`/ws/feed`):

**LIVE_DRAW_STARTED** — pushed when a player begins a multi-draw (quantity >= 2)
```json
{
  "type": "LIVE_DRAW_STARTED",
  "sessionId": "uuid",
  "playerId": "uuid",
  "nickname": "string",
  "campaignId": "uuid",
  "campaignTitle": "string",
  "quantity": 5
}
```

**LIVE_DRAW_ENDED** — pushed when a draw session ends or expires
```json
{
  "type": "LIVE_DRAW_ENDED",
  "sessionId": "uuid"
}
```

### Trigger Points

- **DrawKujiUseCase**: after successful draw with quantity >= 2, publish `LIVE_DRAW_STARTED` via Redis pub/sub to feed channel
- **Session end**: when player finishes their turn (handleEndTurn) or session expires, publish `LIVE_DRAW_ENDED` via Redis pub/sub

---

## Frontend

### Store: `liveDrawStore.ts`

Zustand store maintaining a `Map<sessionId, LiveDrawItem>`:

```typescript
interface LiveDrawItem {
  sessionId: string;
  playerId: string;
  nickname: string;
  campaignId: string;
  campaignTitle: string;
  quantity: number;
}

interface LiveDrawStore {
  draws: Map<string, LiveDrawItem>;
  fetchLiveDraws: () => Promise<void>;
  addDraw: (item: LiveDrawItem) => void;
  removeDraw: (sessionId: string) => void;
}
```

### Data Flow

1. Homepage mounts → `fetchLiveDraws()` calls `GET /api/v1/live-draws`, populates store
2. Feed WebSocket listener:
   - `LIVE_DRAW_STARTED` → `addDraw(item)`
   - `LIVE_DRAW_ENDED` → `removeDraw(sessionId)`

### UI: LiveDrawMarquee Component

- Location: homepage, between banner carousel and campaign list
- Uses existing `animate-marquee` CSS class for horizontal scroll
- Each item: clickable chip with "🔴 {nickname} 正在 {campaignTitle} 連抽中！"
- Click handler: `router.push(/campaigns/{campaignId}/board?spectate=true)`
- Renders nothing when `draws.size === 0`

### i18n

- `live.drawing`: "🔴 {nickname} 正在 {campaign} 連抽中！"
- `live.title`: "正在抽獎"

---

## Architecture Alignment

- Reuses existing feed WebSocket infrastructure (FeedWebSocketHandler, Redis pub/sub)
- Reuses existing `animate-marquee` CSS utility
- Reuses spectate mode navigation (`?spectate=true`)
- New API endpoint follows existing CampaignRoutes pattern
- LiveDrawStore follows existing Zustand store conventions
