# Live Draw Marquee Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real-time marquee on the homepage showing players currently doing multi-draws, clickable to spectate.

**Architecture:** Hybrid approach — initial API load via new `/api/v1/live-draws` endpoint + real-time updates via existing feed WebSocket (`feed:draws` Redis channel). Backend publishes `live_draw_started`/`live_draw_ended` events when multi-draws begin/end. Frontend maintains a Zustand store and renders a marquee component above the existing LiveMarquee.

**Tech Stack:** Kotlin/Ktor, Redis pub/sub, Zustand, Next.js, Tailwind

**Spec:** `docs/superpowers/specs/2026-03-29-live-draw-marquee-design.md`

---

## File Structure

### New Files
| Path | Responsibility |
|------|---------------|
| `server/src/main/kotlin/com/prizedraw/application/services/LiveDrawService.kt` | Service: publish live draw events + query active sessions |
| `server/src/main/kotlin/com/prizedraw/api/routes/LiveDrawRoutes.kt` | Route: `GET /api/v1/live-draws` |
| `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/dto/livedraw/LiveDrawDtos.kt` | DTOs for live draw events |
| `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/endpoints/LiveDrawEndpoints.kt` | Endpoint constants |
| `web/src/services/liveDrawService.ts` | Frontend API client for live draws |
| `web/src/stores/liveDrawStore.ts` | Zustand store for active live draws |
| `web/src/components/feed/LiveDrawMarquee.tsx` | Marquee component for active multi-draws |

### Modified Files
| Path | Change |
|------|--------|
| `server/src/main/kotlin/com/prizedraw/application/usecases/draw/DrawKujiUseCase.kt` | Publish `live_draw_started` when quantity >= 2 |
| `server/src/main/kotlin/com/prizedraw/api/routes/DrawRoutes.kt` | Publish `live_draw_ended` on session end/queue leave |
| `server/src/main/kotlin/com/prizedraw/infrastructure/di/ServiceModule.kt` | Register LiveDrawService |
| `server/src/main/kotlin/com/prizedraw/api/plugins/Routing.kt` | Mount live draw routes |
| `web/src/services/feedWebSocket.ts` | Handle `live_draw_started` / `live_draw_ended` message types |
| `web/src/app/page.tsx` | Add LiveDrawMarquee between banner and existing marquee |
| `web/src/i18n/zh-TW.json` | Add `live` i18n keys |
| `web/src/i18n/en.json` | Add `live` i18n keys |

---

## Task 1: API Contracts + DTOs

**Files:**
- Create: `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/dto/livedraw/LiveDrawDtos.kt`
- Create: `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/endpoints/LiveDrawEndpoints.kt`

- [ ] **Step 1: Write LiveDrawDtos**

```kotlin
package com.prizedraw.contracts.dto.livedraw

import kotlinx.serialization.Serializable

/** A currently active multi-draw session visible on the homepage. */
@Serializable
public data class LiveDrawItemDto(
    val sessionId: String,
    val playerId: String,
    val nickname: String,
    val campaignId: String,
    val campaignTitle: String,
    val quantity: Int,
)

/** Response for GET /api/v1/live-draws. */
@Serializable
public data class LiveDrawsResponse(
    val items: List<LiveDrawItemDto>,
)
```

- [ ] **Step 2: Write LiveDrawEndpoints**

```kotlin
package com.prizedraw.contracts.endpoints

/** API endpoint constants for live draw marquee. */
public object LiveDrawEndpoints {
    public const val LIVE_DRAWS: String = "/api/v1/live-draws"
}
```

- [ ] **Step 3: Verify build**

Run: `./gradlew :api-contracts:build`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(live-draw): add live draw API contracts and DTOs"
```

---

## Task 2: LiveDrawService (Backend)

**Files:**
- Create: `server/src/main/kotlin/com/prizedraw/application/services/LiveDrawService.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/infrastructure/di/ServiceModule.kt`

- [ ] **Step 1: Write LiveDrawService**

This service manages an in-memory set of active live draws and publishes events to the feed channel.

```kotlin
package com.prizedraw.application.services

import com.prizedraw.application.ports.output.IPubSubService
import com.prizedraw.contracts.dto.livedraw.LiveDrawItemDto
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.slf4j.LoggerFactory
import java.util.concurrent.ConcurrentHashMap

/**
 * Manages the set of active multi-draw sessions and publishes
 * start/end events to the `feed:draws` Redis pub/sub channel.
 */
public class LiveDrawService(
    private val pubSub: IPubSubService,
) {
    private val log = LoggerFactory.getLogger(LiveDrawService::class.java)
    private val activeSessions = ConcurrentHashMap<String, LiveDrawItemDto>()

    /** Returns all currently active live draw sessions. */
    public fun getActiveSessions(): List<LiveDrawItemDto> = activeSessions.values.toList()

    /** Registers a new multi-draw session and broadcasts LIVE_DRAW_STARTED. */
    public suspend fun startSession(item: LiveDrawItemDto) {
        activeSessions[item.sessionId] = item
        val payload = buildJsonObject {
            put("type", "live_draw_started")
            put("data", Json.encodeToJsonElement(LiveDrawItemDto.serializer(), item))
        }.toString()
        pubSub.publish("feed:draws", payload)
        log.debug("Live draw started: session={}, player={}", item.sessionId, item.nickname)
    }

    /** Removes a session and broadcasts LIVE_DRAW_ENDED. */
    public suspend fun endSession(sessionId: String) {
        val removed = activeSessions.remove(sessionId)
        if (removed != null) {
            val payload = buildJsonObject {
                put("type", "live_draw_ended")
                put("sessionId", sessionId)
            }.toString()
            pubSub.publish("feed:draws", payload)
            log.debug("Live draw ended: session={}", sessionId)
        }
    }

    /** Removes all sessions for a given player (e.g. on disconnect/queue leave). */
    public suspend fun endSessionsByPlayer(playerId: String) {
        val toRemove = activeSessions.values.filter { it.playerId == playerId }
        for (item in toRemove) {
            endSession(item.sessionId)
        }
    }
}
```

- [ ] **Step 2: Register in ServiceModule**

Add to `server/src/main/kotlin/com/prizedraw/infrastructure/di/ServiceModule.kt`:

```kotlin
single<LiveDrawService> { LiveDrawService(pubSub = get<IPubSubService>()) }
```

- [ ] **Step 3: Verify build**

Run: `./gradlew :server:build -x test`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(live-draw): add LiveDrawService with in-memory session tracking"
```

---

## Task 3: Emit Events in DrawKujiUseCase + DrawRoutes

**Files:**
- Modify: `server/src/main/kotlin/com/prizedraw/application/usecases/draw/DrawKujiUseCase.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/api/routes/DrawRoutes.kt`

- [ ] **Step 1: Read DrawKujiUseCase and DrawRoutes**

Understand the full flow: where quantity is known, where draw completes, where session ends.

- [ ] **Step 2: Add LiveDrawService dependency to DrawKujiDeps**

Add `val liveDrawService: LiveDrawService` to the `DrawKujiDeps` data class. Update the Koin binding in `UseCaseModule.kt` to pass `liveDrawService = get<LiveDrawService>()`.

- [ ] **Step 3: Publish LIVE_DRAW_STARTED after successful draw**

In `DrawKujiUseCase.execute()`, after the transaction commits and before `publishDrawEvents()`, if `resolvedTickets.size >= 2`:

```kotlin
if (resolvedTickets.size >= 2) {
    deps.liveDrawService.startSession(
        LiveDrawItemDto(
            sessionId = UUID.randomUUID().toString(),
            playerId = playerId.value.toString(),
            nickname = player?.nickname ?: "Player",
            campaignId = box.kujiCampaignId.value.toString(),
            campaignTitle = campaign?.title ?: "",
            quantity = resolvedTickets.size,
        ),
    )
}
```

- [ ] **Step 4: Publish LIVE_DRAW_ENDED on session end**

In DrawRoutes.kt, at the queue leave endpoint (`DELETE /queue/leave`) and the draw sync complete endpoint (`POST /draw/sync/complete`), call `liveDrawService.endSessionsByPlayer(playerId)`.

Inject `LiveDrawService` via Koin in the routes file.

- [ ] **Step 5: Verify build + existing tests**

Run: `./gradlew :server:build`

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(live-draw): emit live draw start/end events in draw use case"
```

---

## Task 4: Live Draw API Route

**Files:**
- Create: `server/src/main/kotlin/com/prizedraw/api/routes/LiveDrawRoutes.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/api/plugins/Routing.kt`

- [ ] **Step 1: Write LiveDrawRoutes**

```kotlin
package com.prizedraw.api.routes

import com.prizedraw.application.services.LiveDrawService
import com.prizedraw.contracts.dto.livedraw.LiveDrawsResponse
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get

/** Registers the live draw marquee API route (public, no auth). */
public fun Route.liveDrawRoutes() {
    val liveDrawService by inject<LiveDrawService>()

    get("/api/v1/live-draws") {
        val items = liveDrawService.getActiveSessions()
        call.respond(HttpStatusCode.OK, LiveDrawsResponse(items = items))
    }
}
```

Use the project's custom `Route.inject()` pattern (not `org.koin.ktor.ext.inject`).

- [ ] **Step 2: Mount in Routing.kt**

Add `liveDrawRoutes()` after the feed routes.

- [ ] **Step 3: Verify build**

Run: `./gradlew :server:build -x test`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(live-draw): add GET /api/v1/live-draws route"
```

---

## Task 5: Frontend — Service + Store + i18n

**Files:**
- Create: `web/src/services/liveDrawService.ts`
- Create: `web/src/stores/liveDrawStore.ts`
- Modify: `web/src/services/feedWebSocket.ts`
- Modify: `web/src/i18n/zh-TW.json`
- Modify: `web/src/i18n/en.json`

- [ ] **Step 1: Write liveDrawService.ts**

```typescript
import { apiClient } from "./apiClient";

export interface LiveDrawItem {
  sessionId: string;
  playerId: string;
  nickname: string;
  campaignId: string;
  campaignTitle: string;
  quantity: number;
}

interface LiveDrawsResponse {
  items: LiveDrawItem[];
}

export async function fetchLiveDraws(): Promise<LiveDrawItem[]> {
  const res = await apiClient.get<LiveDrawsResponse>("/api/v1/live-draws");
  return res.items;
}
```

- [ ] **Step 2: Write liveDrawStore.ts**

```typescript
import { create } from "zustand";
import type { LiveDrawItem } from "@/services/liveDrawService";
import { fetchLiveDraws } from "@/services/liveDrawService";

interface LiveDrawStore {
  draws: Map<string, LiveDrawItem>;
  isLoading: boolean;
  fetchLiveDraws: () => Promise<void>;
  addDraw: (item: LiveDrawItem) => void;
  removeDraw: (sessionId: string) => void;
}

export const useLiveDrawStore = create<LiveDrawStore>((set, get) => ({
  draws: new Map(),
  isLoading: false,

  fetchLiveDraws: async () => {
    set({ isLoading: true });
    try {
      const items = await fetchLiveDraws();
      const draws = new Map<string, LiveDrawItem>();
      for (const item of items) {
        draws.set(item.sessionId, item);
      }
      set({ draws });
    } catch {
      // silently fail
    } finally {
      set({ isLoading: false });
    }
  },

  addDraw: (item) => {
    set((state) => {
      const draws = new Map(state.draws);
      draws.set(item.sessionId, item);
      return { draws };
    });
  },

  removeDraw: (sessionId) => {
    set((state) => {
      const draws = new Map(state.draws);
      draws.delete(sessionId);
      return { draws };
    });
  },
}));
```

- [ ] **Step 3: Extend feedWebSocket.ts to handle live draw events**

Modify `web/src/services/feedWebSocket.ts`:

Add new types:
```typescript
export interface LiveDrawStartedMessage {
  type: "live_draw_started";
  data: LiveDrawItem; // import from liveDrawService
}

export interface LiveDrawEndedMessage {
  type: "live_draw_ended";
  sessionId: string;
}

export type FeedWsMessage =
  | { type: "feed_event"; data: DrawFeedEvent }
  | LiveDrawStartedMessage
  | LiveDrawEndedMessage;
```

Add new listener sets and update `onmessage`:
```typescript
export type LiveDrawListener = (msg: LiveDrawStartedMessage | LiveDrawEndedMessage) => void;
const liveDrawListeners = new Set<LiveDrawListener>();

// In onmessage handler, add:
if (msg.type === "live_draw_started" || msg.type === "live_draw_ended") {
  liveDrawListeners.forEach((cb) => cb(msg));
}
```

Export a `subscribeLiveDraws()` function following the same pattern as `subscribeFeed()`.

- [ ] **Step 4: Add i18n keys**

In `zh-TW.json`, add:
```json
"live": {
  "title": "正在連抽",
  "drawing": "{nickname} 正在 {campaign} 連抽中！"
}
```

In `en.json`, add:
```json
"live": {
  "title": "Live Draws",
  "drawing": "{nickname} is multi-drawing in {campaign}!"
}
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(live-draw): add frontend service, store, and feed WS integration"
```

---

## Task 6: Frontend — LiveDrawMarquee Component + Homepage Integration

**Files:**
- Create: `web/src/components/feed/LiveDrawMarquee.tsx`
- Modify: `web/src/app/page.tsx`

- [ ] **Step 1: Write LiveDrawMarquee.tsx**

A marquee component that:
1. On mount: calls `fetchLiveDraws()` from store
2. Subscribes to feed WebSocket for `live_draw_started`/`live_draw_ended`
3. Renders horizontal auto-scrolling marquee (reuse `animate-marquee`)
4. Each item: "🔴 {nickname} 正在 {campaignTitle} 連抽中！" — clickable → spectate
5. Returns null when no active draws

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLiveDrawStore } from "@/stores/liveDrawStore";
import { subscribeLiveDraws } from "@/services/feedWebSocket";

export function LiveDrawMarquee() {
  const t = useTranslations("live");
  const router = useRouter();
  const { draws, fetchLiveDraws, addDraw, removeDraw } = useLiveDrawStore();

  useEffect(() => {
    fetchLiveDraws();
    const unsub = subscribeLiveDraws((msg) => {
      if (msg.type === "live_draw_started") {
        addDraw(msg.data);
      } else if (msg.type === "live_draw_ended") {
        removeDraw(msg.sessionId);
      }
    });
    return unsub;
  }, [fetchLiveDraws, addDraw, removeDraw]);

  const items = Array.from(draws.values());
  if (items.length === 0) return null;

  const doubled = [...items, ...items]; // seamless loop

  return (
    <section className="py-2 bg-red-950/30 overflow-hidden border-y border-red-500/20">
      <div className="flex items-center px-4 mb-1">
        <span className="relative flex h-2 w-2 mr-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        <span className="text-xs text-red-400 font-medium">{t("title")}</span>
      </div>
      <div className="overflow-hidden whitespace-nowrap">
        <div className="animate-marquee flex items-center gap-4 px-4">
          {doubled.map((item, i) => (
            <button
              key={`${item.sessionId}-${i}`}
              onClick={() => router.push(`/campaigns/${item.campaignId}/board?spectate=true`)}
              className="flex items-center gap-2 shrink-0 rounded-lg px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 transition-colors cursor-pointer"
            >
              <span className="text-red-400 text-xs">🔴</span>
              <span className="text-xs text-on-surface font-medium">
                {t("drawing", { nickname: item.nickname, campaign: item.campaignTitle })}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add to homepage**

Modify `web/src/app/page.tsx`:

Import and add `<LiveDrawMarquee />` between the banner section and existing `<LiveMarquee>`:

```tsx
import { LiveDrawMarquee } from "@/components/feed/LiveDrawMarquee";

// ... after banner section, before LiveMarquee:
<LiveDrawMarquee />
<LiveMarquee currentPlayerId={currentPlayerId} />
```

- [ ] **Step 3: Verify frontend builds**

Run: `pnpm --filter web build` or dev server check.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(live-draw): add LiveDrawMarquee component and homepage integration"
```

---

## Task 7: Full Build + Verification

- [ ] **Step 1: Run backend build + tests**

Run: `./gradlew :server:build`

- [ ] **Step 2: Run frontend lint**

Run: `pnpm --filter web lint`

- [ ] **Step 3: Fix any issues**

- [ ] **Step 4: Final commit**

```bash
git commit -m "feat(live-draw): live draw marquee complete"
```
