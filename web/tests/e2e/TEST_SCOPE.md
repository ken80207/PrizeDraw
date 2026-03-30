# E2E Test Scope — PrizeDraw

> 每次跑 E2E 前會自動清空 DB 並重建 seed data，確保測試間互不影響。

## 測試前置條件

- Docker: prizedraw-postgres + prizedraw-redis 需要 running
- Backend: Core API (:9092), Draw Service (:9093), Realtime Gateway (:9094)
- Frontend: Web (:3003), Admin (:3001)
- 環境變數: `JWT_SECRET`, `DEV_BYPASS_AUTH=true`

## 資料隔離

每次 `pnpm exec playwright test` 執行時：
1. `global-setup.ts` 先 TRUNCATE 所有 DB 表（保留 schema）
2. 重新 seed 測試資料（3 players, 1 admin, 1 staff, campaigns, coupons）
3. 寫入 env vars 供 tests 使用

跳過清除：`SKIP_CLEANUP=true`
跳過 seed：`SKIP_SEED=true`

## Journey Tests

### 基礎流程 (01-29, 既有)

| # | 名稱 | 驗證項目 |
|---|------|---------|
| 01 | Auth | OAuth 註冊、手機綁定、登出 |
| 02 | Top-up | 錢包儲值、餘額顯示 |
| 03 | Browse Campaigns | 活動瀏覽、篩選 |
| 04 | Kuji Draw | 一番賞抽獎流程 |
| 05 | Spectator | 觀戰模式 |
| 06 | Unlimited Draw | 無限賞抽獎 |
| 07 | Prize Management | 賞品庫存管理 |
| 08 | Exchange | 賞品交換 |
| 09 | Buyback | 賞品回收 |
| 10 | Shipping | 出貨地址、物流追蹤 |
| 11 | Coupon | 折扣碼 |
| 12 | Support | 客服工單 |
| 13 | Withdrawal | 點數提領 |
| 14 | Admin Campaign | Admin 活動 CRUD |
| 15 | Leaderboard | 排行榜 |
| 16 | Settings | 帳號設定 |
| 17 | Mobile Responsive | 手機排版 |
| 18 | Error States | 錯誤處理 |
| 19 | Concurrent | 併發抽獎壓力測試 |
| 20 | Admin Player Sync | Admin 玩家資料同步 |
| 28 | Favorites | 收藏活動 |
| 29 | Favorite Notifications | 收藏通知 |

### 新增流程 (30-35)

| # | 名稱 | 驗證項目 | 涉及角色 |
|---|------|---------|---------|
| **30** | **Admin 建立所有類型活動** | Admin 建立一番賞 + 無限賞 → 發布 → Player 前端看到 | Admin, Player |
| **31** | **玩家遊玩活動** | Player 看到活動 → 加入排隊 → 抽獎成功 → 點數扣除 | Player |
| **32** | **多人排隊** | 2 個 Player 同時排隊 → 位置不同 → 輪流抽獎 | Player A, Player B |
| **33** | **Admin 停售活動** | Admin 停售 → Player 列表消失 → 直接 URL 看到停售狀態 | Admin, Player |
| **34** | **活動完售** | 3 張票全部抽完 → Player 看到售罄 → Admin 看到售罄 → 其他 Player 無法抽 | Player A, Player B, Admin |
| **35** | **角色權限側邊欄** | CS 看 4 項 / Operator 看 10 項 / Admin 看 17 項 / CS 無法訪問 /staff | CS, Operator, Admin |

## 詳細驗證清單

### 30 — Admin 建立所有類型活動
- [ ] Admin 建立一番賞（含 A/B/C 賞品、票券）
- [ ] Admin 建立無限賞（含機率表 SSR/SR/R）
- [ ] Admin 發布兩個活動（DRAFT → ACTIVE）
- [ ] Player 登入前端，活動列表顯示兩個新活動

### 31 — 玩家遊玩活動
- [ ] Player 看到活動列表，點進一番賞
- [ ] Player 加入排隊，看到排隊位置
- [ ] 輪到後點選票券，抽獎成功看到獎品
- [ ] Player 進入無限賞，單抽成功
- [ ] 抽獎後點數餘額正確扣除

### 32 — 多人排隊
- [ ] Player A 和 Player B 加入同一場排隊
- [ ] 兩人顯示不同排隊位置
- [ ] Player A 抽獎時 Player B 仍在等待
- [ ] Player A 完成後 Player B 輪到
- [ ] Player B 成功抽獎

### 33 — Admin 停售活動
- [ ] Admin 在活動詳情頁看到停售按鈕
- [ ] 點擊停售後狀態變為「已停售」
- [ ] Player 活動列表不再顯示該活動
- [ ] Player 直接 URL 訪問看到停售狀態、按鈕 disabled

### 34 — 活動完售
- [ ] 建立只有 3 張票的小型活動
- [ ] Player A 連續抽完 3 張票
- [ ] 畫面顯示「已售罄」
- [ ] Admin 後台看到已售罄狀態
- [ ] Player B 無法再進入抽獎（按鈕 disabled 或錯誤提示）

### 35 — 角色權限側邊欄
- [ ] 客服 (CUSTOMER_SERVICE): 只看到 總覽/出貨/玩家/排行榜 (4 項)
- [ ] 營運員工 (OPERATOR): 看到 10 項（不含提領/金流/人員/稽核/Flags/設定）
- [ ] 管理員 (ADMIN): 看到全部 17 項
- [ ] 客服直接訪問 /staff 被阻擋

## Browser QA Smoke Tests (gstack /qa)

每次 `/qa` 跑的 headless browser 測試項目。這些是即時驗證，不是 Playwright tests。

### Web Player (localhost:3003)

| 頁面 | 驗證項目 | 預期結果 |
|------|---------|---------|
| `/login` | Mock login 按鈕（玩家小明/小花/小王） | 點擊後導航到首頁，sidebar 顯示用戶名 |
| `/` (首頁) | Banner carousel + 一番賞/無限賞卡片 | 顯示真實活動資料（來自 API） |
| `/leaderboard` | 排行榜 tab 切換 + 排名資料 | 顯示玩家排名（抽獎達人/幸運之星/交易風雲） |
| `/trade` | 市集列表 + 篩選 | 顯示空狀態或商品列表（無 error） |
| `/prizes` | 賞品庫存 + filter tabs | 顯示空狀態或賞品（i18n 正確） |
| `/wallet` | 錢包餘額 + 交易紀錄 | 顯示真實點數餘額和交易歷史 |
| `/settings` | 帳號設定 | 頁面載入無 error |
| `/campaigns/{id}` | 一番賞活動頁 | 票券板 + 排隊按鈕 |
| `/campaigns/unlimited/{id}` | 無限賞活動頁 | 機率表 + 抽獎按鈕 + 聊天室 |
| WebSocket `/ws/feed` | 即時連線 | ws://localhost:3003/ws/feed 成功連線 |
| WebSocket `/ws/kuji/{id}` | 即時連線 | ws://localhost:3003/ws/kuji/{id} 成功連線 |
| Auth 持久性 | 登入後跨頁導航 | 所有頁面保持登入狀態（不被重導到 /login） |
| Console errors | 頁面載入無 JS error | 0 個 500/404 console errors |

### Admin Dashboard (localhost:3001)

| 頁面 | 驗證項目 | 預期結果 |
|------|---------|---------|
| `/login` | 3 種角色 dev login | Admin/Employee/Support 按鈕各自登入成功 |
| `/dashboard` | 總覽 stats | 今日營收、活躍玩家、進行中活動、待辦事項 |
| `/campaigns` | 活動列表 + 建立 | 顯示真實活動，有建立一番賞/無限賞按鈕 |
| `/campaigns/create` | 建立活動表單 | 填寫表單 → 儲存草稿/發布 → 前端可見 |
| `/grade-templates` | 等級模板 | 頁面載入無 error |
| `/shipping` | 出貨管理 | 頁面載入無 error |
| `/withdrawals` | 提領審核 | 頁面載入無 error |
| `/players` | 玩家管理 | 顯示 3 名玩家真實資料 |
| `/trade` | 交易監控 | 頁面載入無 error |
| `/prizes` | 賞品管理 | 頁面載入無 error |
| `/coupons` | 優惠券 | 頁面載入無 error |
| `/leaderboard` | 排行榜 | 頁面載入無 error |
| `/banners` | 輪播橫幅 | 頁面載入無 error |
| `/payments` | 金流紀錄 | 空狀態或付款紀錄列表 |
| `/staff` | 人員管理 | 頁面載入無 error |
| `/audit` | 稽核紀錄 | 顯示操作 log（含篩選） |
| `/announcements` | 公告管理 | 頁面載入無 error |
| `/feature-flags` | Feature Flags | 10 個 flags 可切換 |
| `/settings` | 系統設定 | key-value 設定表 |

### 角色權限矩陣

| 頁面 | CS (客服) | Operator (營運) | Admin (管理員) |
|------|-----------|----------------|---------------|
| 總覽 | ✅ | ✅ | ✅ |
| 活動管理 | ❌ | ✅ | ✅ |
| 等級模板 | ❌ | ✅ | ✅ |
| 出貨管理 | ✅ | ✅ | ✅ |
| 提領審核 | ❌ | ❌ | ✅ |
| 玩家管理 | ✅ | ✅ | ✅ |
| 交易監控 | ❌ | ✅ | ✅ |
| 賞品管理 | ❌ | ✅ | ✅ |
| 優惠券 | ❌ | ✅ | ✅ |
| 排行榜 | ✅ | ✅ | ✅ |
| 輪播橫幅 | ❌ | ✅ | ✅ |
| 金流紀錄 | ❌ | ❌ | ✅ |
| 人員管理 | ❌ | ❌ | ✅ |
| 稽核紀錄 | ❌ | ❌ | ✅ |
| 公告管理 | ❌ | ✅ | ✅ |
| Feature Flags | ❌ | ❌ | ✅ |
| 系統設定 | ❌ | ❌ | ✅ |

> Sidebar links: CS=4, Operator=10+1(公告), Admin=17

### E2E 活動生命週期驗證

| 步驟 | 操作 | 驗證 |
|------|------|------|
| 1 | Admin 建立一番賞活動 (API) | 回傳 campaign ID |
| 2 | Admin 上架活動 (PATCH status→ACTIVE) | DB status = ACTIVE |
| 3 | Player 前端首頁 | 新活動出現在活動列表 |
| 4 | Admin 建立無限賞活動 | 同上 |
| 5 | Admin 停售活動 (PATCH status→SUSPENDED) | Player 列表消失 |
| 6 | 完售：3 張票抽完 | Player 看到售罄，Admin 看到 SOLD_OUT |

## 執行方式

```bash
# 完整 E2E（含 cleanup + seed + 所有 tests）
cd web && pnpm exec playwright test

# 只跑新增的 journeys
pnpm exec playwright test tests/e2e/journeys/30 tests/e2e/journeys/31 tests/e2e/journeys/32 tests/e2e/journeys/33 tests/e2e/journeys/34 tests/e2e/journeys/35

# 只跑單一 journey
pnpm exec playwright test tests/e2e/journeys/35-role-based

# 跳過 cleanup（開發時使用）
SKIP_CLEANUP=true pnpm exec playwright test

# 跳過 seed（使用現有資料）
SKIP_SEED=true pnpm exec playwright test
```
