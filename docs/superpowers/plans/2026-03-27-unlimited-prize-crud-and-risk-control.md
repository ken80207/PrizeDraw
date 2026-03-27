# Unlimited Prize CRUD & Risk Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add complete prize table CRUD for unlimited campaigns with `prizeValue`, shared margin risk service, configurable threshold, soft gate on activation, and pre-built approval API endpoints.

**Architecture:** Extends the existing hexagonal architecture with a new `MarginRiskService` (pure domain service), new use cases for prize table management, new admin API endpoints, and frontend updates. Follows contracts-first pattern: `api-contracts` updated before server/client.

**Tech Stack:** Kotlin 2.x / Ktor 3.x / Exposed ORM / Kotest / Next.js 14 / React 18

**Spec:** `docs/superpowers/specs/2026-03-27-unlimited-prize-crud-and-risk-control-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `server/src/main/resources/db/migration/V021__add_staff_role_manager.sql` | Add MANAGER to staff_role enum |
| `server/src/main/resources/db/migration/V022__create_system_settings.sql` | Create system_settings table with risk defaults |
| `server/src/main/resources/db/migration/V023__add_campaign_approval_columns.sql` | Add approval_status/approved_by/approved_at to campaign tables |
| `server/src/main/kotlin/com/prizedraw/domain/services/MarginRiskService.kt` | Pure margin calculation for Kuji and Unlimited |
| `server/src/test/kotlin/com/prizedraw/domain/services/MarginRiskServiceTest.kt` | Unit tests for margin calculations |
| `server/src/main/kotlin/com/prizedraw/application/usecases/admin/UpdateUnlimitedPrizeTableUseCase.kt` | Prize table update use case |
| `server/src/test/kotlin/com/prizedraw/application/usecases/admin/UpdateUnlimitedPrizeTableUseCaseTest.kt` | Use case tests |
| `server/src/main/kotlin/com/prizedraw/application/usecases/admin/ApproveCampaignUseCase.kt` | Pre-built approve/reject use case |
| `server/src/main/kotlin/com/prizedraw/application/usecases/admin/GetRiskSettingsUseCase.kt` | Read/update risk settings |
| `server/src/main/kotlin/com/prizedraw/domain/services/LowMarginException.kt` | Exception for margin gate, thrown when margin below threshold |
| `server/src/main/kotlin/com/prizedraw/api/mappers/MarginResultMapper.kt` | Extension function `MarginResult.toDto()` → `MarginResultDto` |
| `server/src/main/kotlin/com/prizedraw/infrastructure/persistence/tables/SystemSettingsTable.kt` | Exposed table for system_settings |
| `server/src/main/kotlin/com/prizedraw/infrastructure/persistence/repositories/SystemSettingsRepositoryImpl.kt` | System settings repository |
| `server/src/main/kotlin/com/prizedraw/application/ports/output/ISystemSettingsRepository.kt` | Port interface for system settings |
| `admin/src/lib/margin-utils.ts` | Shared margin calculation utilities for frontend |
| `admin/src/components/MarginDisplay.tsx` | Shared risk summary card component |

### Modified Files
| File | Changes |
|------|---------|
| `api-contracts/.../enums/PaymentGateway.kt` | Add `MANAGER` to StaffRole enum |
| `api-contracts/.../enums/CampaignType.kt` or new file | Add `ApprovalStatus` enum |
| `api-contracts/.../endpoints/AdminEndpoints.kt` | Add prize-table, approve, reject, risk-settings endpoint constants |
| `api-contracts/.../dto/admin/AdminDtos.kt` | Add UnlimitedPrizeEntryRequest, UpdatePrizeTableRequest, MarginResultDto, RiskSettingsResponse, ChangeCampaignStatusRequest.confirmLowMargin |
| `server/.../domain/entities/KujiCampaign.kt` | Add approvalStatus, approvedBy, approvedAt fields |
| `server/.../domain/entities/UnlimitedCampaign.kt` | Add approvalStatus, approvedBy, approvedAt fields |
| `server/.../infrastructure/persistence/tables/CampaignsTable.kt` | Add approval columns to both table objects |
| `server/.../infrastructure/persistence/repositories/CampaignRepositoryImpl.kt` | Map approval fields in toEntity conversions |
| `server/.../application/usecases/admin/CreateUnlimitedCampaignUseCase.kt` | Accept prizeTable, create prize definitions atomically |
| `server/.../application/usecases/admin/UpdateCampaignStatusUseCase.kt` | Add confirmLowMargin param, margin check, approval logic |
| `server/.../application/ports/input/admin/IUpdateCampaignStatusUseCase.kt` | Add confirmLowMargin to interface signature |
| `server/.../application/ports/output/IPrizeRepository.kt` | Add `deleteByUnlimitedCampaignId()` and `saveAll()` methods |
| `server/.../infrastructure/persistence/repositories/PrizeRepositoryImpl.kt` | Implement new IPrizeRepository methods |
| `server/.../api/routes/AdminCampaignRoutes.kt` | Add prize-table, approve, reject, risk-settings routes |
| `server/.../infrastructure/di/UseCaseModule.kt` | Register new use cases, update existing CreateUnlimitedCampaignUseCase registration |
| `server/.../infrastructure/di/ServiceModule.kt` | Register MarginRiskService |
| `server/.../infrastructure/di/RepositoryModule.kt` | Register ISystemSettingsRepository |
| `admin/src/app/(admin)/campaigns/create/page.tsx` | Add prizeValue to unlimited form, risk summary card, probability validation |
| `admin/src/app/(admin)/campaigns/[id]/page.tsx` | Editable prize table in DRAFT, risk display, confirmLowMargin dialog |

---

## Task 1: Database Migrations

**Files:**
- Create: `server/src/main/resources/db/migration/V021__add_staff_role_manager.sql`
- Create: `server/src/main/resources/db/migration/V022__create_system_settings.sql`
- Create: `server/src/main/resources/db/migration/V023__add_campaign_approval_columns.sql`

- [ ] **Step 1: Write V021 migration — add MANAGER to staff_role enum**

```sql
-- V021__add_staff_role_manager.sql
ALTER TYPE staff_role ADD VALUE 'MANAGER' BEFORE 'ADMIN';
```

- [ ] **Step 2: Write V022 migration — create system_settings table**

```sql
-- V022__create_system_settings.sql
CREATE TABLE system_settings (
    key        VARCHAR(128) PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID
);

COMMENT ON TABLE system_settings IS 'Key-value store for configurable system parameters';
COMMENT ON COLUMN system_settings.value IS 'JSON primitive value (number, boolean, string)';

INSERT INTO system_settings (key, value) VALUES
  ('risk.margin_threshold_pct', '20'),
  ('risk.require_approval_below_threshold', 'false');
```

- [ ] **Step 3: Write V023 migration — add approval columns to campaign tables**

```sql
-- V023__add_campaign_approval_columns.sql
ALTER TABLE kuji_campaigns
    ADD COLUMN approval_status VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUIRED',
    ADD COLUMN approved_by     UUID,
    ADD COLUMN approved_at     TIMESTAMPTZ;

ALTER TABLE unlimited_campaigns
    ADD COLUMN approval_status VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUIRED',
    ADD COLUMN approved_by     UUID,
    ADD COLUMN approved_at     TIMESTAMPTZ;

COMMENT ON COLUMN kuji_campaigns.approval_status IS 'NOT_REQUIRED | PENDING | APPROVED | REJECTED';
COMMENT ON COLUMN unlimited_campaigns.approval_status IS 'NOT_REQUIRED | PENDING | APPROVED | REJECTED';
```

- [ ] **Step 4: Verify migrations compile**

Run: `./gradlew build -x test`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add server/src/main/resources/db/migration/V021__add_staff_role_manager.sql \
        server/src/main/resources/db/migration/V022__create_system_settings.sql \
        server/src/main/resources/db/migration/V023__add_campaign_approval_columns.sql
git commit -m "feat: add migrations for MANAGER role, system_settings, and campaign approval columns"
```

---

## Task 2: api-contracts — Enums, Endpoints, DTOs

**Files:**
- Modify: `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/enums/PaymentGateway.kt` (StaffRole enum, ~line 30-35)
- Create or Modify: `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/enums/ApprovalStatus.kt`
- Modify: `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/endpoints/AdminEndpoints.kt`
- Modify: `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/dto/admin/AdminDtos.kt`

- [ ] **Step 1: Add MANAGER to StaffRole enum**

In `PaymentGateway.kt` (where StaffRole is defined), add `MANAGER` between `OPERATOR` and `ADMIN`:

```kotlin
@Serializable
public enum class StaffRole {
    CUSTOMER_SERVICE,
    OPERATOR,
    MANAGER,
    ADMIN,
    OWNER,
}
```

- [ ] **Step 2: Create ApprovalStatus enum**

Create `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/enums/ApprovalStatus.kt`:

```kotlin
package com.prizedraw.contracts.enums

import kotlinx.serialization.Serializable

/**
 * Approval status for campaign activation when margin is below threshold.
 */
@Serializable
public enum class ApprovalStatus {
    NOT_REQUIRED,
    PENDING,
    APPROVED,
    REJECTED,
}
```

- [ ] **Step 3: Add endpoint constants to AdminEndpoints.kt**

Append to the `AdminEndpoints` object:

```kotlin
public const val UNLIMITED_PRIZE_TABLE: String =
    "/api/v1/admin/campaigns/unlimited/{campaignId}/prize-table"
public const val CAMPAIGN_APPROVE: String =
    "/api/v1/admin/campaigns/{campaignId}/approve"
public const val CAMPAIGN_REJECT: String =
    "/api/v1/admin/campaigns/{campaignId}/reject"
public const val RISK_SETTINGS: String =
    "/api/v1/admin/settings/risk"
```

- [ ] **Step 4: Add new DTOs to AdminDtos.kt**

Append to `AdminDtos.kt`:

```kotlin
/**
 * A single prize entry in an unlimited campaign's probability table.
 */
@Serializable
public data class UnlimitedPrizeEntryRequest(
    val grade: String,
    val name: String,
    val probabilityBps: Int,
    val prizeValue: Int,
    val photoUrl: String? = null,
    val displayOrder: Int = 0,
)

/**
 * Full replacement of an unlimited campaign's prize table. Only allowed in DRAFT status.
 */
@Serializable
public data class UpdatePrizeTableRequest(
    val prizeTable: List<UnlimitedPrizeEntryRequest>,
)

/**
 * Margin analysis result returned after create/update/status-change operations.
 */
@Serializable
public data class MarginResultDto(
    val totalRevenuePerUnit: Int,
    val totalCostPerUnit: Int,
    val profitPerUnit: Int,
    val marginPct: Double,
    val belowThreshold: Boolean,
    val thresholdPct: Double,
)

/**
 * Risk settings for campaign margin validation.
 */
@Serializable
public data class RiskSettingsResponse(
    val marginThresholdPct: Double,
    val requireApprovalBelowThreshold: Boolean,
)

/**
 * Request to update risk settings.
 */
@Serializable
public data class RiskSettingsUpdateRequest(
    val marginThresholdPct: Double? = null,
    val requireApprovalBelowThreshold: Boolean? = null,
)
```

- [ ] **Step 5: Add `confirmLowMargin` to ChangeCampaignStatusRequest**

Modify the existing `ChangeCampaignStatusRequest` (~line 151):

```kotlin
@Serializable
public data class ChangeCampaignStatusRequest(
    val status: CampaignStatus,
    val confirmLowMargin: Boolean = false,
)
```

- [ ] **Step 6: Add `prizeTable` to CreateUnlimitedCampaignAdminRequest**

Modify the existing DTO (~line 134):

```kotlin
@Serializable
public data class CreateUnlimitedCampaignAdminRequest(
    val title: String,
    val description: String? = null,
    val coverImageUrl: String? = null,
    val pricePerDraw: Int,
    val rateLimitPerSecond: Int = 1,
    val prizeTable: List<UnlimitedPrizeEntryRequest> = emptyList(),
)
```

- [ ] **Step 7: Build api-contracts**

Run: `./gradlew :api-contracts:build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 8: Commit**

```bash
git add api-contracts/
git commit -m "feat: add contracts for unlimited prize table, margin risk, approval, and MANAGER role"
```

---

## Task 3: Domain — MarginRiskService

**Files:**
- Create: `server/src/main/kotlin/com/prizedraw/domain/services/MarginRiskService.kt`
- Create: `server/src/test/kotlin/com/prizedraw/domain/services/MarginRiskServiceTest.kt`

- [ ] **Step 1: Write failing tests for MarginRiskService**

Create `MarginRiskServiceTest.kt`:

```kotlin
package com.prizedraw.domain.services

import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.booleans.shouldBeFalse
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.shouldBe
import java.math.BigDecimal
import java.math.RoundingMode

class MarginRiskServiceTest :
    DescribeSpec({

        val service = MarginRiskService()
        val threshold = BigDecimal("20.00")

        describe("calculateUnlimitedMargin") {
            it("should calculate correct margin for a profitable campaign") {
                // pricePerDraw = 100, expectedPayout = 60 → margin = 40%
                val prizes = listOf(
                    UnlimitedPrizeInput(probabilityBps = 500_000, prizeValue = 80),  // 50% × 80 = 40
                    UnlimitedPrizeInput(probabilityBps = 500_000, prizeValue = 40),  // 50% × 40 = 20
                )
                val result = service.calculateUnlimitedMargin(
                    pricePerDraw = 100,
                    prizes = prizes,
                    thresholdPct = threshold,
                )
                result.totalRevenuePerUnit shouldBe 100
                result.totalCostPerUnit shouldBe 60
                result.profitPerUnit shouldBe 40
                result.marginPct.setScale(2, RoundingMode.HALF_UP) shouldBe BigDecimal("40.00")
                result.belowThreshold.shouldBeFalse()
            }

            it("should flag below threshold when margin is under 20%") {
                // pricePerDraw = 100, expectedPayout = 90 → margin = 10%
                val prizes = listOf(
                    UnlimitedPrizeInput(probabilityBps = 1_000_000, prizeValue = 90),
                )
                val result = service.calculateUnlimitedMargin(
                    pricePerDraw = 100,
                    prizes = prizes,
                    thresholdPct = threshold,
                )
                result.marginPct.setScale(2, RoundingMode.HALF_UP) shouldBe BigDecimal("10.00")
                result.belowThreshold.shouldBeTrue()
            }

            it("should handle negative margin (loss)") {
                val prizes = listOf(
                    UnlimitedPrizeInput(probabilityBps = 1_000_000, prizeValue = 150),
                )
                val result = service.calculateUnlimitedMargin(
                    pricePerDraw = 100,
                    prizes = prizes,
                    thresholdPct = threshold,
                )
                result.profitPerUnit shouldBe -50
                result.belowThreshold.shouldBeTrue()
            }
        }

        describe("calculateKujiMargin") {
            it("should calculate correct margin for a kuji campaign") {
                // 10 tickets per box × 100 price = 1000 revenue
                // cost = (5 × 100) + (5 × 50) = 750
                // margin = 25%
                val prizes = listOf(
                    KujiPrizeInput(ticketCount = 5, prizeValue = 100),
                    KujiPrizeInput(ticketCount = 5, prizeValue = 50),
                )
                val result = service.calculateKujiMargin(
                    pricePerDraw = 100,
                    prizes = prizes,
                    boxCount = 1,
                    thresholdPct = threshold,
                )
                result.totalRevenuePerUnit shouldBe 1000
                result.totalCostPerUnit shouldBe 750
                result.profitPerUnit shouldBe 250
                result.marginPct.setScale(2, RoundingMode.HALF_UP) shouldBe BigDecimal("25.00")
                result.belowThreshold.shouldBeFalse()
            }

            it("should scale with box count") {
                val prizes = listOf(
                    KujiPrizeInput(ticketCount = 10, prizeValue = 80),
                )
                val result = service.calculateKujiMargin(
                    pricePerDraw = 100,
                    prizes = prizes,
                    boxCount = 3,
                    thresholdPct = threshold,
                )
                result.totalRevenuePerUnit shouldBe 3000
                result.totalCostPerUnit shouldBe 2400
            }
        }
    })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./gradlew :server:test --tests "com.prizedraw.domain.services.MarginRiskServiceTest" --info`
Expected: FAIL — `MarginRiskService` not found

- [ ] **Step 3: Implement MarginRiskService**

Create `server/src/main/kotlin/com/prizedraw/domain/services/MarginRiskService.kt`:

```kotlin
package com.prizedraw.domain.services

import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Pure calculation service for campaign margin/risk analysis.
 * No I/O — threshold is passed in by the calling use case.
 */
public class MarginRiskService {

    /**
     * Calculate margin for a Kuji campaign (fixed ticket pool).
     *
     * @param pricePerDraw draw cost in points
     * @param prizes list of prize inputs with ticket count and value
     * @param boxCount number of ticket boxes
     * @param thresholdPct margin threshold percentage from system settings
     */
    public fun calculateKujiMargin(
        pricePerDraw: Int,
        prizes: List<KujiPrizeInput>,
        boxCount: Int,
        thresholdPct: BigDecimal,
    ): MarginResult {
        val ticketsPerBox = prizes.sumOf { it.ticketCount }
        val totalRevenue = ticketsPerBox.toLong() * pricePerDraw * boxCount
        val costPerBox = prizes.sumOf { it.ticketCount.toLong() * it.prizeValue }
        val totalCost = costPerBox * boxCount
        return buildResult(totalRevenue, totalCost, thresholdPct)
    }

    /**
     * Calculate margin for an Unlimited campaign (probability-based).
     *
     * @param pricePerDraw draw cost in points
     * @param prizes list of prize inputs with probability (bps) and value
     * @param thresholdPct margin threshold percentage from system settings
     */
    public fun calculateUnlimitedMargin(
        pricePerDraw: Int,
        prizes: List<UnlimitedPrizeInput>,
        thresholdPct: BigDecimal,
    ): MarginResult {
        val expectedPayout = prizes.sumOf { prize ->
            BigDecimal(prize.probabilityBps)
                .multiply(BigDecimal(prize.prizeValue))
                .divide(BigDecimal(PROBABILITY_TOTAL), 4, RoundingMode.HALF_UP)
        }
        val revenue = BigDecimal(pricePerDraw)
        val profit = revenue.subtract(expectedPayout)
        val marginPct = if (revenue > BigDecimal.ZERO) {
            profit.multiply(BigDecimal(100)).divide(revenue, 4, RoundingMode.HALF_UP)
        } else {
            BigDecimal.ZERO
        }
        return MarginResult(
            totalRevenuePerUnit = pricePerDraw,
            totalCostPerUnit = expectedPayout.setScale(0, RoundingMode.HALF_UP).toInt(),
            profitPerUnit = profit.setScale(0, RoundingMode.HALF_UP).toInt(),
            marginPct = marginPct,
            belowThreshold = marginPct < thresholdPct,
            thresholdPct = thresholdPct,
        )
    }

    private fun buildResult(
        totalRevenue: Long,
        totalCost: Long,
        thresholdPct: BigDecimal,
    ): MarginResult {
        val profit = totalRevenue - totalCost
        val marginPct = if (totalRevenue > 0) {
            BigDecimal(profit)
                .multiply(BigDecimal(100))
                .divide(BigDecimal(totalRevenue), 4, RoundingMode.HALF_UP)
        } else {
            BigDecimal.ZERO
        }
        return MarginResult(
            totalRevenuePerUnit = totalRevenue.toInt(),
            totalCostPerUnit = totalCost.toInt(),
            profitPerUnit = profit.toInt(),
            marginPct = marginPct,
            belowThreshold = marginPct < thresholdPct,
            thresholdPct = thresholdPct,
        )
    }

    private companion object {
        const val PROBABILITY_TOTAL = 1_000_000
    }
}

/** Input for Kuji margin calculation. */
public data class KujiPrizeInput(
    val ticketCount: Int,
    val prizeValue: Int,
)

/** Input for Unlimited margin calculation. */
public data class UnlimitedPrizeInput(
    val probabilityBps: Int,
    val prizeValue: Int,
)

/** Result of a margin calculation. */
public data class MarginResult(
    val totalRevenuePerUnit: Int,
    val totalCostPerUnit: Int,
    val profitPerUnit: Int,
    val marginPct: BigDecimal,
    val belowThreshold: Boolean,
    val thresholdPct: BigDecimal,
)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./gradlew :server:test --tests "com.prizedraw.domain.services.MarginRiskServiceTest" --info`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/main/kotlin/com/prizedraw/domain/services/MarginRiskService.kt \
        server/src/test/kotlin/com/prizedraw/domain/services/MarginRiskServiceTest.kt
git commit -m "feat: add MarginRiskService with Kuji and Unlimited margin calculations"
```

---

## Task 4: Infrastructure — SystemSettings Table, Repository, and Approval Columns

**Files:**
- Create: `server/src/main/kotlin/com/prizedraw/infrastructure/persistence/tables/SystemSettingsTable.kt`
- Create: `server/src/main/kotlin/com/prizedraw/application/ports/output/ISystemSettingsRepository.kt`
- Create: `server/src/main/kotlin/com/prizedraw/infrastructure/persistence/repositories/SystemSettingsRepositoryImpl.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/infrastructure/persistence/tables/CampaignsTable.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/domain/entities/KujiCampaign.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/domain/entities/UnlimitedCampaign.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/infrastructure/persistence/repositories/CampaignRepositoryImpl.kt`

- [ ] **Step 1: Create SystemSettingsTable (Exposed)**

```kotlin
package com.prizedraw.infrastructure.persistence.tables

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.javatime.timestamp

/**
 * Exposed table definition for the `system_settings` key-value store.
 */
public object SystemSettingsTable : Table("system_settings") {
    val key = varchar("key", 128)
    val value = jsonb("value", String.serializer())
    val updatedAt = timestamp("updated_at")
    val updatedBy = uuid("updated_by").nullable()

    override val primaryKey: PrimaryKey = PrimaryKey(key)
}
```

Note: Check how the existing codebase defines JSONB columns in Exposed (there may be a custom `jsonb` function). Adapt the column definition accordingly.

- [ ] **Step 2: Create ISystemSettingsRepository port**

```kotlin
package com.prizedraw.application.ports.output

import java.math.BigDecimal
import java.util.UUID

/**
 * Port for reading and updating system-level configuration values.
 */
public interface ISystemSettingsRepository {
    public suspend fun getMarginThresholdPct(): BigDecimal
    public suspend fun getRequireApprovalBelowThreshold(): Boolean
    public suspend fun updateMarginThresholdPct(value: BigDecimal, staffId: UUID)
    public suspend fun updateRequireApprovalBelowThreshold(value: Boolean, staffId: UUID)
}
```

- [ ] **Step 3: Implement SystemSettingsRepositoryImpl**

```kotlin
package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.ISystemSettingsRepository
import com.prizedraw.infrastructure.persistence.tables.SystemSettingsTable
import kotlinx.datetime.Clock
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.update
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.math.BigDecimal
import java.util.UUID

/**
 * Implementation of [ISystemSettingsRepository] backed by the `system_settings` table.
 */
public class SystemSettingsRepositoryImpl : ISystemSettingsRepository {

    override suspend fun getMarginThresholdPct(): BigDecimal =
        newSuspendedTransaction {
            SystemSettingsTable
                .selectAll()
                .where { SystemSettingsTable.key eq "risk.margin_threshold_pct" }
                .single()[SystemSettingsTable.value]
                .let { BigDecimal(it) }
        }

    override suspend fun getRequireApprovalBelowThreshold(): Boolean =
        newSuspendedTransaction {
            SystemSettingsTable
                .selectAll()
                .where { SystemSettingsTable.key eq "risk.require_approval_below_threshold" }
                .single()[SystemSettingsTable.value]
                .toBooleanStrict()
        }

    override suspend fun updateMarginThresholdPct(value: BigDecimal, staffId: UUID) {
        newSuspendedTransaction {
            SystemSettingsTable.update({ SystemSettingsTable.key eq "risk.margin_threshold_pct" }) {
                it[SystemSettingsTable.value] = value.toPlainString()
                it[updatedAt] = Clock.System.now().toJavaInstant()
                it[updatedBy] = staffId
            }
        }
    }

    override suspend fun updateRequireApprovalBelowThreshold(value: Boolean, staffId: UUID) {
        newSuspendedTransaction {
            SystemSettingsTable.update({
                SystemSettingsTable.key eq "risk.require_approval_below_threshold"
            }) {
                it[SystemSettingsTable.value] = value.toString()
                it[updatedAt] = Clock.System.now().toJavaInstant()
                it[updatedBy] = staffId
            }
        }
    }
}
```

- [ ] **Step 4: Extend IPrizeRepository with new methods**

Add to `server/src/main/kotlin/com/prizedraw/application/ports/output/IPrizeRepository.kt`:

```kotlin
public suspend fun deleteByUnlimitedCampaignId(campaignId: CampaignId)
public suspend fun saveAll(definitions: List<PrizeDefinition>)
```

Implement both in `PrizeRepositoryImpl.kt`:

```kotlin
override suspend fun deleteByUnlimitedCampaignId(campaignId: CampaignId) {
    newSuspendedTransaction {
        PrizeDefinitionsTable.deleteWhere {
            unlimitedCampaignId eq campaignId.value
        }
    }
}

override suspend fun saveAll(definitions: List<PrizeDefinition>) {
    newSuspendedTransaction {
        definitions.forEach { def ->
            PrizeDefinitionsTable.insert {
                it[id] = def.id.value
                it[kujiCampaignId] = def.kujiCampaignId?.value
                it[unlimitedCampaignId] = def.unlimitedCampaignId?.value
                it[grade] = def.grade
                it[name] = def.name
                it[photos] = def.photos
                it[prizeValue] = def.prizeValue
                it[buybackPrice] = def.buybackPrice
                it[buybackEnabled] = def.buybackEnabled
                it[probabilityBps] = def.probabilityBps
                it[ticketCount] = def.ticketCount
                it[displayOrder] = def.displayOrder
                it[createdAt] = def.createdAt.toJavaInstant()
                it[updatedAt] = def.updatedAt.toJavaInstant()
            }
        }
    }
}
```

- [ ] **Step 5: Add approval fields to domain entities**

Add to both `KujiCampaign` and `UnlimitedCampaign` data classes:

```kotlin
val approvalStatus: ApprovalStatus = ApprovalStatus.NOT_REQUIRED,
val approvedBy: UUID? = null,
val approvedAt: Instant? = null,
```

Import `com.prizedraw.contracts.enums.ApprovalStatus`.

- [ ] **Step 6: Add approval columns to Exposed campaign tables**

In `CampaignsTable.kt`, add to both `KujiCampaignsTable` and `UnlimitedCampaignsTable`:

```kotlin
val approvalStatus = varchar("approval_status", 32).default("NOT_REQUIRED")
val approvedBy = uuid("approved_by").nullable()
val approvedAt = timestamp("approved_at").nullable()
```

- [ ] **Step 7: Update CampaignRepositoryImpl entity mappings**

In the `toKujiCampaign()` and `toUnlimitedCampaign()` extension functions, add:

```kotlin
approvalStatus = ApprovalStatus.valueOf(row[table.approvalStatus]),
approvedBy = row[table.approvedBy],
approvedAt = row[table.approvedAt]?.toKotlinInstant(),
```

And in the save/insert functions, add the reverse mappings.

- [ ] **Step 8: Build to verify compilation**

Run: `./gradlew build -x test`
Expected: BUILD SUCCESSFUL

- [ ] **Step 9: Commit**

```bash
git add server/src/main/kotlin/com/prizedraw/infrastructure/persistence/tables/SystemSettingsTable.kt \
        server/src/main/kotlin/com/prizedraw/application/ports/output/ISystemSettingsRepository.kt \
        server/src/main/kotlin/com/prizedraw/infrastructure/persistence/repositories/SystemSettingsRepositoryImpl.kt \
        server/src/main/kotlin/com/prizedraw/application/ports/output/IPrizeRepository.kt \
        server/src/main/kotlin/com/prizedraw/infrastructure/persistence/repositories/PrizeRepositoryImpl.kt \
        server/src/main/kotlin/com/prizedraw/domain/entities/KujiCampaign.kt \
        server/src/main/kotlin/com/prizedraw/domain/entities/UnlimitedCampaign.kt \
        server/src/main/kotlin/com/prizedraw/infrastructure/persistence/tables/CampaignsTable.kt \
        server/src/main/kotlin/com/prizedraw/infrastructure/persistence/repositories/CampaignRepositoryImpl.kt
git commit -m "feat: add system_settings infrastructure, IPrizeRepository extensions, and campaign approval columns"
```

---

## Task 5: Use Case — CreateUnlimitedCampaign with Prize Table

**Files:**
- Modify: `server/src/main/kotlin/com/prizedraw/application/usecases/admin/CreateUnlimitedCampaignUseCase.kt`

- [ ] **Step 1: Read the current CreateUnlimitedCampaignUseCase to understand existing flow**

Read the full file to see how it currently creates a campaign without prizes.

- [ ] **Step 2: Modify use case to accept and create prize definitions**

Add logic after campaign creation to:
1. Validate probability sum = 1,000,000 bps using `UnlimitedDrawDomainService.validateProbabilitySum()`
2. Validate each entry: `prizeValue >= 0`, `probabilityBps > 0`, `grade` and `name` not blank
3. Create `PrizeDefinition` records for each entry in `prizeTable`
4. Calculate margin via `MarginRiskService` and include `MarginResultDto` in response

The use case constructor gains new dependencies: `MarginRiskService`, `ISystemSettingsRepository`, `IPrizeRepository`.

**Important:** Also update the existing Koin registration in `UseCaseModule.kt` for `CreateUnlimitedCampaignUseCase` to include the new dependencies.

- [ ] **Step 3: Build and run existing tests**

Run: `./gradlew :server:test --info`
Expected: Existing tests still pass (new fields have defaults)

- [ ] **Step 4: Commit**

```bash
git add server/src/main/kotlin/com/prizedraw/application/usecases/admin/CreateUnlimitedCampaignUseCase.kt
git commit -m "feat: CreateUnlimitedCampaignUseCase now creates prize table with margin analysis"
```

---

## Task 6: Use Case — UpdateUnlimitedPrizeTable

**Files:**
- Create: `server/src/main/kotlin/com/prizedraw/application/usecases/admin/UpdateUnlimitedPrizeTableUseCase.kt`
- Create: `server/src/test/kotlin/com/prizedraw/application/usecases/admin/UpdateUnlimitedPrizeTableUseCaseTest.kt`

- [ ] **Step 1: Write failing test**

```kotlin
package com.prizedraw.application.usecases.admin

import io.kotest.core.spec.style.DescribeSpec
import io.kotest.assertions.throwables.shouldThrow
// ... test setup with mocked repositories

class UpdateUnlimitedPrizeTableUseCaseTest :
    DescribeSpec({
        describe("execute") {
            it("should reject update when campaign is not DRAFT") {
                // setup: campaign in ACTIVE status
                // expect: IllegalStateException
            }

            it("should reject when probability sum is not 1,000,000") {
                // setup: DRAFT campaign, prizes summing to 900,000 bps
                // expect: IllegalArgumentException
            }

            it("should replace all prize definitions and return margin result") {
                // setup: DRAFT campaign, valid prize table
                // expect: old prizes deleted, new prizes created, MarginResult returned
            }
        }
    })
```

- [ ] **Step 2: Run test to verify failure**

Run: `./gradlew :server:test --tests "com.prizedraw.application.usecases.admin.UpdateUnlimitedPrizeTableUseCaseTest" --info`
Expected: FAIL

- [ ] **Step 3: Implement UpdateUnlimitedPrizeTableUseCase**

```kotlin
package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.ISystemSettingsRepository
import com.prizedraw.contracts.dto.admin.UpdatePrizeTableRequest
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.domain.entities.PrizeDefinition
import com.prizedraw.domain.services.MarginResult
import com.prizedraw.domain.services.MarginRiskService
import com.prizedraw.domain.services.UnlimitedDrawDomainService
import com.prizedraw.domain.services.UnlimitedPrizeInput
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import kotlinx.datetime.Clock
import java.util.UUID

/**
 * Replaces the entire prize table for an unlimited campaign (DRAFT only).
 * Validates probability sum = 1,000,000 bps and returns margin analysis.
 */
public class UpdateUnlimitedPrizeTableUseCase(
    private val campaignRepository: ICampaignRepository,
    private val prizeRepository: IPrizeRepository,
    private val marginRiskService: MarginRiskService,
    private val unlimitedDrawService: UnlimitedDrawDomainService,
    private val settingsRepository: ISystemSettingsRepository,
) {
    public suspend fun execute(
        campaignId: CampaignId,
        request: UpdatePrizeTableRequest,
        staffId: UUID,
    ): MarginResult {
        val campaign = campaignRepository.findUnlimitedById(campaignId)
            ?: error("Unlimited campaign not found: $campaignId")

        require(campaign.status == CampaignStatus.DRAFT) {
            "Prize table can only be updated in DRAFT status, current: ${campaign.status}"
        }

        // Validate probability sum
        val totalBps = request.prizeTable.sumOf { it.probabilityBps }
        require(totalBps == 1_000_000) {
            "Probability sum must be exactly 1,000,000 bps (100%), got: $totalBps"
        }

        // Validate individual entries
        request.prizeTable.forEach { entry ->
            require(entry.prizeValue >= 0) { "prizeValue must be >= 0" }
            require(entry.probabilityBps > 0) { "probabilityBps must be > 0" }
            require(entry.grade.isNotBlank()) { "grade must not be blank" }
            require(entry.name.isNotBlank()) { "name must not be blank" }
        }

        val now = Clock.System.now()

        // Delete existing prize definitions for this campaign
        prizeRepository.deleteByUnlimitedCampaignId(campaignId)

        // Create new definitions
        val definitions = request.prizeTable.map { entry ->
            PrizeDefinition(
                id = PrizeDefinitionId.generate(),
                kujiCampaignId = null,
                unlimitedCampaignId = campaignId,
                grade = entry.grade,
                name = entry.name,
                photos = listOfNotNull(entry.photoUrl),
                prizeValue = entry.prizeValue,
                buybackPrice = 0,
                buybackEnabled = true,
                probabilityBps = entry.probabilityBps,
                ticketCount = null,
                displayOrder = entry.displayOrder,
                createdAt = now,
                updatedAt = now,
            )
        }
        prizeRepository.saveAll(definitions)

        // Calculate and return margin
        val threshold = settingsRepository.getMarginThresholdPct()
        return marginRiskService.calculateUnlimitedMargin(
            pricePerDraw = campaign.pricePerDraw,
            prizes = definitions.map {
                UnlimitedPrizeInput(
                    probabilityBps = it.probabilityBps!!,
                    prizeValue = it.prizeValue,
                )
            },
            thresholdPct = threshold,
        )
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./gradlew :server:test --tests "com.prizedraw.application.usecases.admin.UpdateUnlimitedPrizeTableUseCaseTest" --info`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/main/kotlin/com/prizedraw/application/usecases/admin/UpdateUnlimitedPrizeTableUseCase.kt \
        server/src/test/kotlin/com/prizedraw/application/usecases/admin/UpdateUnlimitedPrizeTableUseCaseTest.kt
git commit -m "feat: add UpdateUnlimitedPrizeTableUseCase with full replacement and margin analysis"
```

---

## Task 7: Use Case — UpdateCampaignStatus with Margin Gate

**Files:**
- Create: `server/src/main/kotlin/com/prizedraw/domain/services/LowMarginException.kt`
- Create: `server/src/main/kotlin/com/prizedraw/api/mappers/MarginResultMapper.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/application/ports/input/admin/IUpdateCampaignStatusUseCase.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/application/usecases/admin/UpdateCampaignStatusUseCase.kt`

- [ ] **Step 1: Create LowMarginException in domain/services package**

Place in `domain/services/` alongside other domain service types (existing pattern — no `domain/exceptions/` directory exists):

```kotlin
package com.prizedraw.domain.services

/**
 * Thrown when a campaign activation is rejected due to low margin.
 * The route handler maps this to HTTP 422 with the [marginResult] in the response body.
 */
public class LowMarginException(
    public val marginResult: MarginResult,
) : RuntimeException("Campaign margin ${marginResult.marginPct}% is below threshold ${marginResult.thresholdPct}%")
```

- [ ] **Step 2: Create MarginResult.toDto() mapper**

Create `server/src/main/kotlin/com/prizedraw/api/mappers/MarginResultMapper.kt`:

```kotlin
package com.prizedraw.api.mappers

import com.prizedraw.contracts.dto.admin.MarginResultDto
import com.prizedraw.domain.services.MarginResult

/**
 * Maps domain [MarginResult] to API [MarginResultDto].
 */
public fun MarginResult.toDto(): MarginResultDto = MarginResultDto(
    totalRevenuePerUnit = totalRevenuePerUnit,
    totalCostPerUnit = totalCostPerUnit,
    profitPerUnit = profitPerUnit,
    marginPct = marginPct.toDouble(),
    belowThreshold = belowThreshold,
    thresholdPct = thresholdPct.toDouble(),
)
```

Note: DTOs use `Double` instead of `BigDecimal` for KMP serialization compatibility across all platforms.

- [ ] **Step 3: Update IUpdateCampaignStatusUseCase interface**

Read `server/src/main/kotlin/com/prizedraw/application/ports/input/admin/IUpdateCampaignStatusUseCase.kt` and add `confirmLowMargin` parameter:

```kotlin
public suspend fun execute(
    staffId: UUID,
    campaignId: CampaignId,
    campaignType: CampaignType,
    newStatus: CampaignStatus,
    confirmLowMargin: Boolean = false,  // NEW
)
```

- [ ] **Step 4: Read current UpdateCampaignStatusUseCase**

Read the full file to understand existing transition logic.

- [ ] **Step 5: Add confirmLowMargin parameter and margin check**

Modify `execute()` to:
1. Accept `confirmLowMargin: Boolean = false` parameter (matching interface)
2. On DRAFT → ACTIVE for unlimited campaigns:
   - Load prize definitions via `IPrizeRepository`
   - Calculate margin via `MarginRiskService`
   - If `belowThreshold && !confirmLowMargin` → throw `LowMarginException(marginResult)`
   - If `belowThreshold && confirmLowMargin` → proceed
   - Future: check `requireApprovalBelowThreshold` setting → set `approvalStatus = PENDING` instead of activating
3. Same logic for kuji campaigns (load boxes count from ticket box repository, calculate kuji margin)

Add constructor dependencies: `MarginRiskService`, `ISystemSettingsRepository`, `IPrizeRepository`.

**Important:** Also update the Koin registration in `UseCaseModule.kt` for `UpdateCampaignStatusUseCase` to include the new dependencies.

- [ ] **Step 6: Build and run tests**

Run: `./gradlew :server:test --info`
Expected: ALL PASS (existing tests use campaigns above threshold or mock the dependency)

- [ ] **Step 7: Commit**

```bash
git add server/src/main/kotlin/com/prizedraw/domain/services/LowMarginException.kt \
        server/src/main/kotlin/com/prizedraw/api/mappers/MarginResultMapper.kt \
        server/src/main/kotlin/com/prizedraw/application/ports/input/admin/IUpdateCampaignStatusUseCase.kt \
        server/src/main/kotlin/com/prizedraw/application/usecases/admin/UpdateCampaignStatusUseCase.kt
git commit -m "feat: add margin gate to campaign activation with confirmLowMargin soft override"
```

---

## Task 8: Use Cases — Approve/Reject and Risk Settings

**Files:**
- Create: `server/src/main/kotlin/com/prizedraw/application/usecases/admin/ApproveCampaignUseCase.kt`
- Create: `server/src/main/kotlin/com/prizedraw/application/usecases/admin/GetRiskSettingsUseCase.kt`

- [ ] **Step 1: Implement ApproveCampaignUseCase (pre-built stub)**

```kotlin
package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.ISystemSettingsRepository
import com.prizedraw.contracts.enums.ApprovalStatus
import com.prizedraw.domain.valueobjects.CampaignId
import java.util.UUID

/**
 * Approves or rejects a campaign pending manager approval.
 * Pre-built for future use — currently gated by `require_approval_below_threshold` setting.
 */
public class ApproveCampaignUseCase(
    private val campaignRepository: ICampaignRepository,
    private val settingsRepository: ISystemSettingsRepository,
) {
    public suspend fun approve(campaignId: CampaignId, staffId: UUID) {
        requireFeatureEnabled()
        // Update approval status → APPROVED, set approvedBy/approvedAt
        // Transition campaign to ACTIVE
        TODO("Approval flow not yet active")
    }

    public suspend fun reject(campaignId: CampaignId, staffId: UUID, reason: String? = null) {
        requireFeatureEnabled()
        // Update approval status → REJECTED
        TODO("Approval flow not yet active")
    }

    private suspend fun requireFeatureEnabled() {
        val enabled = settingsRepository.getRequireApprovalBelowThreshold()
        check(enabled) { "Approval workflow is not enabled. Enable via risk settings." }
    }
}
```

- [ ] **Step 2: Implement GetRiskSettingsUseCase**

```kotlin
package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.output.ISystemSettingsRepository
import com.prizedraw.contracts.dto.admin.RiskSettingsResponse
import com.prizedraw.contracts.dto.admin.RiskSettingsUpdateRequest
import java.math.BigDecimal
import java.util.UUID

/**
 * Read and update risk control settings (margin threshold, approval toggle).
 */
public class GetRiskSettingsUseCase(
    private val settingsRepository: ISystemSettingsRepository,
) {
    public suspend fun get(): RiskSettingsResponse {
        return RiskSettingsResponse(
            marginThresholdPct = settingsRepository.getMarginThresholdPct().toDouble(),
            requireApprovalBelowThreshold = settingsRepository.getRequireApprovalBelowThreshold(),
        )
    }

    public suspend fun update(request: RiskSettingsUpdateRequest, staffId: UUID) {
        request.marginThresholdPct?.let {
            require(it in 0.0..100.0) { "Threshold must be between 0 and 100" }
            settingsRepository.updateMarginThresholdPct(BigDecimal(it.toString()), staffId)
        }
        request.requireApprovalBelowThreshold?.let {
            settingsRepository.updateRequireApprovalBelowThreshold(it, staffId)
        }
    }
}
```

- [ ] **Step 3: Build**

Run: `./gradlew build -x test`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit**

```bash
git add server/src/main/kotlin/com/prizedraw/application/usecases/admin/ApproveCampaignUseCase.kt \
        server/src/main/kotlin/com/prizedraw/application/usecases/admin/GetRiskSettingsUseCase.kt
git commit -m "feat: add ApproveCampaignUseCase (pre-built) and GetRiskSettingsUseCase"
```

---

## Task 9: Routes — Admin API Endpoints

**Files:**
- Modify: `server/src/main/kotlin/com/prizedraw/api/routes/AdminCampaignRoutes.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/infrastructure/di/UseCaseModule.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/infrastructure/di/ServiceModule.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/infrastructure/di/RepositoryModule.kt`

- [ ] **Step 1: Register new services, repositories, and use cases in Koin**

In `ServiceModule.kt`, add:
```kotlin
single { MarginRiskService() }
```

In `RepositoryModule.kt` (repositories go here, not UseCaseModule):
```kotlin
single<ISystemSettingsRepository> { SystemSettingsRepositoryImpl() }
```

In `UseCaseModule.kt`, add new use cases and **update existing registrations** with new dependencies:
```kotlin
// NEW use cases
single { UpdateUnlimitedPrizeTableUseCase(get(), get(), get(), get(), get()) }
single { ApproveCampaignUseCase(get(), get()) }
single { GetRiskSettingsUseCase(get()) }

// UPDATE existing registrations to include new dependencies:
// - CreateUnlimitedCampaignUseCase: add MarginRiskService, ISystemSettingsRepository, IPrizeRepository
// - UpdateCampaignStatusUseCase: add MarginRiskService, ISystemSettingsRepository, IPrizeRepository
```

Note: The existing codebase uses interface-bound singletons (e.g., `single<ICreateUnlimitedCampaignUseCase> { ... }`). The new use cases skip input port interfaces since they are not injected polymorphically — this is a deliberate simplification for these smaller use cases.

- [ ] **Step 2: Add prize-table route**

In `AdminCampaignRoutes.kt`, add:

```kotlin
patch(AdminEndpoints.UNLIMITED_PRIZE_TABLE) {
    val staffId = call.authenticatedStaffId()
    requireRole(call, StaffRole.OPERATOR)
    val campaignId = CampaignId(call.pathParam("campaignId"))
    val request = call.receive<UpdatePrizeTableRequest>()
    val result = updatePrizeTableUseCase.execute(campaignId, request, staffId)
    call.respond(HttpStatusCode.OK, result.toDto())
}
```

- [ ] **Step 3: Add approve/reject routes**

```kotlin
post(AdminEndpoints.CAMPAIGN_APPROVE) {
    val staffId = call.authenticatedStaffId()
    requireRole(call, StaffRole.MANAGER)  // Requires MANAGER role per spec
    val campaignId = CampaignId(call.pathParam("campaignId"))
    try {
        approveCampaignUseCase.approve(campaignId, staffId)
        call.respond(HttpStatusCode.OK)
    } catch (e: IllegalStateException) {
        call.respond(HttpStatusCode.Conflict, mapOf("error" to e.message))
    }
}

post(AdminEndpoints.CAMPAIGN_REJECT) {
    val staffId = call.authenticatedStaffId()
    requireRole(call, StaffRole.MANAGER)  // Requires MANAGER role per spec
    val campaignId = CampaignId(call.pathParam("campaignId"))
    try {
        approveCampaignUseCase.reject(campaignId, staffId)
        call.respond(HttpStatusCode.OK)
    } catch (e: IllegalStateException) {
        call.respond(HttpStatusCode.Conflict, mapOf("error" to e.message))
    }
}
```

- [ ] **Step 4: Add risk settings routes**

```kotlin
get(AdminEndpoints.RISK_SETTINGS) {
    requireRole(call, StaffRole.ADMIN)
    val settings = riskSettingsUseCase.get()
    call.respond(HttpStatusCode.OK, settings)
}

patch(AdminEndpoints.RISK_SETTINGS) {
    val staffId = call.authenticatedStaffId()
    requireRole(call, StaffRole.ADMIN)
    val request = call.receive<RiskSettingsUpdateRequest>()
    riskSettingsUseCase.update(request, staffId)
    call.respond(HttpStatusCode.OK, riskSettingsUseCase.get())
}
```

- [ ] **Step 5: Add LowMarginException handler to status change route**

In the existing status change route handler, catch `LowMarginException` and return HTTP 422. Import `com.prizedraw.api.mappers.toDto`:

```kotlin
catch (e: LowMarginException) {
    call.respond(HttpStatusCode.UnprocessableEntity, e.marginResult.toDto())
}
```

Also update the prize-table route to use the mapper:
```kotlin
val result = updatePrizeTableUseCase.execute(campaignId, request, staffId)
call.respond(HttpStatusCode.OK, result.toDto())
```

- [ ] **Step 6: Build and run all tests**

Run: `./gradlew build`
Expected: BUILD SUCCESSFUL, ALL TESTS PASS

- [ ] **Step 7: Commit**

```bash
git add server/src/main/kotlin/com/prizedraw/api/routes/AdminCampaignRoutes.kt \
        server/src/main/kotlin/com/prizedraw/infrastructure/di/UseCaseModule.kt \
        server/src/main/kotlin/com/prizedraw/infrastructure/di/ServiceModule.kt \
        server/src/main/kotlin/com/prizedraw/infrastructure/di/RepositoryModule.kt
git commit -m "feat: add admin routes for prize-table, approve/reject, and risk settings"
```

---

## Task 10: Admin Frontend — Shared Utilities and Components

**Files:**
- Create: `admin/src/lib/margin-utils.ts`
- Create: `admin/src/components/MarginDisplay.tsx`

- [ ] **Step 1: Create margin calculation utilities**

```typescript
// admin/src/lib/margin-utils.ts

export interface KujiPrizeInput {
  ticketCount: number;
  prizeValue: number;
}

export interface UnlimitedPrizeInput {
  probabilityBps: number;
  prizeValue: number;
}

export interface MarginResult {
  totalRevenuePerUnit: number;
  totalCostPerUnit: number;
  profitPerUnit: number;
  marginPct: number;
  belowThreshold: boolean;
  thresholdPct: number;
}

const PROBABILITY_TOTAL = 1_000_000;

export function calcKujiMargin(
  pricePerDraw: number,
  prizes: KujiPrizeInput[],
  boxCount: number,
  thresholdPct: number,
): MarginResult {
  const ticketsPerBox = prizes.reduce((sum, p) => sum + p.ticketCount, 0);
  const totalRevenue = ticketsPerBox * pricePerDraw * boxCount;
  const costPerBox = prizes.reduce((sum, p) => sum + p.ticketCount * p.prizeValue, 0);
  const totalCost = costPerBox * boxCount;
  const profit = totalRevenue - totalCost;
  const marginPct = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  return {
    totalRevenuePerUnit: totalRevenue,
    totalCostPerUnit: totalCost,
    profitPerUnit: profit,
    marginPct,
    belowThreshold: marginPct < thresholdPct,
    thresholdPct,
  };
}

export function calcUnlimitedMargin(
  pricePerDraw: number,
  prizes: UnlimitedPrizeInput[],
  thresholdPct: number,
): MarginResult {
  const expectedPayout = prizes.reduce(
    (sum, p) => sum + (p.probabilityBps / PROBABILITY_TOTAL) * p.prizeValue,
    0,
  );
  const profit = pricePerDraw - expectedPayout;
  const marginPct = pricePerDraw > 0 ? (profit / pricePerDraw) * 100 : 0;

  return {
    totalRevenuePerUnit: pricePerDraw,
    totalCostPerUnit: Math.round(expectedPayout),
    profitPerUnit: Math.round(profit),
    marginPct,
    belowThreshold: marginPct < thresholdPct,
    thresholdPct,
  };
}

/**
 * Convert UI percentage (e.g., 0.5 meaning 0.5%) to basis points (5000).
 */
export function pctToBps(pct: number): number {
  return Math.round(pct * 10_000);
}

/**
 * Convert basis points to UI percentage.
 */
export function bpsToPct(bps: number): number {
  return bps / 10_000;
}
```

- [ ] **Step 2: Create MarginDisplay component**

```tsx
// admin/src/components/MarginDisplay.tsx
"use client";

import type { MarginResult } from "@/lib/margin-utils";

interface MarginDisplayProps {
  result: MarginResult | null;
  label?: string;
}

export function MarginDisplay({ result, label = "風控分析" }: MarginDisplayProps) {
  if (!result) return null;

  const color =
    result.marginPct < 0
      ? "text-red-600 bg-red-50 border-red-200"
      : result.belowThreshold
        ? "text-orange-600 bg-orange-50 border-orange-200"
        : "text-green-600 bg-green-50 border-green-200";

  return (
    <div className={`rounded-lg border p-4 ${color}`}>
      <h4 className="font-medium mb-2">{label}</h4>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>每抽營收</div>
        <div className="text-right">{result.totalRevenuePerUnit.toLocaleString()} 點</div>
        <div>每抽成本/期望支出</div>
        <div className="text-right">{result.totalCostPerUnit.toLocaleString()} 點</div>
        <div>每抽利潤</div>
        <div className="text-right">{result.profitPerUnit.toLocaleString()} 點</div>
        <div className="font-medium">毛利率</div>
        <div className="text-right font-medium">{result.marginPct.toFixed(2)}%</div>
      </div>
      {result.belowThreshold && (
        <p className="mt-2 text-sm font-medium">
          {result.marginPct < 0
            ? "⚠ 全部賣完仍虧損！賞品總成本超過總營收。"
            : `⚠ 毛利率低於 ${result.thresholdPct}% 警戒線。`}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run lint**

Run: `pnpm --filter admin lint`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add admin/src/lib/margin-utils.ts admin/src/components/MarginDisplay.tsx
git commit -m "feat: add shared margin utilities and MarginDisplay component for admin"
```

---

## Task 11: Admin Frontend — Create Page Updates

**Files:**
- Modify: `admin/src/app/(admin)/campaigns/create/page.tsx`

- [ ] **Step 1: Read current create page to understand existing structure**

Read the full file, especially:
- Unlimited form section
- Kuji margin warning logic (lines 77-99)
- How `prizePool` is currently submitted

- [ ] **Step 2: Update unlimited prize form to include `prizeValue`**

Add `prizeValue` number input to each row of the unlimited probability table. Label: "市場價值".

- [ ] **Step 3: Add real-time margin calculation**

Import `calcUnlimitedMargin` and `MarginDisplay`. On any prize value/probability change, recalculate margin and display the risk summary card. Fetch threshold from `GET /api/v1/admin/settings/risk` on mount.

- [ ] **Step 4: Add probability sum validation**

Show total probability in real-time. Disable submit button when sum ≠ 100%. Display clear error message.

- [ ] **Step 5: Update submission to use new contract**

Change `prizePool` to `prizeTable`, convert probability percentages to bps using `pctToBps()`, include `prizeValue` in each entry.

- [ ] **Step 6: Refactor kuji margin warnings to use shared utilities**

Replace inline margin calculation with `calcKujiMargin()` and `<MarginDisplay>` component. Preserve existing warning logic.

- [ ] **Step 7: Run lint and verify**

Run: `pnpm --filter admin lint`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add admin/src/app/(admin)/campaigns/create/page.tsx
git commit -m "feat: add prizeValue and risk analysis to unlimited campaign creation form"
```

---

## Task 12: Admin Frontend — Detail Page Updates

**Files:**
- Modify: `admin/src/app/(admin)/campaigns/[id]/page.tsx`

- [ ] **Step 1: Read current detail page**

Read the full file, especially the "尚未開放" section (~line 141-145).

- [ ] **Step 2: Replace placeholder with editable prize table (DRAFT only)**

For unlimited campaigns in DRAFT:
- Render editable table with columns: Grade, Name, Probability %, Market Value (prizeValue), Photo
- Show total probability with validation
- Show `<MarginDisplay>` card
- Add Save button → `PATCH /api/v1/admin/campaigns/unlimited/{id}/prize-table`

For ACTIVE campaigns: read-only table with margin display (informational).

- [ ] **Step 3: Add confirmLowMargin dialog to status transition**

When DRAFT → ACTIVE button is clicked:
1. Call `PATCH /api/v1/admin/campaigns/{id}/status` with `{ status: "ACTIVE" }`
2. If HTTP 422 → show confirmation dialog with margin info
3. User confirms → retry with `{ status: "ACTIVE", confirmLowMargin: true }`

- [ ] **Step 4: Run lint and verify**

Run: `pnpm --filter admin lint`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add admin/src/app/(admin)/campaigns/[id]/page.tsx
git commit -m "feat: editable prize table, risk display, and margin confirmation on detail page"
```

---

## Task 13: Integration Verification

- [ ] **Step 1: Run full server build with tests**

Run: `./gradlew build`
Expected: BUILD SUCCESSFUL, ALL TESTS PASS

- [ ] **Step 2: Run admin lint**

Run: `pnpm --filter admin lint`
Expected: No errors

- [ ] **Step 3: Start local environment and smoke test**

```bash
docker-compose -f infra/docker/docker-compose.yml up -d
```

Verify:
1. Migrations V021-V023 run successfully (check server logs)
2. Create unlimited campaign with prize table → response includes MarginResultDto
3. Edit prize table on detail page in DRAFT status
4. Attempt DRAFT → ACTIVE with low margin → get 422 → confirm → succeeds
5. Risk settings GET/PATCH works
6. Approve/reject endpoints return 409 (feature not enabled)

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: integration fixes from smoke testing"
```
