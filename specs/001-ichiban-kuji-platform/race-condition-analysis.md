# Race Condition Analysis — PrizeDraw Platform

**Date:** 2026-03-25
**Scope:** All financial and prize-state operations
**Classification:** Critical — this platform handles real money (revenue points withdrawable as TWD)

---

## 1. Executive Summary

The PrizeDraw backend uses a layered defense strategy against race conditions:

1. **Optimistic locking** on `Player.version` for all balance mutations (`updateBalance` returns `false` on version conflict, triggering retry loops of 3–5 attempts with exponential backoff via `PointsLedgerService`).
2. **Redis distributed locks** (SET NX EX pattern, compare-and-delete Lua unlock) for multi-step operations requiring serialised access: trade purchases (`trade:{listingId}`) and queue mutations (`queue:{boxId}`).
3. **Expected-state guards** on `PrizeInstance.state` (`updateInstanceState(id, newState, expectedState)` performs a conditional UPDATE in Postgres, returning `false` if the current state differs).
4. **DB transaction boundaries** via Exposed's `newSuspendedTransaction` wrapping all multi-step write sequences atomically.
5. **PAID status guard** in payment webhook processing prevents double-crediting on duplicate delivery.

---

## 2. Risk Analysis by Component

### 2.1 DrawKujiUseCase

**File:** `server/src/main/kotlin/com/prizedraw/application/usecases/draw/DrawKujiUseCase.kt`

| # | Race Condition | Current Protection | Risk Level |
|---|----------------|-------------------|------------|
| A | Two players draw the same ticket simultaneously | Queue session validation: `queue.activePlayerId != playerId` checked before entering the DB transaction. Only the session holder can draw. | **LOW** — Queue enforces single-holder access. |
| B | Multi-draw quantity exceeds remaining tickets | `KujiDrawDomainService.validateMultiDraw(box, quantity)` checks `quantity <= box.remainingTickets` before the transaction. TOCTOU window exists between this check and the `markDrawn` calls inside the transaction. | **MEDIUM** — A concurrent draw by the same session holder (e.g. duplicate request) could slip through. Mitigated by session serialisation. |
| C | SOLD_OUT cascade is not atomic | `handleBoxSoldOut` and `checkCampaignSoldOut` are inside `newSuspendedTransaction`, so box SOLD_OUT and campaign SOLD_OUT are committed atomically. | **LOW** — Wrapped in single transaction. |
| D | Optimistic lock fails exhausting MAX_BALANCE_RETRIES (3) | Retry loop with up to 3 attempts; throws an error on exhaustion. Under extreme contention (3+ concurrent draws per player) a legitimate draw can fail. | **MEDIUM** — Increase MAX_BALANCE_RETRIES to 5 (matches PointsLedgerService) to reduce starvation. |
| E | Prize instance created before balance debit in same transaction | `saveInstance` is called before `debitBalanceWithRetry` inside the transaction. If debit fails after MAX_RETRIES, the transaction rolls back, which correctly removes the prize instance. Postgres transaction rollback handles cleanup. | **LOW** — Transaction rollback is the safety net. |

**Test coverage:** `DrawConcurrencyTest`

---

### 2.2 DrawUnlimitedUseCase

**File:** `server/src/main/kotlin/com/prizedraw/application/usecases/draw/DrawUnlimitedUseCase.kt`

| # | Race Condition | Current Protection | Risk Level |
|---|----------------|-------------------|------------|
| A | Burst draws exceeding rate limit | Redis sliding-window ZSET (`unlimited:ratelimit:{playerId}:{campaignId}`). However, the check-then-add sequence (`zcard` then `zadd`) is NOT atomic. Two goroutines can both see `count < limit` before either adds their entry. | **HIGH — GAP** — Race window between `zcard` and `zadd`. Must be fixed with a Lua script or Redis transaction. |
| B | Concurrent balance debit going negative | `debitBalanceWithRetry` with optimistic lock, 3 retries. Same protection as Kuji draw. | **LOW** — Optimistic lock guards the balance. |
| C | Prize created before balance check | Same as Kuji 2.1.E — transaction rollback covers it. | **LOW** |

**Critical finding (2.2.A):** The `enforceRateLimit` method in `DrawUnlimitedUseCase` reads the ZSET count with `zcard`, then conditionally adds with `zadd` in two separate Redis commands inside a single `withConnection` block. This is **not atomic**. Two concurrent coroutines can both read `count = 0 < limit`, both proceed past the guard, and both add entries — effectively bypassing the rate limit.

**Recommendation:** Replace the check-add sequence with a Lua script:
```lua
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local windowStart = tonumber(ARGV[2])
local nowScore = tonumber(ARGV[3])
local member = ARGV[4]
local ttl = tonumber(ARGV[5])

redis.call("ZREMRANGEBYSCORE", key, "-inf", windowStart - 1)
local count = redis.call("ZCARD", key)
if count >= limit then return count end
redis.call("ZADD", key, nowScore, member)
redis.call("EXPIRE", key, ttl)
return count
```

**Test coverage:** `DrawConcurrencyTest` — "rate limit prevents burst draws"

---

### 2.3 PurchaseTradeListingUseCase

**File:** `server/src/main/kotlin/com/prizedraw/application/usecases/trade/PurchaseTradeListingUseCase.kt`

| # | Race Condition | Current Protection | Risk Level |
|---|----------------|-------------------|------------|
| A | Two buyers purchasing the same listing simultaneously | `DistributedLock.withLock("trade:{listingId}")` serialises all purchase attempts. The second caller receives `null` from `withLock` and gets `ListingNotAvailableException`. | **LOW** — Redis NX lock is the primary guard. |
| B | Re-check listing status inside the lock | `executeAtomicPurchase` re-reads and validates `listing.status == LISTED` inside `newSuspendedTransaction` after acquiring the lock. | **LOW** — Double-checked inside the lock. |
| C | Buyer balance drained by concurrent operation | `debitBuyerWithRetry` re-reads buyer's balance inside the transaction. If drained to zero by a concurrent draw, `InsufficientDrawPointsException` is thrown before any money moves. | **LOW** — Balance re-validated inside the transaction. |
| D | Seller credit fails after buyer debit succeeds | Both debit and credit are inside `newSuspendedTransaction`. If the seller credit fails, the transaction rolls back, restoring the buyer's balance. | **LOW** — Single transaction guarantees atomicity. |

**Test coverage:** `TradeConcurrencyTest`

---

### 2.4 RespondExchangeRequestUseCase

**File:** `server/src/main/kotlin/com/prizedraw/application/usecases/exchange/RespondExchangeRequestUseCase.kt`

| # | Race Condition | Current Protection | Risk Level |
|---|----------------|-------------------|------------|
| A | Accepting an exchange that was concurrently cancelled | Status checked at line 53: `request.status != PENDING && request.status != COUNTER_PROPOSED` throws `ExchangeNotPendingException`. | **LOW** — Status check is inside the transaction. |
| B | Recipient's prize sold between request and accept | `transferOwnership` is called without a guard on the prize's current state. If the prize was sold (state = SOLD), the transfer succeeds against a ghost prize, creating an invalid ownership record. | **HIGH — GAP** — `transferOwnership` has no expected-state guard. Should call `updateInstanceState(prizeId, HOLDING, EXCHANGING)` first to verify state. |
| C | Concurrent counter-propose on same request | Status guard at line 53 catches this if the request was already responded to. | **LOW** |
| D | Both parties accept simultaneously (if COUNTER_PROPOSED) | Status guard prevents double-acceptance. Only the designated recipient can respond. | **LOW** |

**Critical finding (2.4.B):** `handleAccept` calls `prizeRepository.transferOwnership(item.prizeInstanceId, request.recipientId, PrizeState.HOLDING)` for recipient prizes without first verifying the prize is in a state that allows transfer. A prize that was RECYCLED, SOLD, or PENDING_SHIPMENT between the exchange request creation and the accept will be silently transferred. The fix is to add a state guard:

```kotlin
// In handleAccept, before transferring recipient's prize:
recipientItems.forEach { item ->
    val instance = prizeRepository.findInstanceById(item.prizeInstanceId)
        ?: throw PrizeNotAvailableForExchangeException("Recipient prize ${item.prizeInstanceId} not found")
    if (instance.state == PrizeState.SOLD || instance.state == PrizeState.RECYCLED) {
        // Restore initiator prizes and fail
        initiatorItems.forEach { iItem ->
            prizeRepository.updateInstanceState(iItem.prizeInstanceId, PrizeState.HOLDING, PrizeState.EXCHANGING)
        }
        throw ExchangeInvalidStateException("Recipient prize ${item.prizeInstanceId} is no longer available")
    }
}
```

**Test coverage:** `ExchangeConcurrencyTest`

---

### 2.5 ConfirmPaymentWebhookUseCase

**File:** `server/src/main/kotlin/com/prizedraw/application/usecases/payment/ConfirmPaymentWebhookUseCase.kt`

| # | Race Condition | Current Protection | Risk Level |
|---|----------------|-------------------|------------|
| A | Duplicate webhook double-credits points | Status guard: `if (order.status == PaymentOrderStatus.PAID) return` before any credit. | **MEDIUM** — Guard is inside the transaction but the `findByGatewayTransactionId` + `save(PAID)` are two separate operations. A TOCTOU window exists between the status check and the `markOrderAsPaid` save. |
| B | Concurrent webhooks for same order | Both find `status=PENDING`, both pass the guard, both attempt credit. `creditPlayerBalance` uses `updateBalance` with optimistic lock — the second call fails (version mismatch) and throws `IllegalStateException`. This aborts the second transaction and rolls back the second `markOrderAsPaid`. | **LOW** — Optimistic lock on player version prevents double-credit, but `markOrderAsPaid` may have been called twice. |
| C | Missing gatewayTransactionId in webhook | Null check with early return at line 63. | **LOW** |

**Finding (2.5.A):** The protection is sufficient in practice because: (1) the gateway typically sends only one webhook, (2) the optimistic lock prevents double-balance update, and (3) `markOrderAsPaid` is idempotent (setting PAID twice is benign). However, to make it bullet-proof, use a DB unique constraint on `gatewayTransactionId` and an upsert with `INSERT ... ON CONFLICT DO NOTHING`.

**Test coverage:** `PaymentIdempotencyTest`

---

### 2.6 CreateWithdrawalRequestUseCase

**File:** `server/src/main/kotlin/com/prizedraw/application/usecases/withdrawal/CreateWithdrawalRequestUseCase.kt`

| # | Race Condition | Current Protection | Risk Level |
|---|----------------|-------------------|------------|
| A | Two concurrent withdrawals draining balance below zero | Balance check at line 47 (`player.revenuePointsBalance < request.pointsAmount`) is inside `newSuspendedTransaction`. However, `PointsLedgerService.debitRevenuePoints` is called AFTER the initial balance check, and it performs its own balance re-check with optimistic locking. | **LOW** — Double-checked: once in the use case and once in `PointsLedgerService`. The inner check with optimistic lock is the atomic guard. |
| B | PENDING withdrawal counted against balance for second request | There is NO check for existing PENDING withdrawals. A player with 300 revenue points can submit two 300-point withdrawals — the first debits the balance to 0, the second fails with `InsufficientBalanceException`. This is correct because the debit is immediate. | **LOW** — Immediate debit pattern means no double-spend window. |

**Test coverage:** `FinancialIntegrityTest`, `BalanceConcurrencyTest`

---

### 2.7 BuybackUseCase

**File:** `server/src/main/kotlin/com/prizedraw/application/usecases/buyback/BuybackUseCase.kt`

| # | Race Condition | Current Protection | Risk Level |
|---|----------------|-------------------|------------|
| A | Concurrent buyback and trade on same prize | `updateInstanceState(prizeId, RECYCLED, HOLDING)` is the expected-state guard. If a concurrent trade listing already transitioned the prize to TRADING, this returns `false`. However, `BuybackUseCase` does NOT check the return value of `updateInstanceState`. | **HIGH — GAP** — The return value of `updateInstanceState` is ignored. If the update fails (returns `false`), the buyback proceeds with an inconsistent state: `BuybackRecord` is saved and revenue points are credited, but the prize state was not actually changed. |

**Critical finding (2.7.A):** Line 81:
```kotlin
prizeRepository.updateInstanceState(prizeInstanceId, PrizeState.RECYCLED, PrizeState.HOLDING)
```
The `Boolean` return value is discarded. The fix:
```kotlin
val transitioned = prizeRepository.updateInstanceState(prizeInstanceId, PrizeState.RECYCLED, PrizeState.HOLDING)
if (!transitioned) {
    throw PrizeNotAvailableForBuybackException(
        "Prize $prizeInstanceId was modified by a concurrent operation and cannot be recycled"
    )
}
```

**Test coverage:** `PrizeStateMutexTest`

---

### 2.8 CreateShippingOrderUseCase

**File:** `server/src/main/kotlin/com/prizedraw/application/usecases/shipping/CreateShippingOrderUseCase.kt`

| # | Race Condition | Current Protection | Risk Level |
|---|----------------|-------------------|------------|
| A | Concurrent trade listing and shipping on same prize | `updateInstanceState(instanceId, PENDING_SHIPMENT, HOLDING)` expected-state guard. However, the return value is NOT checked — same issue as BuybackUseCase. | **HIGH — GAP** — Same as 2.7.A: `Boolean` return value ignored. |

**Critical finding (2.8.A):** Line 68:
```kotlin
prizeRepository.updateInstanceState(instanceId, PrizeState.PENDING_SHIPMENT, PrizeState.HOLDING)
```
Fix:
```kotlin
val transitioned = prizeRepository.updateInstanceState(instanceId, PrizeState.PENDING_SHIPMENT, PrizeState.HOLDING)
if (!transitioned) {
    throw PrizeNotHoldingException(
        "Prize $instanceId was claimed by a concurrent operation"
    )
}
```

**Test coverage:** `PrizeStateMutexTest`

---

### 2.9 KujiQueueService

**File:** `server/src/main/kotlin/com/prizedraw/application/services/KujiQueueService.kt`

| # | Race Condition | Current Protection | Risk Level |
|---|----------------|-------------------|------------|
| A | Two players joining idle queue simultaneously | `distributedLock.withLock("queue:{boxId}")` serialises all queue mutations. | **LOW** — Lock is the primary guard. |
| B | Session expiry and manual leave advancing queue twice | `expireSession` first marks the entry EVICTED inside the lock, then calls `advanceQueue`. `advanceQueue` also acquires the lock. `expireSession` checks `entry.isTerminal()` before marking EVICTED — so if manual leave already set status to COMPLETED, the expiry is a no-op. | **LOW** — Terminal check prevents double-advance. |
| C | `switchBox` is not a single atomic operation | `switchBox` calls `leaveQueue` then `joinQueue` sequentially, each with their own lock. Between these two calls, the player is in neither queue. A crash during this window leaves the player in no queue (requires session timeout cleanup). | **LOW** — Acceptable brief inconsistency; session timeout recovers it. |
| D | `scheduleExpiry` coroutine not tracked — no cancellation | The `scope.launch` in `scheduleExpiry` fires a coroutine that is not tracked. If the session ends early (manual leave), the expiry coroutine still fires after `delay(sessionSeconds.seconds)`. The `isTerminal()` check handles it, but the coroutine leak itself is a resource concern under load. | **LOW** — Functional correctness maintained; resource leak under scale worth addressing. |

**Test coverage:** `QueueConcurrencyTest`

---

### 2.10 PointsLedgerService

**File:** `server/src/main/kotlin/com/prizedraw/application/services/PointsLedgerService.kt`

| # | Race Condition | Current Protection | Risk Level |
|---|----------------|-------------------|------------|
| A | Concurrent debits driving balance negative | Optimistic lock on `Player.version` with 5 retries and exponential backoff (20ms base). Balance re-read on each retry detects depletion. | **LOW** — Well-protected. |
| B | Credit operation does not guard minimum balance | Credit operations do not check for a maximum balance — no overflow protection. At `Int.MAX_VALUE` the balance would wrap. | **VERY LOW** — Theoretical; no realistic path to 2.1B points. |
| C | `retryBalance` exhaustion under extreme contention | After 5 failed attempts the service throws `error(...)`. Callers do not catch this and their DB transaction rolls back. | **LOW** — Correct fail-safe behaviour. |

**Test coverage:** `BalanceConcurrencyTest`

---

### 2.11 TokenService — Refresh Token Replay

**File:** `server/src/main/kotlin/com/prizedraw/application/services/TokenService.kt`

| # | Race Condition | Current Protection | Risk Level |
|---|----------------|-------------------|------------|
| A | Token replay (stolen refresh token reused) | SHA-256 hash stored in `RefreshTokenFamily.currentTokenHash`. On rotation, if `presentedHash != family.currentTokenHash`, the entire family is revoked. | **LOW** — Standard refresh token rotation with theft detection. |
| B | Concurrent rotations with the same refresh token | Two parallel requests with the same refresh token: first updates `currentTokenHash`, second finds `presentedHash != currentTokenHash` and revokes the family. The second caller gets `TokenReplayException` and the family is revoked — forcing re-login. | **LOW** — Aggressive but correct: simultaneous refresh is treated as a replay attack. |
| C | `findByFamilyToken` then `save` is not atomic | Read-modify-write on `RefreshTokenFamily` is not guarded by an optimistic lock. Two concurrent rotations can both read the same `currentTokenHash`, both compute a new hash, and one overwrites the other's `save`. The overwritten rotation produces a valid-looking token that is immediately invalid. | **MEDIUM** — Add a version column to `RefreshTokenFamily` and use optimistic locking, or use a DB `UPDATE ... WHERE currentTokenHash = ?` statement instead of read-then-save. |

---

### 2.12 PlayerRepositoryImpl — Optimistic Locking

**File:** `server/src/main/kotlin/com/prizedraw/infrastructure/persistence/repositories/PlayerRepositoryImpl.kt`

| # | Race Condition | Current Protection | Risk Level |
|---|----------------|-------------------|------------|
| A | Version-gated UPDATE | `UPDATE players SET ... WHERE id = ? AND version = ?` returns row count; 0 means conflict. | **LOW** — Correct implementation. |
| B | `save()` does not use optimistic lock | The general `save()` method performs an unconditioned UPDATE (no version check). Callers that use `save()` for balance updates (instead of `updateBalance`) bypass the optimistic lock. | **MEDIUM — AUDIT** — All balance modifications must go through `updateBalance`. Audit all `playerRepository.save()` call sites to confirm none modify balance fields. |
| C | `save()` upsert does not increment version | On UPDATE, the version field is set to `player.version` (whatever the caller holds), not `version + 1`. A caller that reads the player, modifies non-balance fields, and saves can silently revert a concurrent balance update if the reader's snapshot was stale. | **MEDIUM** — For consistency, all save operations should increment the version. |

---

## 3. Test Coverage Matrix

| Component | Test File | Scenarios Covered |
|-----------|-----------|-------------------|
| DrawKujiUseCase | `DrawConcurrencyTest` | Session holder exclusion, multi-draw quantity bound, SOLD_OUT cascade atomicity |
| DrawUnlimitedUseCase | `DrawConcurrencyTest` | Rate limit enforcement, window reset recovery |
| UnlimitedDrawDomainService | `DrawConcurrencyTest` | Fair distribution over large sample, zero-probability invariant |
| PurchaseTradeListingUseCase | `TradeConcurrencyTest` | Lock serialisation, re-check inside lock, balance depletion, self-purchase guard |
| PointsLedgerService | `BalanceConcurrencyTest` | Non-negative balance under concurrency, retry convergence, wallet type separation |
| ConfirmPaymentWebhookUseCase | `PaymentIdempotencyTest` | Sequential duplicate, concurrent duplicate, already-PAID guard, invalid signature |
| RespondExchangeRequestUseCase | `ExchangeConcurrencyTest` | Non-pending rejection, transfer atomicity, reject restores prizes, unauthorised responder |
| BuybackUseCase | `PrizeStateMutexTest` | HOLDING→RECYCLED transition, TRADING state rejection |
| CreateShippingOrderUseCase | `PrizeStateMutexTest` | HOLDING→PENDING_SHIPMENT transition, mutual exclusion, expected-state guard |
| KujiQueueService | `QueueConcurrencyTest` | Duplicate join rejection, idle activation, idempotent expiry, switchBox ordering |
| CreateWithdrawalRequestUseCase | `FinancialIntegrityTest` | Ledger accuracy, insufficient balance rejection, concurrent withdrawals |

---

## 4. Critical Gaps Requiring Immediate Fixes

### GAP-001 (CRITICAL): `updateInstanceState` return value ignored in BuybackUseCase and CreateShippingOrderUseCase

**Files:**
- `BuybackUseCase.kt` line 81
- `CreateShippingOrderUseCase.kt` line 68

**Impact:** A prize could be simultaneously recycled/shipped AND traded. The `BuybackRecord` and `ShippingOrder` would be created with revenue points credited/shipping initiated, but the prize state would remain in whatever state the concurrent trade listing set it to. This is a direct financial integrity failure.

**Fix:** Check the `Boolean` return of `updateInstanceState` and throw if it returns `false`.

---

### GAP-002 (HIGH): Redis rate limit check-then-add is not atomic in DrawUnlimitedUseCase

**File:** `DrawUnlimitedUseCase.kt` lines 176–188

**Impact:** Under burst load, more draws per second than `rateLimitPerSecond` can succeed, allowing a player to deplete their balance faster than intended. Each draw still correctly debits the balance, so there is no free-draw exploit — but the rate limit provides no protection against burst draw attacks.

**Fix:** Replace the two-step `zremrangebyscore` + `zcard` + `zadd` with an atomic Lua script.

---

### GAP-003 (HIGH): Exchange accept does not validate recipient prize state

**File:** `RespondExchangeRequestUseCase.kt` lines 84–88 in `handleAccept`

**Impact:** A recipient's prize that was sold, recycled, or shipped between the exchange request being created and the accept being processed will be transferred from the new owner (or from a recycled/shipped state). This creates phantom ownership records.

**Fix:** In `handleAccept`, before calling `transferOwnership` for recipient items, verify each prize is in a valid transferable state. On failure, restore initiator prizes to HOLDING and throw.

---

### GAP-004 (MEDIUM): TokenService `rotateRefreshToken` has read-modify-write race

**File:** `TokenService.kt` lines 145–186

**Impact:** Two simultaneous token rotation requests (e.g. two browser tabs refreshing at the same millisecond) could both pass the hash check and both produce "valid" tokens — where one is immediately invalidated by the other's write. This causes unexpected session termination and confusing `TokenReplayException` errors for legitimate users.

**Fix:** Use a conditional UPDATE: `UPDATE refresh_token_families SET current_token_hash = ? WHERE family_token = ? AND current_token_hash = ?` and check the affected row count.

---

### GAP-005 (MEDIUM): PlayerRepositoryImpl.save() bypasses optimistic lock

**File:** `PlayerRepositoryImpl.kt` lines 94–110

**Impact:** Any code path that calls `playerRepository.save(player)` with a modified `drawPointsBalance` or `revenuePointsBalance` bypasses the version-gated `updateBalance` path, creating a potential lost-update scenario.

**Fix:** Audit all `playerRepository.save()` call sites. Add a runtime assertion that `save()` is never called with balance changes (enforce that balance fields can only change via `updateBalance`). Consider making balance fields private to the entity and only exposable via dedicated value objects.

---

## 5. Architecture Recommendations

1. **Add a DB-level unique constraint** on `payment_orders.gateway_transaction_id` to make webhook idempotency bullet-proof at the database layer.

2. **Add `version` to `RefreshTokenFamily`** and use optimistic locking in `TokenService.rotateRefreshToken`.

3. **Replace Redis rate limit** in `DrawUnlimitedUseCase` with an atomic Lua script (see GAP-002).

4. **Enforce `updateInstanceState` return value** in all callers (see GAP-001). Add a Detekt custom rule or a wrapper that throws on `false`.

5. **Add integration tests with an in-memory database** (H2 or embedded Postgres) to verify the Exposed optimistic lock SQL generates the correct `WHERE version = ?` clause.

6. **Monitor `OptimisticLockFailed` metrics** in production. High retry rates on `PointsLedgerService` indicate hotspot players (streamers/influencers) that may need dedicated sharding.
