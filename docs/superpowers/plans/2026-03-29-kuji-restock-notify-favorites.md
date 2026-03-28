# Kuji Restock & Favorite Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to add new ticket boxes to existing KUJI campaigns, and notify favoriting players when a SOLD_OUT campaign is restocked.

**Architecture:** New `AddTicketBoxUseCase` follows the existing hexagonal pattern. The use case creates boxes + prize definitions, handles SOLD_OUT → ACTIVE transition, and fans out `FavoriteCampaignRestocked` domain events through the outbox pattern. OutboxWorker delivers in-app notifications + FCM push.

**Tech Stack:** Kotlin/Ktor, Exposed ORM, Koin DI, kotlinx.serialization, outbox pattern, Redis pub/sub, FCM

**Spec:** `docs/superpowers/specs/2026-03-29-kuji-restock-notify-favorites-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `server/src/main/kotlin/com/prizedraw/application/ports/input/admin/IAddTicketBoxUseCase.kt` | Input port interface |
| Create | `server/src/main/kotlin/com/prizedraw/application/usecases/admin/AddTicketBoxUseCase.kt` | Core business logic |
| Create | `server/src/test/kotlin/com/prizedraw/usecases/AddTicketBoxUseCaseTest.kt` | Unit tests |
| Modify | `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/endpoints/AdminEndpoints.kt` | Add `CAMPAIGN_BOXES` constant |
| Modify | `server/src/main/kotlin/com/prizedraw/application/events/DomainEvent.kt` | Add `FavoriteCampaignRestocked` |
| Modify | `server/src/main/kotlin/com/prizedraw/application/events/OutboxWorker.kt` | Handle new event type |
| *(removed)* | *`resetLowStockNotified` not needed — `saveKuji()` with `lowStockNotifiedAt = null` handles reset atomically* | |
| Modify | `server/src/main/kotlin/com/prizedraw/api/routes/AdminCampaignRoutes.kt` | Add POST boxes route |
| Modify | `server/src/main/kotlin/com/prizedraw/infrastructure/di/UseCaseModule.kt` | Register `AddTicketBoxUseCase` |

---

### Task 1: Add `FavoriteCampaignRestocked` Domain Event

**Files:**
- Modify: `server/src/main/kotlin/com/prizedraw/application/events/DomainEvent.kt`

- [ ] **Step 1: Add the event data class**

Append after the existing `FavoriteCampaignLowStock` class (around line 211):

```kotlin
/** Emitted when a sold-out kuji campaign is restocked and a favoriting player should be notified. */
public data class FavoriteCampaignRestocked(
    val campaignId: UUID,
    val campaignType: String,
    val campaignTitle: String,
    val playerId: UUID,
) : DomainEvent {
    override val eventType: String = "favorite.campaign_restocked"
    override val aggregateType: String = "Campaign"
    override val aggregateId: UUID = campaignId
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/ken/Project/PrizeDraw/PrizeDraw && ./gradlew :server:compileKotlin`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add server/src/main/kotlin/com/prizedraw/application/events/DomainEvent.kt
git commit -m "feat: add FavoriteCampaignRestocked domain event"
```

---

### Task 2: Add `CAMPAIGN_BOXES` Endpoint Constant

**Files:**
- Modify: `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/endpoints/AdminEndpoints.kt`

- [ ] **Step 1: Add constant**

In `AdminEndpoints.kt`, in the Campaigns section (after line 9 `CAMPAIGN_STATUS`), add:

```kotlin
    public const val CAMPAIGN_BOXES: String = "$BASE/campaigns/{campaignId}/boxes"
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/ken/Project/PrizeDraw/PrizeDraw && ./gradlew :api-contracts:compileKotlinJvm`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/endpoints/AdminEndpoints.kt
git commit -m "feat: add CAMPAIGN_BOXES admin endpoint constant"
```

---

### Task 3: Create `IAddTicketBoxUseCase` Interface

**Files:**
- Create: `server/src/main/kotlin/com/prizedraw/application/ports/input/admin/IAddTicketBoxUseCase.kt`

- [ ] **Step 1: Create the interface**

```kotlin
package com.prizedraw.application.ports.input.admin

import com.prizedraw.contracts.dto.admin.CreateKujiBoxRequest
import com.prizedraw.domain.entities.TicketBox
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.StaffId

/**
 * Input port for adding new ticket boxes to an existing KUJI campaign (restock).
 *
 * When the campaign is [CampaignStatus.SOLD_OUT], restocking transitions it back to ACTIVE
 * and notifies all players who favorited the campaign.
 */
public interface IAddTicketBoxUseCase {
    /**
     * Adds one or more ticket boxes to an existing KUJI campaign.
     *
     * @param staffId The staff member performing the restock.
     * @param campaignId The target KUJI campaign.
     * @param boxes The new ticket boxes to add.
     * @return The list of created [TicketBox] entities.
     * @throws IllegalArgumentException if campaign is not KUJI or status is invalid.
     */
    public suspend fun execute(
        staffId: StaffId,
        campaignId: CampaignId,
        boxes: List<CreateKujiBoxRequest>,
    ): List<TicketBox>
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/ken/Project/PrizeDraw/PrizeDraw && ./gradlew :server:compileKotlin`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add server/src/main/kotlin/com/prizedraw/application/ports/input/admin/IAddTicketBoxUseCase.kt
git commit -m "feat: add IAddTicketBoxUseCase input port interface"
```

---

### Task 4: Implement `AddTicketBoxUseCase`

**Files:**
- Create: `server/src/main/kotlin/com/prizedraw/application/usecases/admin/AddTicketBoxUseCase.kt`

**Reference files (read before implementing):**
- `server/src/main/kotlin/com/prizedraw/application/usecases/admin/CreateKujiCampaignUseCase.kt` — box + prize creation pattern
- `server/src/main/kotlin/com/prizedraw/application/usecases/admin/UpdateCampaignStatusUseCase.kt` — favorite notification fan-out pattern

- [ ] **Step 1: Write failing test**

Create `server/src/test/kotlin/com/prizedraw/usecases/AddTicketBoxUseCaseTest.kt`:

```kotlin
package com.prizedraw.usecases

import com.prizedraw.application.events.FavoriteCampaignRestocked
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.ICampaignFavoriteRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.INotificationRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.ITicketBoxRepository
import com.prizedraw.application.usecases.admin.AddTicketBoxUseCase
import com.prizedraw.contracts.dto.admin.CreateKujiBoxRequest
import com.prizedraw.contracts.dto.admin.CreateKujiTicketRangeRequest
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.entities.KujiCampaign
import com.prizedraw.domain.entities.TicketBox
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.StaffId
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.mockk.coEvery
import io.mockk.coJustRun
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.datetime.Clock
import java.util.UUID

class AddTicketBoxUseCaseTest : DescribeSpec({
    val campaignRepo = mockk<ICampaignRepository>()
    val ticketBoxRepo = mockk<ITicketBoxRepository>()
    val prizeRepo = mockk<IPrizeRepository>()
    val auditRepo = mockk<IAuditRepository>(relaxed = true)
    val favoriteRepo = mockk<ICampaignFavoriteRepository>()
    val notificationRepo = mockk<INotificationRepository>()
    val outboxRepo = mockk<IOutboxRepository>()

    val useCase = AddTicketBoxUseCase(
        campaignRepository = campaignRepo,
        ticketBoxRepository = ticketBoxRepo,
        prizeRepository = prizeRepo,
        auditRepository = auditRepo,
        favoriteRepo = favoriteRepo,
        notificationRepo = notificationRepo,
        outboxRepo = outboxRepo,
    )

    val staffId = StaffId(UUID.randomUUID())
    val campaignId = CampaignId(UUID.randomUUID())
    val now = Clock.System.now()

    fun makeCampaign(status: CampaignStatus) = KujiCampaign(
        id = campaignId,
        title = "Test Campaign",
        description = null,
        coverImageUrl = null,
        pricePerDraw = 100,
        drawSessionSeconds = 60,
        status = status,
        activatedAt = now,
        soldOutAt = if (status == CampaignStatus.SOLD_OUT) now else null,
        createdByStaffId = staffId.value,
        deletedAt = null,
        createdAt = now,
        updatedAt = now,
        lowStockNotifiedAt = if (status == CampaignStatus.SOLD_OUT) now else null,
    )

    val boxRequest = CreateKujiBoxRequest(
        name = "加開箱 A",
        totalTickets = 10,
        ticketRanges = listOf(
            CreateKujiTicketRangeRequest(
                grade = "A",
                prizeName = "大獎",
                rangeStart = 1,
                rangeEnd = 10,
                prizeValue = 500,
            ),
        ),
    )

    describe("execute") {
        it("should add boxes to a SOLD_OUT campaign and notify favorites") {
            val campaign = makeCampaign(CampaignStatus.SOLD_OUT)
            val playerId1 = UUID.randomUUID()
            val playerId2 = UUID.randomUUID()

            coEvery { campaignRepo.findKujiById(campaignId) } returns campaign
            coEvery { ticketBoxRepo.findByCampaignId(campaignId) } returns emptyList()
            coEvery { ticketBoxRepo.save(any()) } answers { firstArg() }
            coEvery { prizeRepo.saveDefinition(any()) } answers { firstArg() }
            coEvery { campaignRepo.saveKuji(any()) } answers { firstArg() }
            coEvery { favoriteRepo.findPlayerIdsByCampaign(CampaignType.KUJI, campaignId) } returns listOf(playerId1, playerId2)
            coJustRun { notificationRepo.batchInsertIgnore(any()) }
            coJustRun { outboxRepo.enqueue(any()) }

            val result = useCase.execute(staffId, campaignId, listOf(boxRequest))

            result.size shouldBe 1
            result[0].name shouldBe "加開箱 A"
            result[0].totalTickets shouldBe 10

            // Verify campaign status reset
            val savedCampaign = slot<KujiCampaign>()
            coVerify { campaignRepo.saveKuji(capture(savedCampaign)) }
            savedCampaign.captured.status shouldBe CampaignStatus.ACTIVE
            savedCampaign.captured.soldOutAt shouldBe null
            savedCampaign.captured.lowStockNotifiedAt shouldBe null

            // Verify notifications sent to both players
            coVerify(exactly = 1) { notificationRepo.batchInsertIgnore(match { it.size == 2 }) }
            coVerify(exactly = 2) { outboxRepo.enqueue(any<FavoriteCampaignRestocked>()) }
        }

        it("should add boxes to ACTIVE campaign without notification") {
            val campaign = makeCampaign(CampaignStatus.ACTIVE)

            coEvery { campaignRepo.findKujiById(campaignId) } returns campaign
            coEvery { ticketBoxRepo.findByCampaignId(campaignId) } returns emptyList()
            coEvery { ticketBoxRepo.save(any()) } answers { firstArg() }
            coEvery { prizeRepo.saveDefinition(any()) } answers { firstArg() }

            val result = useCase.execute(staffId, campaignId, listOf(boxRequest))

            result.size shouldBe 1

            // No status change, no notifications
            coVerify(exactly = 0) { campaignRepo.saveKuji(any()) }
            coVerify(exactly = 0) { notificationRepo.batchInsertIgnore(any()) }
            coVerify(exactly = 0) { outboxRepo.enqueue(any<FavoriteCampaignRestocked>()) }
        }

        it("should reject DRAFT campaign") {
            val campaign = makeCampaign(CampaignStatus.DRAFT)
            coEvery { campaignRepo.findKujiById(campaignId) } returns campaign

            shouldThrow<IllegalArgumentException> {
                useCase.execute(staffId, campaignId, listOf(boxRequest))
            }
        }

        it("should reject empty boxes list") {
            val campaign = makeCampaign(CampaignStatus.ACTIVE)
            coEvery { campaignRepo.findKujiById(campaignId) } returns campaign

            shouldThrow<IllegalArgumentException> {
                useCase.execute(staffId, campaignId, emptyList())
            }
        }

        it("should continue displayOrder from existing boxes") {
            val campaign = makeCampaign(CampaignStatus.ACTIVE)
            val existingBox = TicketBox(
                id = UUID.randomUUID(),
                kujiCampaignId = campaignId,
                name = "原始箱",
                totalTickets = 20,
                remainingTickets = 0,
                status = com.prizedraw.domain.entities.TicketBoxStatus.SOLD_OUT,
                soldOutAt = now,
                displayOrder = 2,
                createdAt = now,
                updatedAt = now,
            )

            coEvery { campaignRepo.findKujiById(campaignId) } returns campaign
            coEvery { ticketBoxRepo.findByCampaignId(campaignId) } returns listOf(existingBox)
            coEvery { ticketBoxRepo.save(any()) } answers { firstArg() }
            coEvery { prizeRepo.saveDefinition(any()) } answers { firstArg() }

            val result = useCase.execute(staffId, campaignId, listOf(boxRequest))

            result[0].displayOrder shouldBe 3
        }

        it("should send no notification when SOLD_OUT campaign has zero favorites") {
            val campaign = makeCampaign(CampaignStatus.SOLD_OUT)

            coEvery { campaignRepo.findKujiById(campaignId) } returns campaign
            coEvery { ticketBoxRepo.findByCampaignId(campaignId) } returns emptyList()
            coEvery { ticketBoxRepo.save(any()) } answers { firstArg() }
            coEvery { prizeRepo.saveDefinition(any()) } answers { firstArg() }
            coEvery { campaignRepo.saveKuji(any()) } answers { firstArg() }
            coEvery { favoriteRepo.findPlayerIdsByCampaign(CampaignType.KUJI, campaignId) } returns emptyList()

            useCase.execute(staffId, campaignId, listOf(boxRequest))

            coVerify(exactly = 0) { notificationRepo.batchInsertIgnore(any()) }
            coVerify(exactly = 0) { outboxRepo.enqueue(any<FavoriteCampaignRestocked>()) }
        }
    }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/ken/Project/PrizeDraw/PrizeDraw && ./gradlew :server:test --tests "com.prizedraw.usecases.AddTicketBoxUseCaseTest" --no-build-cache`
Expected: FAIL — `AddTicketBoxUseCase` class does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `server/src/main/kotlin/com/prizedraw/application/usecases/admin/AddTicketBoxUseCase.kt`:

```kotlin
package com.prizedraw.application.usecases.admin

import com.prizedraw.application.events.FavoriteCampaignRestocked
import com.prizedraw.application.ports.input.admin.IAddTicketBoxUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.ICampaignFavoriteRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.INotificationRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.ITicketBoxRepository
import com.prizedraw.contracts.dto.admin.CreateKujiBoxRequest
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.entities.Notification
import com.prizedraw.domain.entities.PrizeDefinition
import com.prizedraw.domain.entities.TicketBox
import com.prizedraw.domain.entities.TicketBoxStatus
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.domain.valueobjects.StaffId
import kotlinx.datetime.Clock
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.UUID

/**
 * Adds new ticket boxes to an existing KUJI campaign (restock).
 *
 * When the campaign is [CampaignStatus.SOLD_OUT], this use case transitions it back to
 * [CampaignStatus.ACTIVE], resets [lowStockNotifiedAt] and [soldOutAt], and notifies all
 * players who favorited the campaign.
 *
 * For [CampaignStatus.ACTIVE] campaigns, boxes are added without notification.
 */
public class AddTicketBoxUseCase(
    private val campaignRepository: ICampaignRepository,
    private val ticketBoxRepository: ITicketBoxRepository,
    private val prizeRepository: IPrizeRepository,
    private val auditRepository: IAuditRepository,
    private val favoriteRepo: ICampaignFavoriteRepository,
    private val notificationRepo: INotificationRepository,
    private val outboxRepo: IOutboxRepository,
) : IAddTicketBoxUseCase {
    override suspend fun execute(
        staffId: StaffId,
        campaignId: CampaignId,
        boxes: List<CreateKujiBoxRequest>,
    ): List<TicketBox> {
        val campaign = campaignRepository.findKujiById(campaignId)
            ?: throw AdminCampaignNotFoundException(campaignId.value.toString())

        require(campaign.status == CampaignStatus.ACTIVE || campaign.status == CampaignStatus.SOLD_OUT) {
            "Cannot add boxes to campaign with status ${campaign.status}; must be ACTIVE or SOLD_OUT."
        }
        require(boxes.isNotEmpty()) { "boxes must not be empty." }

        val wasSoldOut = campaign.status == CampaignStatus.SOLD_OUT
        val now = Clock.System.now()

        // Determine starting displayOrder
        val existingBoxes = ticketBoxRepository.findByCampaignId(campaignId)
        val startOrder = (existingBoxes.maxOfOrNull { it.displayOrder } ?: -1) + 1

        // Determine starting prizeDisplayOrder from existing definitions
        val existingPrizes = prizeRepository.findDefinitionsByCampaign(campaignId, CampaignType.KUJI)
        var prizeDisplayOrder = (existingPrizes.maxOfOrNull { it.displayOrder } ?: -1) + 1

        // Create boxes and prize definitions
        val createdBoxes = mutableListOf<TicketBox>()

        for ((boxIndex, boxReq) in boxes.withIndex()) {
            val ticketBox = TicketBox(
                id = UUID.randomUUID(),
                kujiCampaignId = campaignId,
                name = boxReq.name,
                totalTickets = boxReq.totalTickets,
                remainingTickets = boxReq.totalTickets,
                status = TicketBoxStatus.AVAILABLE,
                soldOutAt = null,
                displayOrder = startOrder + boxIndex,
                createdAt = now,
                updatedAt = now,
            )
            ticketBoxRepository.save(ticketBox)
            createdBoxes.add(ticketBox)

            for (rangeReq in boxReq.ticketRanges) {
                val ticketCount = rangeReq.rangeEnd - rangeReq.rangeStart + 1
                require(ticketCount > 0) {
                    "Invalid ticket range: ${rangeReq.rangeStart}-${rangeReq.rangeEnd}"
                }
                val photos = listOfNotNull(rangeReq.photoUrl)
                val prizeDefinition = PrizeDefinition(
                    id = PrizeDefinitionId(UUID.randomUUID()),
                    kujiCampaignId = campaignId,
                    unlimitedCampaignId = null,
                    grade = rangeReq.grade,
                    name = rangeReq.prizeName,
                    photos = photos,
                    prizeValue = rangeReq.prizeValue,
                    buybackPrice = 0,
                    buybackEnabled = true,
                    probabilityBps = null,
                    ticketCount = ticketCount,
                    displayOrder = prizeDisplayOrder++,
                    createdAt = now,
                    updatedAt = now,
                )
                prizeRepository.saveDefinition(prizeDefinition)
            }
        }

        // Handle SOLD_OUT → ACTIVE transition
        if (wasSoldOut) {
            val restored = campaign.copy(
                status = CampaignStatus.ACTIVE,
                soldOutAt = null,
                lowStockNotifiedAt = null,
                updatedAt = now,
            )
            campaignRepository.saveKuji(restored)
            notifyFavoritingPlayers(campaignId, campaign.title)
        }

        recordAudit(staffId, campaignId, createdBoxes.size, wasSoldOut)
        return createdBoxes
    }

    private suspend fun notifyFavoritingPlayers(
        campaignId: CampaignId,
        campaignTitle: String,
    ) {
        val playerIds = favoriteRepo.findPlayerIdsByCampaign(CampaignType.KUJI, campaignId)
        if (playerIds.isEmpty()) return

        val now = Clock.System.now().toEpochMilliseconds()
        val notifications = playerIds.map { playerId ->
            Notification(
                playerId = playerId,
                eventType = "favorite.campaign_restocked",
                title = "收藏的活動已加開",
                body = "你收藏的『$campaignTitle』已加開新箱，快來抽！",
                data = mapOf(
                    "campaignId" to campaignId.value.toString(),
                    "campaignType" to CampaignType.KUJI.name,
                ),
                dedupKey = "favorite.campaign_restocked:${campaignId.value}:$playerId:$now",
            )
        }
        notificationRepo.batchInsertIgnore(notifications)

        playerIds.forEach { playerId ->
            outboxRepo.enqueue(
                FavoriteCampaignRestocked(
                    campaignId = campaignId.value,
                    campaignType = CampaignType.KUJI.name,
                    campaignTitle = campaignTitle,
                    playerId = playerId,
                ),
            )
        }
    }

    private fun recordAudit(
        staffId: StaffId,
        campaignId: CampaignId,
        boxCount: Int,
        wasRestocked: Boolean,
    ) {
        auditRepository.record(
            AuditLog(
                id = UUID.randomUUID(),
                actorType = AuditActorType.STAFF,
                actorPlayerId = null,
                actorStaffId = staffId.value,
                action = "campaign.kuji.boxes_added",
                entityType = "KujiCampaign",
                entityId = campaignId.value,
                beforeValue = null,
                afterValue = buildJsonObject {
                    put("boxCount", boxCount)
                    put("restockedFromSoldOut", wasRestocked)
                },
                metadata = buildJsonObject { put("staffId", staffId.value.toString()) },
                createdAt = Clock.System.now(),
            ),
        )
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/ken/Project/PrizeDraw/PrizeDraw && ./gradlew :server:test --tests "com.prizedraw.usecases.AddTicketBoxUseCaseTest" --no-build-cache`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/main/kotlin/com/prizedraw/application/usecases/admin/AddTicketBoxUseCase.kt \
       server/src/test/kotlin/com/prizedraw/usecases/AddTicketBoxUseCaseTest.kt
git commit -m "feat: implement AddTicketBoxUseCase with restock notification"
```

---

### Task 5: Wire OutboxWorker for `favorite.campaign_restocked`

**Files:**
- Modify: `server/src/main/kotlin/com/prizedraw/application/events/OutboxWorker.kt`

**Reference:** Read OutboxWorker.kt before editing — specifically the `dispatch`, `notificationContent`, and FCM handler sections.

- [ ] **Step 1: Add notification content case**

In the `notificationContent` function, add a new case before the `else -> null` line:

```kotlin
"favorite.campaign_restocked" -> {
    val title = payload["campaignTitle"]?.jsonPrimitive?.content ?: ""
    "收藏的活動已加開" to "你收藏的『$title』已加開新箱，快來抽！"
}
```

- [ ] **Step 2: Add dispatch case**

In the `dispatch` function's `when` block, add before the `else` branch:

```kotlin
"favorite.campaign_restocked" -> handleFavoriteCampaignRestocked(event)
```

- [ ] **Step 3: Add FCM handler**

After the `handleFavoriteCampaignLowStock` method, add:

```kotlin
private suspend fun handleFavoriteCampaignRestocked(event: OutboxEvent) {
    val playerId = event.payload["playerId"]?.jsonPrimitive?.content ?: return
    val campaignId = event.payload["campaignId"]?.jsonPrimitive?.content ?: return
    val campaignType = event.payload["campaignType"]?.jsonPrimitive?.content ?: return
    val campaignTitle = event.payload["campaignTitle"]?.jsonPrimitive?.content ?: ""
    notificationService.sendPush(
        PlayerId.fromString(playerId),
        PushNotificationPayload(
            title = "收藏的活動已加開",
            body = "你收藏的『$campaignTitle』已加開新箱，快來抽！",
            data = mapOf(
                "eventType" to "favorite.campaign_restocked",
                "campaignId" to campaignId,
                "campaignType" to campaignType,
            ),
        ),
    )
}
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/ken/Project/PrizeDraw/PrizeDraw && ./gradlew :server:compileKotlin`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add server/src/main/kotlin/com/prizedraw/application/events/OutboxWorker.kt
git commit -m "feat: handle favorite.campaign_restocked in OutboxWorker"
```

---

### Task 6: Add Admin Route and Register DI

**Files:**
- Modify: `server/src/main/kotlin/com/prizedraw/api/routes/AdminCampaignRoutes.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/infrastructure/di/UseCaseModule.kt`

**Reference:** Read `AdminCampaignRoutes.kt` before editing — follow the existing route registration pattern (inject via `by inject()`, call use case, respond).

- [ ] **Step 1: Add route**

In `AdminCampaignRoutes.kt`, in the `adminCampaignMutationRoutes` function, add after the `patch(AdminEndpoints.CAMPAIGN_STATUS)` block:

```kotlin
val addTicketBox: IAddTicketBoxUseCase by inject()

post(AdminEndpoints.CAMPAIGN_BOXES) {
    val staff = call.requireStaff(StaffRole.OPERATOR) ?: return@post
    val campaignId = call.parseCampaignId() ?: return@post
    val boxes = call.receive<List<CreateKujiBoxRequest>>()
    runCatching {
        addTicketBox.execute(
            staffId = staff.staffId,
            campaignId = campaignId,
            boxes = boxes,
        )
    }.fold(
        onSuccess = { created -> call.respond(HttpStatusCode.Created, created.map { it.toDto() }) },
        onFailure = { e -> call.respondError(e) },
    )
}
```

Add the missing imports at the top:

```kotlin
import com.prizedraw.application.ports.input.admin.IAddTicketBoxUseCase
import com.prizedraw.contracts.dto.admin.CreateKujiBoxRequest
```

- [ ] **Step 2: Register in Koin module**

In `UseCaseModule.kt`, after the `single<IUpdateCampaignUseCase>` block (around line 500), add:

```kotlin
single<IAddTicketBoxUseCase> {
    AddTicketBoxUseCase(
        campaignRepository = get<ICampaignRepository>(),
        ticketBoxRepository = get<ITicketBoxRepository>(),
        prizeRepository = get<IPrizeRepository>(),
        auditRepository = get<IAuditRepository>(),
        favoriteRepo = get(),
        notificationRepo = get(),
        outboxRepo = get(),
    )
}
```

Add the missing imports:

```kotlin
import com.prizedraw.application.ports.input.admin.IAddTicketBoxUseCase
import com.prizedraw.application.usecases.admin.AddTicketBoxUseCase
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/ken/Project/PrizeDraw/PrizeDraw && ./gradlew :server:compileKotlin`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Run full test suite**

Run: `cd /Users/ken/Project/PrizeDraw/PrizeDraw && ./gradlew :server:test --no-build-cache`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/main/kotlin/com/prizedraw/api/routes/AdminCampaignRoutes.kt \
       server/src/main/kotlin/com/prizedraw/infrastructure/di/UseCaseModule.kt
git commit -m "feat: add POST /admin/campaigns/{campaignId}/boxes route and DI registration"
```

---

### Task 7: Lint and Final Verification

- [ ] **Step 1: Run ktlint**

Run: `cd /Users/ken/Project/PrizeDraw/PrizeDraw && ./gradlew ktlintCheck`
Expected: BUILD SUCCESSFUL (no violations)

If violations found, run: `./gradlew ktlintFormat` and commit fixes.

- [ ] **Step 2: Run detekt**

Run: `cd /Users/ken/Project/PrizeDraw/PrizeDraw && ./gradlew detekt`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Run full test suite one more time**

Run: `cd /Users/ken/Project/PrizeDraw/PrizeDraw && ./gradlew :server:test --no-build-cache`
Expected: All tests PASS

- [ ] **Step 4: Commit any lint fixes if needed**

```bash
git add -A
git commit -m "style: fix lint issues for kuji restock feature"
```
