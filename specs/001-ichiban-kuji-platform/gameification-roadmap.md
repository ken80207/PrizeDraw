# 遊戲化路線圖（Gameification Roadmap）

## 總覽

將抽獎體驗從「點擊 → 看結果」進化為「沉浸式遊戲體驗」，分三個階段推進。每個階段都包含觀戰同步和社交互動。

```
Phase 1: 互動動畫          Phase 2: 迷你遊戲           Phase 3: 線上遊戲房間
┌──────────────┐      ┌──────────────────┐      ┌──────────────────────┐
│ 撕紙（物理）  │      │ 拉霸機            │      │ 2.5D 虛擬商店        │
│ 刮刮樂        │  →   │ 夾娃娃機          │  →   │ 角色走動/排隊/選籤   │
│ 翻牌          │      │ 扭蛋機 / 輪盤     │      │ 頭頂氣泡顯示結果     │
│ + 觀戰同步    │      │ + 觀戰同步        │      │ + 即時互動           │
│ + Chat        │      │ + Chat            │      │ + Chat / 表情        │
└──────────────┘      └──────────────────┘      └──────────────────────┘
         ↑ 現在                  ↑ 下一步                  ↑ 長期目標
```

---

## 跨 Phase 共通架構：觀戰同步 + Chat

### 核心原則

**結果延遲揭曉**：Server 在抽獎者完成動畫/遊戲前，不向觀戰者透露結果。防止「暴雷」。

```
時間軸：
t0  抽獎者選籤 #23
t1  Server 計算結果 = A賞（但不廣播結果）
t2  Server 廣播 DRAW_STARTED { ticketId: 23, animationMode: TEAR }
t3  抽獎者撕紙中... Server 廣播 DRAW_PROGRESS { progress: 0.3 }
t4  抽獎者撕紙中... Server 廣播 DRAW_PROGRESS { progress: 0.6 }
t5  抽獎者撕到 70% → Server 廣播 DRAW_REVEALED { grade: A, name: xxx }
t6  觀戰者同步看到揭曉動畫 + 結果
```

### WebSocket 事件設計

```
// === 抽獎同步 ===

// 抽獎者 → Server（Client-to-Server）
C2S_DRAW_START        { ticketId, animationMode }
C2S_DRAW_PROGRESS     { ticketId, progress: Float 0.0~1.0 }
C2S_DRAW_CANCEL       { ticketId }                          // 手指拉回，取消
C2S_DRAW_COMPLETE     { ticketId }                          // 動畫完成，請求揭曉

// Server → 所有觀戰者（Server-to-Client broadcast）
S2C_DRAW_STARTED      { ticketId, playerId, nickname, animationMode }
S2C_DRAW_PROGRESS     { ticketId, progress: Float }
S2C_DRAW_CANCELLED    { ticketId }
S2C_DRAW_REVEALED     { ticketId, grade, prizeName, prizePhotoUrl, drawnByNickname }

// === Chat ===

C2S_CHAT_MESSAGE      { roomId, message: String }           // max 100 chars
C2S_CHAT_REACTION     { roomId, emoji: String }             // 預設表情

S2C_CHAT_MESSAGE      { playerId, nickname, message, timestamp }
S2C_CHAT_REACTION     { playerId, nickname, emoji, timestamp }

// === 觀戰（無限賞直播）===

C2S_START_BROADCAST   { campaignId }                        // 抽獎者開啟直播
C2S_STOP_BROADCAST    { campaignId }

S2C_BROADCAST_STARTED { campaignId, playerId, nickname }    // 通知大廳有人在直播
S2C_BROADCAST_ENDED   { campaignId, playerId }
```

### Server 端需求

```kotlin
// 新增 application/services/DrawSyncService.kt
class DrawSyncService(
    private val redisPubSub: RedisPubSub,
    private val drawRepository: IDrawRepository,
) {
    // 抽獎者開始抽 → 暫存結果到 Redis，不廣播
    suspend fun startDraw(playerId: UUID, ticketId: UUID, animationMode: String) {
        // 1. Server 計算並暫存結果到 Redis: draw:pending:{ticketId} = { grade, prizeName }
        // 2. 廣播 DRAW_STARTED（不含結果）
    }

    // 轉發進度給觀戰者
    suspend fun relayProgress(ticketId: UUID, progress: Float) {
        // 廣播 DRAW_PROGRESS
    }

    // 抽獎者取消（手指拉回）
    suspend fun cancelDraw(ticketId: UUID) {
        // 清除 Redis 暫存
        // 廣播 DRAW_CANCELLED
    }

    // 抽獎者動畫完成 → 揭曉結果
    suspend fun completeDraw(ticketId: UUID) {
        // 1. 從 Redis 取出暫存結果
        // 2. 執行 DB 交易（扣點、轉移賞品）
        // 3. 廣播 DRAW_REVEALED（含結果）
    }
}
```

### Chat 系統

```kotlin
// 新增 application/services/ChatService.kt
class ChatService(
    private val redisPubSub: RedisPubSub,
) {
    // roomId = "kuji:{campaignId}" 或 "unlimited:{campaignId}:{broadcasterId}"
    suspend fun sendMessage(roomId: String, playerId: UUID, nickname: String, message: String) {
        // 敏感詞過濾
        // 頻率限制（每人每秒 2 條）
        // 廣播到房間
    }

    suspend fun sendReaction(roomId: String, playerId: UUID, nickname: String, emoji: String) {
        // 預設表情列表驗證
        // 廣播
    }
}

// 預設表情：🎉 😱 👏 🔥 💪 😂 ❤️ 🎊
```

### DB 新增

```sql
-- Chat 訊息不需要持久化（Redis pub/sub 即時廣播即可）
-- 但如果要歷史紀錄：

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id VARCHAR(128) NOT NULL,
    player_id UUID NOT NULL REFERENCES players(id),
    message TEXT NOT NULL,
    is_reaction BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_chat_room_time ON chat_messages (room_id, created_at DESC);

-- 無限賞直播狀態
CREATE TABLE broadcast_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL,
    player_id UUID NOT NULL REFERENCES players(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    viewer_count INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);
```

---

## Phase 1：互動動畫（現在）

### 撕籤模式 — 物理撕紙

核心交互：
```
┌────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░ │  ← 紙張覆蓋層
│ ░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░(手指拖曳)░░░░░ │
│ ░░░░░░/            ░░░ │  ← 紙張從手指位置掀起
│ ░░░░/   [賞品圖]    ░░ │  ← 露出下面的賞品
│ ░░/                 ░░ │
│ ░───────────────────░░ │  ← 折線（有翻折效果）
│ ░░░░░░░░░░░░░░░░░░░░░░ │
└────────────────────────┘

手指拖得越遠 → 紙掀得越多 → 露出越多賞品圖
手指放開或拉回 → 紙彈回去蓋住（像貼紙）
拉超過 70% → 紙自動撕掉 → 完整揭曉
```

技術要點：
- **可回復**：手指位置決定紙張掀開程度，不是永久消除
- **3D 翻折效果**：掀起的部分有陰影和捲曲
- **物理感**：放開手指時紙有彈性回彈動畫
- **閾值觸發**：超過 70% 才不可逆

觀戰者看到的：
- Server 傳 progress (0.0 ~ 1.0)
- 觀戰端播放簡化版動畫（紙從邊緣掀開，跟著 progress 值）
- progress < 0.7 時觀戰者看不到賞品（紙還蓋著）
- progress ≥ 0.7 → DRAW_REVEALED → 同步揭曉

### 刮刮樂模式

保持現有不可逆刮除（符合刮刮樂直覺）。觀戰者看到進度跟著增加。

### 翻牌模式

保持現有翻轉動畫。觀戰者看到卡片翻轉。

---

## Phase 2：迷你遊戲

### 設計原則

1. **結果預決**：Server 在遊戲開始前就決定結果，遊戲只是視覺演出
2. **操控感**：玩家感覺自己在「操控」，但結果不受操控影響
3. **時長控制**：每個遊戲 5~15 秒，不能太長影響排隊體驗
4. **可跳過**：玩家可以選擇跳過遊戲直接看結果

### 迷你遊戲清單

#### 拉霸機（Slot Machine）
```
┌──────────────────────────┐
│     🎰 PRIZE DRAW 🎰     │
│  ┌──────┬──────┬──────┐  │
│  │  🅰  │  🅱  │  🅰  │  │  ← 3 個滾輪
│  │  ▼   │  ▼   │  ▼   │  │
│  │  🅱  │ [🅰] │  🅲  │  │  ← 中間行 = 結果
│  │  ▼   │  ▼   │  ▼   │  │
│  │  🅲  │  🅳  │  🅱  │  │
│  └──────┴──────┴──────┘  │
│                          │
│     [🔴 拉桿 / 按鈕]      │
└──────────────────────────┘
```
- 玩家拉桿（拖曳手勢）或按按鈕
- 3 個滾輪依序停下（1 秒間隔）
- 停下位置預設為 Server 決定的結果
- 三個一樣 = 大獎動畫 + 金光特效

#### 夾娃娃機（Claw Machine）
```
┌──────────────────────────┐
│  ═══════[夾子]═══════    │
│         ╔═╗              │
│         ║ ║              │
│         ╚╤╝              │
│          │               │
│    ┌─┐ ┌─┐ ┌─┐ ┌─┐     │  ← 賞品球散落
│    │A│ │C│ │B│ │D│     │
│    └─┘ └─┘ └─┘ └─┘     │
│  ◄────── 移動 ──────►   │
│         [按鈕: 放下]      │
└──────────────────────────┘
```
- 玩家左右移動夾子（觸控滑動）
- 按下「放下」→ 夾子下降
- 不管夾到哪裡，結果都是 Server 預決的賞品
- 視覺上做出「精準夾到」那顆球的效果

#### 扭蛋機（Gacha Machine）
```
┌──────────────────────────┐
│      ╭────────────╮      │
│     ╱  ○ ○ ○ ○ ○  ╲     │  ← 透明球體，裡面有彩色蛋
│    │  ○ ○ ○ ○ ○ ○  │    │
│    │  ○ ○ ○ ○ ○ ○  │    │
│     ╲  ○ ○ ○ ○ ○  ╱     │
│      ╰────┬───────╯      │
│           │              │
│      [旋轉把手]          │  ← 旋轉手勢
│           ▼              │
│        ┌─────┐           │
│        │ 出口 │ → 🥚     │  ← 扭蛋掉出來 → 打開
│        └─────┘           │
└──────────────────────────┘
```
- 玩家旋轉把手（旋轉手勢）
- 扭蛋掉出 → 點擊打開 → 揭曉

### 技術選型

| 平台 | 引擎 | 原因 |
|------|------|------|
| Web | **PixiJS 8** | 輕量 2D WebGL 引擎，適合迷你遊戲，bundle < 100KB |
| Mobile | **Compose Canvas** + 自訂動畫 | 不引入額外引擎，用 Compose 的 Canvas + animateFloatAsState 實現 |

如果 Compose Canvas 表現不夠（夾娃娃的物理模擬），Mobile 可考慮：
- **Korge**（Kotlin 遊戲引擎，KMP 原生支援）
- **libGDX**（成熟的 Java/Kotlin 遊戲引擎）

### 專案結構

```
web/src/games/
├── SlotMachine/
│   ├── SlotMachine.tsx      # React 容器
│   ├── SlotMachineGame.ts   # PixiJS 遊戲邏輯
│   ├── assets/              # 滾輪圖片、音效
│   └── types.ts
├── ClawMachine/
│   ├── ClawMachine.tsx
│   ├── ClawMachineGame.ts
│   └── assets/
├── GachaMachine/
│   ├── GachaMachine.tsx
│   ├── GachaMachineGame.ts
│   └── assets/
└── GameDispatcher.tsx        # 依玩家偏好或隨機選擇遊戲

mobile/composeApp/.../games/
├── SlotMachineGame.kt
├── ClawMachineGame.kt
├── GachaMachineGame.kt
└── GameDispatcher.kt
```

### Server 配合

```kotlin
// 遊戲模式也是 DrawAnimationMode 的擴展
enum class DrawAnimationMode {
    // Phase 1
    TEAR, SCRATCH, FLIP, INSTANT,
    // Phase 2
    SLOT_MACHINE, CLAW_MACHINE, GACHA_MACHINE, ROULETTE
}

// DrawSyncService 擴展
// 遊戲開始時就預決結果，遊戲結束後揭曉
// 觀戰者看到的是遊戲畫面的簡化版（進度條 + 最終結果）
```

---

## Phase 3：2.5D 線上遊戲房間

### 概念

一番賞活動頁面不再是表格/Grid，而是一個**等距視角（isometric）的虛擬商店**。

```
            ╱╲
           ╱  ╲
          ╱ 展示架 ╲
         ╱  A賞 B賞  ╲
        ╱  C賞 D賞    ╲
       ╱────────────────╲
      ╱    🧑 🧑          ╲
     ╱   (排隊中的玩家)      ╲
    ╱                        ╲
   ╱  🧑‍💼 ← 你的角色           ╲
  ╱     「✨ A賞！」← 別人抽到的  ╲
 ╱────────────────────────────────╲
╱          店門口                    ╲
```

### 技術選型

| 平台 | 引擎 | 原因 |
|------|------|------|
| Web | **PixiJS 8 + @pixi/tilemap** | 等距地圖渲染，角色精靈動畫，輕量 |
| Mobile | **Korge** 或 **Compose Canvas** | Kotlin 原生 2D 引擎 |

替代方案：
- **Phaser 3**（更完整的遊戲引擎，但 bundle 更大）
- **Three.js**（真 3D，但過重）
- **Unity WebGL**（最強但 bundle 巨大，不適合嵌入 Web app）

### 核心功能

1. **角色系統**
   - 每個玩家有小角色（頭像 + 暱稱泡泡）
   - 角色可自訂外觀（Phase 3.1 擴展）
   - 進入活動 = 角色走進商店

2. **排隊視覺化**
   - 排隊 = 角色排在櫃台前的隊伍
   - 可以看到前面有幾個人
   - 輪到你 = 角色走到展示架前

3. **抽籤視覺化**
   - 角色走到展示架 → 選一支籤 → 播放開獎動畫
   - 其他人看到角色頭頂飄出結果氣泡「✨ A賞！」
   - 大獎有全場特效（金光、煙火）

4. **社交互動**
   - 聊天泡泡（顯示在角色頭頂）
   - 表情反應（角色做出表情動作）
   - 可點擊其他玩家角色查看資料

### Server 需求（新增）

```kotlin
// 房間狀態同步 — 每個一番賞活動是一個「房間」
data class GameRoom(
    val campaignId: UUID,
    val players: Map<UUID, PlayerPosition>,  // 玩家位置
    val queue: List<UUID>,                    // 排隊順序
    val activeDrawer: UUID?,                  // 正在抽的人
    val spectatorCount: Int,
)

data class PlayerPosition(
    val x: Float, val y: Float,              // 等距座標
    val direction: Direction,                 // 面向
    val state: PlayerState,                   // IDLE, WALKING, QUEUING, DRAWING
)

// WebSocket 事件（新增）
S2C_ROOM_STATE        { players, queue, activeDrawer }     // 進入房間時的完整狀態
S2C_PLAYER_JOINED     { playerId, nickname, position }
S2C_PLAYER_LEFT       { playerId }
S2C_PLAYER_MOVED      { playerId, x, y, direction }
S2C_PLAYER_STATE      { playerId, state }
S2C_DRAW_BUBBLE       { playerId, grade, prizeName }       // 頭頂氣泡
S2C_GLOBAL_EFFECT     { effectType, data }                 // 全場特效（大獎）
```

### 專案結構

```
web/src/game-room/
├── IsometricEngine/
│   ├── IsometricRenderer.ts    # PixiJS 等距渲染器
│   ├── TileMap.ts              # 商店地圖
│   ├── Character.ts            # 角色精靈
│   ├── ChatBubble.ts           # 聊天泡泡
│   └── EffectSystem.ts         # 特效系統
├── GameRoomView.tsx             # React 容器
├── GameRoomWebSocket.ts         # 房間 WebSocket 管理
├── assets/
│   ├── tiles/                  # 地板、牆壁、展示架
│   ├── characters/             # 角色精靈圖
│   └── effects/                # 特效圖
└── types.ts
```

---

## 實作優先順序

```
現在
├── Phase 1.1: 修正撕籤 → 可回復的物理撕紙 ← 立即做
├── Phase 1.2: 觀戰同步（WebSocket 事件 + 延遲揭曉）
├── Phase 1.3: Chat 系統（房間聊天 + 表情反應）
│
下一個 Sprint
├── Phase 2.1: 拉霸機（Web PixiJS + Mobile Compose）
├── Phase 2.2: 夾娃娃機
├── Phase 2.3: 扭蛋機
│
中期
├── Phase 3.1: 等距引擎 + 角色系統（Web）
├── Phase 3.2: 房間同步 + 排隊視覺化
├── Phase 3.3: 社交功能（聊天泡泡、表情）
├── Phase 3.4: Mobile 版本
```

---

## 技術風險與對策

| 風險 | 對策 |
|------|------|
| 觀戰同步延遲導致暴雷 | Server 端 hold 結果，只在 DRAW_REVEALED 時才廣播 |
| 進度同步的網路抖動 | 觀戰端用插值（lerp）平滑 progress，不逐幀同步 |
| Phase 3 的 PixiJS bundle 太大 | 遊戲房間 lazy load，不在首頁載入 |
| Mobile 遊戲效能 | 先用 Compose Canvas，不夠再引入 Korge |
| 夾娃娃操控與結果不符 | 動畫層面巧妙處理「剛好夾到」預決的那顆球 |
| Chat 垃圾訊息 | 頻率限制 + 敏感詞過濾 + 舉報機制 |

---

## 引擎無關架構（Engine-Agnostic Architecture）

### 核心原則

**遊戲資料層完全不依賴渲染引擎。** 換引擎只換最底層的 Renderer 實作，上面的遊戲邏輯、資料模型、同步協議全部不動。

```
┌─────────────────────────────────────────────────────────────┐
│  Game Data Layer（引擎無關，KMP 共用）                        │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │ Map Model    │ │ Character   │ │ Room Sync Protocol  │   │
│  │ - tiles[][]  │ │ - position  │ │ - join/leave        │   │
│  │ - walkable   │ │ - direction │ │ - move              │   │
│  │ - spawn pts  │ │ - state     │ │ - draw start/end    │   │
│  │ - objects    │ │ - animation │ │ - chat              │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Coordinate System                                     │  │
│  │ - IsometricPoint(isoX, isoY) ↔ ScreenPoint(x, y)    │  │
│  │ - tileToIso(), isoToScreen(), screenToTile()          │  │
│  │ - 純數學，不依賴任何渲染 API                            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Animation Timeline                                    │  │
│  │ - frame definitions (JSON/data class)                 │  │
│  │ - state machine transitions                           │  │
│  │ - timing curves                                       │  │
│  │ - 描述性資料，不含任何渲染呼叫                            │  │
│  └───────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Renderer Interface（抽象層）                               │
│                                                             │
│  interface IGameRenderer {                                  │
│      fun initialize(container, assetManifest)               │
│      fun renderFrame(gameState: GameState)                  │
│      fun destroy()                                          │
│  }                                                          │
│                                                             │
│  interface ISpriteLoader {                                   │
│      fun loadSpriteSheet(key, url, frameWidth, frameHeight) │
│      fun getFrame(key, frameIndex): SpriteHandle            │
│  }                                                          │
│                                                             │
│  interface IInputHandler {                                   │
│      val taps: Flow<ScreenPoint>                            │
│      val drags: Flow<DragEvent>                             │
│      fun screenToWorld(point: ScreenPoint): IsometricPoint  │
│  }                                                          │
│                                                             │
│  interface IAudioPlayer {                                    │
│      fun play(soundKey: String)                             │
│      fun stopAll()                                          │
│  }                                                          │
├──────────┬──────────────┬───────────────────────────────────┤
│ PixiJS 8 │ Korge        │ 未來替換候選:                     │
│ Renderer │ Renderer     │ - Phaser 3                       │
│ (Web)    │ (Mobile)     │ - Godot WebGL                    │
│          │              │ - Three.js (真 3D)               │
│          │              │ - Cocos Creator                  │
│          │              │ - 自研 Canvas/WebGL              │
└──────────┴──────────────┴───────────────────────────────────┘
```

### 資料模型定義（引擎無關）

所有遊戲資料用純資料結構定義，不含任何渲染邏輯：

```kotlin
// kmp-game-shared/src/commonMain/kotlin/

// === 地圖 ===
@Serializable
data class GameMap(
    val id: String,
    val width: Int,              // tile 列數
    val height: Int,             // tile 行數
    val tileWidth: Int,          // 像素
    val tileHeight: Int,         // 像素
    val layers: List<MapLayer>,
    val spawnPoints: Map<String, IsometricPoint>,  // "entrance", "counter", "display_A"
    val walkableGrid: List<List<Boolean>>,          // [row][col] = 可行走
)

@Serializable
data class MapLayer(
    val name: String,            // "floor", "walls", "objects", "overlay"
    val tiles: List<List<Int>>,  // tile ID grid, 0 = empty
    val zIndex: Int,
)

// === 座標 ===
@Serializable
data class IsometricPoint(val isoX: Float, val isoY: Float) {
    fun toScreen(tileWidth: Int, tileHeight: Int): ScreenPoint {
        val screenX = (isoX - isoY) * (tileWidth / 2f)
        val screenY = (isoX + isoY) * (tileHeight / 2f)
        return ScreenPoint(screenX, screenY)
    }
}

@Serializable
data class ScreenPoint(val x: Float, val y: Float) {
    fun toIsometric(tileWidth: Int, tileHeight: Int): IsometricPoint {
        val isoX = (x / (tileWidth / 2f) + y / (tileHeight / 2f)) / 2f
        val isoY = (y / (tileHeight / 2f) - x / (tileWidth / 2f)) / 2f
        return IsometricPoint(isoX, isoY)
    }
}

// === 角色 ===
@Serializable
data class GameCharacter(
    val playerId: String,
    val nickname: String,
    val avatarKey: String,       // sprite sheet key
    val position: IsometricPoint,
    val direction: Direction,
    val state: CharacterState,
    val bubbleText: String?,     // 頭頂氣泡
    val bubbleExpiry: Long?,     // 氣泡消失時間 (epoch ms)
)

@Serializable
enum class Direction { NORTH, SOUTH, EAST, WEST }

@Serializable
enum class CharacterState {
    IDLE, WALKING, QUEUING, DRAWING, CELEBRATING
}

// === 動畫定義 ===
@Serializable
data class AnimationDef(
    val key: String,             // "walk_south", "draw_tear", "celebrate"
    val spriteSheetKey: String,
    val frames: List<Int>,       // frame indices in sprite sheet
    val frameDurationMs: Int,
    val loop: Boolean,
)

// === 房間狀態 ===
@Serializable
data class GameRoomState(
    val campaignId: String,
    val mapId: String,
    val characters: Map<String, GameCharacter>,  // playerId → character
    val queueOrder: List<String>,                // playerId 排隊順序
    val activeDrawerId: String?,
    val spectatorCount: Int,
    val effects: List<GameEffect>,               // 全場特效
)

@Serializable
data class GameEffect(
    val type: EffectType,
    val position: IsometricPoint,
    val data: Map<String, String>,               // grade, prizeName, etc.
    val startedAt: Long,
    val durationMs: Int,
)

@Serializable
enum class EffectType { PRIZE_BUBBLE, FIREWORKS, CONFETTI, SPOTLIGHT }
```

### 資產定義（引擎無關）

```kotlin
// 資產清單用 JSON 描述，不綁定引擎格式
@Serializable
data class AssetManifest(
    val spriteSheets: List<SpriteSheetDef>,
    val sounds: List<SoundDef>,
    val tilesets: List<TilesetDef>,
)

@Serializable
data class SpriteSheetDef(
    val key: String,           // "char_default"
    val url: String,           // CDN URL
    val frameWidth: Int,
    val frameHeight: Int,
    val animations: Map<String, AnimationDef>,
)

@Serializable
data class TilesetDef(
    val key: String,
    val url: String,
    val tileWidth: Int,
    val tileHeight: Int,
    val columns: Int,
)

@Serializable
data class SoundDef(
    val key: String,
    val url: String,
)
```

### 專案結構（引擎無關 + 引擎實作分離）

```
kmp-game-shared/                    # 新 KMP 模組（引擎無關）
├── src/commonMain/kotlin/
│   ├── model/                      # GameMap, GameCharacter, GameRoomState
│   ├── coordinate/                 # IsometricPoint, ScreenPoint, 轉換函數
│   ├── state/                      # CharacterStateMachine, RoomStateReducer
│   ├── pathfinding/                # A* 尋路（基於 walkableGrid）
│   ├── protocol/                   # WebSocket 事件 codec（PLAYER_MOVED, etc.）
│   ├── animation/                  # AnimationDef, AnimationTimeline（純資料）
│   └── asset/                      # AssetManifest, SpriteSheetDef
│
├── src/commonTest/kotlin/          # 純邏輯測試（不需要任何引擎）
│   ├── CoordinateTest.kt           # iso ↔ screen 轉換驗證
│   ├── PathfindingTest.kt          # A* 正確性
│   └── StateMachineTest.kt         # 角色狀態轉換

web/src/game-room/
├── engine/
│   ├── IGameRenderer.ts            # 介面定義
│   ├── PixiRenderer.ts             # PixiJS 8 實作（可替換）
│   └── PixiSpriteLoader.ts
├── GameRoomView.tsx                # React 容器（引擎無關）
├── useGameRoom.ts                  # Hook：WebSocket + state management
└── assets/                         # 圖片、音效（CDN 來源定義在 AssetManifest）

mobile/.../game-room/
├── engine/
│   ├── IGameRenderer.kt            # 介面定義（同 web 概念）
│   ├── KorgeRenderer.kt            # Korge 實作（可替換）
│   └── ComposeCanvasRenderer.kt    # 備選：純 Compose Canvas 實作
├── GameRoomScreen.kt               # Compose 容器
└── GameRoomViewModel.kt            # MVI ViewModel（引擎無關）
```

### 換引擎的成本

如果未來要從 PixiJS 換到 Phaser 或 Three.js：

| 要改的 | 不用改的 |
|--------|---------|
| `PixiRenderer.ts` → `PhaserRenderer.ts` | 地圖定義 JSON |
| `PixiSpriteLoader.ts` → `PhaserSpriteLoader.ts` | 角色狀態機 |
| 資產載入方式 | 座標轉換邏輯 |
| | WebSocket 同步協議 |
| | 動畫 timeline 定義 |
| | 尋路演算法 |
| | 房間狀態管理 |
| | Server 端所有程式碼 |
| | 所有測試 |

**預估：換引擎只需重寫 2-3 個 Renderer 檔案（< 500 行），其他 100% 不動。**
