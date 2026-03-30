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
