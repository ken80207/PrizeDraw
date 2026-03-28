# Onboarding 引導流程 Spec

## 狀態：骨架已建立，UI 待實作

## 目標

首次登入用戶透過引導流程快速理解核心功能，提高留存率和活躍度。

---

## 涵蓋平台

| 平台 | 方案 | 狀態 |
|------|------|------|
| Mobile (CMP) | HorizontalPager walkthrough + spotlight coach marks | 路由已接，UI 待做 |
| Web (Next.js) | react-shepherd 或 intro.js product tour | 未開始 |

---

## Mobile 實作現況

### 已完成

- `Routes.ONBOARDING = "onboarding"` 路由常數（`NavGraph.kt`）
- `OnboardingScreen.kt` placeholder（`screens/onboarding/`）
- NavGraph 中 `showOnboarding` flag 控制開關（預設 `false`，目前跳過）
- Login / PhoneBinding 的 `onAuthenticated` 已接 onboarding 分流邏輯

### 啟用步驟

1. 將 `showOnboarding` 改為從 DataStore 讀取（首次登入 = `true`，完成後寫入 `false`）
2. 在 `OnboardingScreen` 實作 `HorizontalPager` UI

---

## 規劃的引導類型

### 1. Onboarding Walkthrough（首次登入）

首次進入 app 的 3–4 頁滑動介紹：

```
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│                     │   │                     │   │                     │
│   [插圖/Lottie]     │   │   [插圖/Lottie]     │   │   [插圖/Lottie]     │
│                     │   │                     │   │                     │
│  「一番賞線上抽」    │   │  「即時觀戰」        │   │  「賞品交易市集」    │
│                     │   │                     │   │                     │
│  探索限定商品，      │   │  看別人抽到什麼，    │   │  不想要的賞品？      │
│  線上直接抽獎！      │   │  感受現場氣氛！      │   │  上架交易或交換！    │
│                     │   │                     │   │                     │
│     ○ ● ○           │   │     ○ ○ ●           │   │     ○ ○ ●           │
│                     │   │                     │   │                     │
│  [跳過]   [下一步]   │   │  [跳過]   [下一步]   │   │       [開始使用]     │
└─────────────────────┘   └─────────────────────┘   └─────────────────────┘
```

**頁面內容建議：**

| 頁 | 主題 | 說明 |
|----|------|------|
| 1 | 抽獎 | 介紹一番賞概念、線上抽獎流程 |
| 2 | 觀戰 | 即時觀看他人抽獎、聊天互動 |
| 3 | 交易 | 賞品上架交易、交換 |
| 4 (optional) | 錢包 | 儲值點數、提領收益 |

**技術方案：**
- Compose `HorizontalPager` (Compose Foundation)
- 每頁一個 `@Composable`，支援 Lottie 動畫或靜態圖
- `PageIndicator` 底部圓點
- 跳過按鈕 → 直接 navigate to HOME
- 最後一頁「開始使用」→ 標記完成 + navigate to HOME

### 2. Spotlight / Coach Marks（功能發現）

進入 HOME 後，針對關鍵 UI 元素的高亮提示：

```
┌─────────────────────────────────────┐
│  ┌──────────────────────────────┐   │
│  │  活動  賞品  市集  錢包      │   │
│  └──────┬───────────────────────┘   │
│         │                           │
│    ┌────▼────────────────┐          │
│    │ 點這裡瀏覽           │          │
│    │ 正在進行的活動！     │          │
│    └─────────────────────┘          │
│                                     │
│  (半透明黑色遮罩覆蓋其餘區域)       │
│                                     │
└─────────────────────────────────────┘
```

**技術方案：**
- 自製 Compose overlay：半透明 `Canvas` + `onGloballyPositioned` 取目標座標
- 或用 `Popup` + clip path 挖洞
- 步驟序列由 `CoachMarkController` 管理
- 用 DataStore 記錄已完成的 coach mark 組

**優先指引項目：**
1. 底部 Tab 導航（活動 / 賞品 / 市集 / 錢包）
2. 活動卡片 → 點擊進入抽獎
3. 抽獎板面上的「抽」按鈕

### 3. Empty State（空狀態引導）

無資料時顯示友善提示而非空白頁面：

| 頁面 | 空狀態文案 | CTA |
|------|-----------|-----|
| 我的賞品 | 還沒有賞品，去試試手氣！ | → 前往活動列表 |
| 錢包 | 儲值點數開始你的抽獎之旅 | → 前往儲值 |
| 交易市集 | 目前沒有上架商品 | → 上架我的賞品 |
| 支援工單 | 沒有工單記錄，有問題歡迎聯繫 | → 建立工單 |

---

## Web 規劃

| 類型 | 方案 | 說明 |
|------|------|------|
| Product tour | `react-shepherd` | 首次登入時引導瀏覽主要區塊 |
| Tooltip 引導 | 內建或 `intro.js` | 輕量級功能提示 |
| Empty state | 各頁面自行處理 | 同 Mobile 邏輯 |

---

## 實作優先順序

| 優先級 | 項目 | 原因 |
|--------|------|------|
| P0 | Empty state UX | 最低成本最高回報，新用戶第一眼看到 |
| P1 | Onboarding walkthrough (Mobile) | 首次開 app 的品牌印象 |
| P2 | Coach marks (Mobile) | 等核心功能穩定後再加 |
| P3 | Product tour (Web) | Web 端用戶較能自行探索 |

---

## Mobile 檔案結構（預期）

```
screens/onboarding/
├── OnboardingScreen.kt          ← 已建立 (placeholder)
├── OnboardingPage.kt            ← 單頁 composable (待建)
├── OnboardingPageIndicator.kt   ← 底部圓點 (待建)
└── CoachMarkOverlay.kt          ← spotlight 遮罩 (待建)
```

---

## 相關檔案

- `mobile/composeApp/.../navigation/NavGraph.kt` — `Routes.ONBOARDING`, `showOnboarding` flag
- `mobile/composeApp/.../screens/onboarding/OnboardingScreen.kt` — placeholder
