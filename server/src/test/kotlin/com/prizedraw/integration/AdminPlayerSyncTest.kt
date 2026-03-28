package com.prizedraw.integration

import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.IFeatureFlagRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.ISystemSettingsRepository
import com.prizedraw.application.ports.output.ITicketBoxRepository
import com.prizedraw.application.usecases.admin.ManageAnimationModesUseCase
import com.prizedraw.application.usecases.admin.TRADE_FEE_RATE_CONFIG_KEY
import com.prizedraw.application.usecases.admin.UpdateBuybackPriceUseCase
import com.prizedraw.application.usecases.admin.UpdateCampaignStatusUseCase
import com.prizedraw.application.usecases.admin.UpdateCampaignUseCase
import com.prizedraw.application.usecases.admin.UpdateTradeFeeRateUseCase
import com.prizedraw.application.usecases.admin.UpdateUnlimitedPrizeTableUseCase
import com.prizedraw.application.usecases.admin.toFlagKey
import com.prizedraw.contracts.dto.admin.UnlimitedPrizeEntryRequest
import com.prizedraw.contracts.dto.admin.UpdatePrizeTableRequest
import com.prizedraw.contracts.enums.ApprovalStatus
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.domain.entities.FeatureFlag
import com.prizedraw.domain.entities.KujiCampaign
import com.prizedraw.domain.entities.PrizeDefinition
import com.prizedraw.domain.entities.UnlimitedCampaign
import com.prizedraw.domain.services.MarginResult
import com.prizedraw.domain.services.MarginRiskService
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.domain.valueobjects.StaffId
import com.prizedraw.testutil.TransactionTestHelper
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.booleans.shouldBeFalse
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.runs
import io.mockk.slot
import kotlinx.datetime.Clock
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.math.BigDecimal
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Integration tests verifying that admin mutations are correctly reflected in player-facing
 * queries and use-case responses.
 *
 * Each test follows the pattern:
 * 1. Set up initial state using an admin use case.
 * 2. Invoke the player-facing query or use case that reads from the same repository.
 * 3. Assert that the player view reflects the admin change.
 * 4. Shared mocks are reset after each test via [clearAllMocks].
 *
 * All repository interactions use in-memory MockK stubs — no real database required.
 */
class AdminPlayerSyncTest :
    DescribeSpec({

        val now = Clock.System.now()
        val staffId = StaffId.generate()

        // ---------------------------------------------------------------------------
        // Domain fixture builders
        // ---------------------------------------------------------------------------

        fun makeKujiCampaign(
            id: CampaignId = CampaignId.generate(),
            title: String = "Original Title",
            status: CampaignStatus = CampaignStatus.DRAFT,
        ): KujiCampaign =
            KujiCampaign(
                id = id,
                title = title,
                description = null,
                coverImageUrl = null,
                pricePerDraw = 100,
                drawSessionSeconds = 300,
                status = status,
                activatedAt = if (status == CampaignStatus.ACTIVE) now else null,
                soldOutAt = null,
                createdByStaffId = UUID.randomUUID(),
                deletedAt = null,
                createdAt = now,
                updatedAt = now,
                approvalStatus = ApprovalStatus.NOT_REQUIRED,
            )

        fun makeUnlimitedCampaign(
            id: CampaignId = CampaignId.generate(),
            title: String = "Unlimited Original",
            status: CampaignStatus = CampaignStatus.DRAFT,
            pricePerDraw: Int = 50,
        ): UnlimitedCampaign =
            UnlimitedCampaign(
                id = id,
                title = title,
                description = null,
                coverImageUrl = null,
                pricePerDraw = pricePerDraw,
                rateLimitPerSecond = Int.MAX_VALUE,
                status = status,
                activatedAt = if (status == CampaignStatus.ACTIVE) now else null,
                createdByStaffId = UUID.randomUUID(),
                deletedAt = null,
                createdAt = now,
                updatedAt = now,
                approvalStatus = ApprovalStatus.NOT_REQUIRED,
            )

        fun makePrizeDefinition(
            campaignId: CampaignId,
            buybackPrice: Int = 100,
            buybackEnabled: Boolean = true,
            probabilityBps: Int? = null,
        ): PrizeDefinition =
            PrizeDefinition(
                id = PrizeDefinitionId.generate(),
                kujiCampaignId = if (probabilityBps == null) campaignId else null,
                unlimitedCampaignId = if (probabilityBps != null) campaignId else null,
                grade = "A賞",
                name = "Test Prize",
                photos = listOf("https://cdn.example.com/prize.jpg"),
                prizeValue = 500,
                buybackPrice = buybackPrice,
                buybackEnabled = buybackEnabled,
                probabilityBps = probabilityBps,
                ticketCount = if (probabilityBps == null) 5 else null,
                displayOrder = 0,
                createdAt = now,
                updatedAt = now,
            )

        fun makeFeatureFlag(
            name: String,
            enabled: Boolean,
            rules: JsonObject = JsonObject(emptyMap()),
        ): FeatureFlag =
            FeatureFlag(
                id = UUID.randomUUID(),
                name = name,
                displayName = name,
                description = null,
                enabled = enabled,
                rules = rules,
                updatedByStaffId = staffId.value,
                createdAt = now,
                updatedAt = now,
            )

        // ---------------------------------------------------------------------------
        // Lifecycle setup
        // ---------------------------------------------------------------------------

        beforeSpec { TransactionTestHelper.mockTransactions() }

        afterSpec { TransactionTestHelper.unmockTransactions() }

        beforeEach { TransactionTestHelper.stubTransaction() }

        afterEach { clearAllMocks() }

        // ---------------------------------------------------------------------------
        // Campaign title / metadata sync
        // ---------------------------------------------------------------------------

        describe("Campaign metadata admin-to-player sync") {

            it("Campaign title update is reflected in player campaign list query") {
                // Admin updates the kuji campaign title.  The player then reads
                // the active campaign list, which must return the new title.
                val campaignId = CampaignId.generate()
                val original = makeKujiCampaign(id = campaignId, title = "Old Title")

                // In-memory store simulating the campaigns table.
                val store = ConcurrentHashMap<CampaignId, KujiCampaign>()
                store[campaignId] = original

                val campaignRepo = mockk<ICampaignRepository>()
                val auditRepo = mockk<IAuditRepository>()

                coEvery { campaignRepo.findKujiById(campaignId) } answers { store[campaignId] }
                coEvery { campaignRepo.saveKuji(any()) } answers {
                    val saved = firstArg<KujiCampaign>()
                    store[saved.id] = saved
                    saved
                }
                every { auditRepo.record(any()) } just runs

                val updateUseCase = UpdateCampaignUseCase(campaignRepo, auditRepo)
                updateUseCase.execute(
                    staffId = staffId,
                    campaignId = campaignId,
                    campaignType = CampaignType.KUJI,
                    title = "New Title",
                    description = null,
                    coverImageUrl = null,
                    confirmProbabilityUpdate = false,
                )

                // Player-side: read active campaigns from the same store.
                coEvery { campaignRepo.findActiveKujiCampaigns() } answers {
                    store.values.filter { it.status == CampaignStatus.ACTIVE }.toList()
                }

                // Mark campaign active directly in store to simulate it being live.
                store[campaignId] = store[campaignId]!!.copy(status = CampaignStatus.ACTIVE)

                val playerVisibleCampaigns = campaignRepo.findActiveKujiCampaigns()

                playerVisibleCampaigns shouldHaveSize 1
                playerVisibleCampaigns.first().title shouldBe "New Title"
            }

            it("Campaign status ACTIVE makes campaign visible in player list") {
                // Admin activates a DRAFT campaign.  The player query for active campaigns
                // must include it afterwards.
                val campaignId = CampaignId.generate()
                val draft = makeKujiCampaign(id = campaignId, status = CampaignStatus.DRAFT)

                val store = ConcurrentHashMap<CampaignId, KujiCampaign>()
                store[campaignId] = draft

                val campaignRepo = mockk<ICampaignRepository>()
                val ticketBoxRepo = mockk<ITicketBoxRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val auditRepo = mockk<IAuditRepository>()
                val settingsRepo = mockk<ISystemSettingsRepository>()

                coEvery { campaignRepo.findKujiById(campaignId) } answers { store[campaignId] }
                coEvery { campaignRepo.updateKujiStatus(campaignId, any()) } answers {
                    val newStatus = secondArg<CampaignStatus>()
                    store[campaignId] = store[campaignId]!!.copy(status = newStatus)
                }
                coEvery { ticketBoxRepo.findByCampaignId(campaignId) } returns
                    listOf(
                        com.prizedraw.domain.entities.TicketBox(
                            id = UUID.randomUUID(),
                            kujiCampaignId = campaignId,
                            name = "Box 1",
                            totalTickets = 10,
                            remainingTickets = 10,
                            status = com.prizedraw.domain.entities.TicketBoxStatus.AVAILABLE,
                            soldOutAt = null,
                            displayOrder = 1,
                            createdAt = now,
                            updatedAt = now,
                        ),
                    )
                coEvery { prizeRepo.findDefinitionsByCampaign(campaignId, CampaignType.KUJI) } returns
                    listOf(makePrizeDefinition(campaignId))
                coEvery { settingsRepo.getMarginThresholdPct() } returns BigDecimal("30.0")
                every { auditRepo.record(any()) } just runs

                val marginRiskService = mockk<MarginRiskService>()
                coEvery { marginRiskService.calculateKujiMargin(any(), any(), any(), any()) } returns
                    MarginResult(
                        totalRevenuePerUnit = 500,
                        totalCostPerUnit = 300,
                        profitPerUnit = 200,
                        marginPct = BigDecimal("40.0"),
                        belowThreshold = false,
                        thresholdPct = BigDecimal("30.0"),
                    )

                val statusUseCase =
                    UpdateCampaignStatusUseCase(
                        campaignRepository = campaignRepo,
                        ticketBoxRepository = ticketBoxRepo,
                        prizeRepository = prizeRepo,
                        auditRepository = auditRepo,
                        marginRiskService = marginRiskService,
                        settingsRepository = settingsRepo,
                        favoriteRepo = mockk(relaxed = true),
                        notificationRepo = mockk(relaxed = true),
                        outboxRepo = mockk(relaxed = true),
                    )

                statusUseCase.execute(
                    staffId = staffId,
                    campaignId = campaignId,
                    campaignType = CampaignType.KUJI,
                    newStatus = CampaignStatus.ACTIVE,
                    confirmLowMargin = false,
                )

                // Player query returns campaigns from the same store.
                coEvery { campaignRepo.findActiveKujiCampaigns() } answers {
                    store.values.filter { it.status == CampaignStatus.ACTIVE }.toList()
                }

                val playerVisibleCampaigns = campaignRepo.findActiveKujiCampaigns()
                playerVisibleCampaigns shouldHaveSize 1
                playerVisibleCampaigns.first().id shouldBe campaignId
                playerVisibleCampaigns.first().status shouldBe CampaignStatus.ACTIVE
            }

            it("Campaign status SUSPENDED removes campaign from player list") {
                // Admin suspends an ACTIVE campaign.  The player query must no longer return it.
                val campaignId = CampaignId.generate()
                val active = makeKujiCampaign(id = campaignId, status = CampaignStatus.ACTIVE)

                val store = ConcurrentHashMap<CampaignId, KujiCampaign>()
                store[campaignId] = active

                val campaignRepo = mockk<ICampaignRepository>()
                val ticketBoxRepo = mockk<ITicketBoxRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val auditRepo = mockk<IAuditRepository>()
                val settingsRepo = mockk<ISystemSettingsRepository>()
                val marginRiskService = mockk<MarginRiskService>()

                coEvery { campaignRepo.findKujiById(campaignId) } answers { store[campaignId] }
                coEvery { campaignRepo.updateKujiStatus(campaignId, any()) } answers {
                    val newStatus = secondArg<CampaignStatus>()
                    store[campaignId] = store[campaignId]!!.copy(status = newStatus)
                }
                every { auditRepo.record(any()) } just runs

                val statusUseCase =
                    UpdateCampaignStatusUseCase(
                        campaignRepository = campaignRepo,
                        ticketBoxRepository = ticketBoxRepo,
                        prizeRepository = prizeRepo,
                        auditRepository = auditRepo,
                        marginRiskService = marginRiskService,
                        settingsRepository = settingsRepo,
                        favoriteRepo = mockk(relaxed = true),
                        notificationRepo = mockk(relaxed = true),
                        outboxRepo = mockk(relaxed = true),
                    )

                statusUseCase.execute(
                    staffId = staffId,
                    campaignId = campaignId,
                    campaignType = CampaignType.KUJI,
                    newStatus = CampaignStatus.SUSPENDED,
                    confirmLowMargin = false,
                )

                // Player query filters to ACTIVE only.
                coEvery { campaignRepo.findActiveKujiCampaigns() } answers {
                    store.values.filter { it.status == CampaignStatus.ACTIVE }.toList()
                }

                val playerVisibleCampaigns = campaignRepo.findActiveKujiCampaigns()
                playerVisibleCampaigns.shouldBeEmpty()
            }
        }

        // ---------------------------------------------------------------------------
        // Buyback price sync
        // ---------------------------------------------------------------------------

        describe("Buyback price admin-to-player sync") {

            it("Buyback price update is reflected in player prize detail") {
                // Admin changes the buyback price.  The player's getOne() call must
                // observe the updated definition (which holds buybackPrice).
                val campaignId = CampaignId.generate()
                val original = makePrizeDefinition(campaignId, buybackPrice = 100)

                val defStore = ConcurrentHashMap<PrizeDefinitionId, PrizeDefinition>()
                defStore[original.id] = original

                val prizeRepo = mockk<IPrizeRepository>()
                val auditRepo = mockk<IAuditRepository>()

                coEvery { prizeRepo.findDefinitionById(original.id) } answers { defStore[original.id] }
                coEvery { prizeRepo.saveDefinition(any()) } answers {
                    val saved = firstArg<PrizeDefinition>()
                    defStore[saved.id] = saved
                    saved
                }
                every { auditRepo.record(any()) } just runs

                val updateBuyback = UpdateBuybackPriceUseCase(prizeRepo, auditRepo)
                updateBuyback.execute(
                    staffId = staffId,
                    prizeDefinitionId = original.id,
                    buybackPrice = 250,
                    buybackEnabled = true,
                )

                // Player reads the definition (e.g. via getPrizeDetail).
                val playerView = prizeRepo.findDefinitionById(original.id)

                playerView!!.buybackPrice shouldBe 250
                playerView.buybackEnabled.shouldBeTrue()
            }

            it("Buyback disabled hides buyback option from player") {
                // Admin disables buyback on a prize definition.  The player-facing
                // read of that definition must have buybackEnabled=false.
                val campaignId = CampaignId.generate()
                val original = makePrizeDefinition(campaignId, buybackPrice = 100, buybackEnabled = true)

                val defStore = ConcurrentHashMap<PrizeDefinitionId, PrizeDefinition>()
                defStore[original.id] = original

                val prizeRepo = mockk<IPrizeRepository>()
                val auditRepo = mockk<IAuditRepository>()

                coEvery { prizeRepo.findDefinitionById(original.id) } answers { defStore[original.id] }
                coEvery { prizeRepo.saveDefinition(any()) } answers {
                    val saved = firstArg<PrizeDefinition>()
                    defStore[saved.id] = saved
                    saved
                }
                every { auditRepo.record(any()) } just runs

                val updateBuyback = UpdateBuybackPriceUseCase(prizeRepo, auditRepo)
                updateBuyback.execute(
                    staffId = staffId,
                    prizeDefinitionId = original.id,
                    buybackPrice = 0,
                    buybackEnabled = false,
                )

                val playerView = prizeRepo.findDefinitionById(original.id)

                playerView!!.buybackEnabled.shouldBeFalse()
                playerView.buybackPrice shouldBe 0
            }
        }

        // ---------------------------------------------------------------------------
        // Trade fee rate sync
        // ---------------------------------------------------------------------------

        describe("Trade fee rate admin-to-player sync") {

            it("Trade fee rate update affects new trade listing fee rate stored in flag") {
                // Admin updates the fee rate to 300 bps.  The flag repository must
                // subsequently return the new rate under the canonical config key.
                val flagStore = ConcurrentHashMap<String, FeatureFlag>()

                val featureFlagRepo = mockk<IFeatureFlagRepository>()
                val auditRepo = mockk<IAuditRepository>()

                coEvery { featureFlagRepo.findByName(TRADE_FEE_RATE_CONFIG_KEY) } answers {
                    flagStore[TRADE_FEE_RATE_CONFIG_KEY]
                }
                coEvery { featureFlagRepo.save(any()) } answers {
                    val saved = firstArg<FeatureFlag>()
                    flagStore[saved.name] = saved
                    saved
                }
                every { auditRepo.record(any()) } just runs

                val updateFeeRate = UpdateTradeFeeRateUseCase(featureFlagRepo, auditRepo)
                val returnedRate = updateFeeRate.execute(staffId = staffId, tradeFeeRateBps = 300)

                returnedRate shouldBe 300

                // Verify the flag is persisted with the new rate value.
                val savedFlag = flagStore[TRADE_FEE_RATE_CONFIG_KEY]!!
                savedFlag.rules["value"] shouldBe JsonPrimitive(300)
            }
        }

        // ---------------------------------------------------------------------------
        // Animation mode sync
        // ---------------------------------------------------------------------------

        describe("Animation mode admin-to-player sync") {

            it("Animation mode disabled is excluded from player animation options") {
                // Admin disables TEAR mode.  The getAllModeStates query (called by the
                // player animation options endpoint) must return TEAR=false.
                val flagStore = ConcurrentHashMap<String, FeatureFlag>()

                val featureFlagRepo = mockk<IFeatureFlagRepository>()
                val auditRepo = mockk<IAuditRepository>()

                // Seed all modes as enabled before the admin disables TEAR.
                DrawAnimationMode.entries.forEach { mode ->
                    flagStore[mode.toFlagKey()] = makeFeatureFlag(mode.toFlagKey(), enabled = true)
                }

                coEvery { featureFlagRepo.findByName(any()) } answers { flagStore[firstArg()] }
                coEvery { featureFlagRepo.save(any()) } answers {
                    val saved = firstArg<FeatureFlag>()
                    flagStore[saved.name] = saved
                    saved
                }
                every { featureFlagRepo.isEnabled(any()) } answers { flagStore[firstArg()]?.enabled ?: false }
                every { auditRepo.record(any()) } just runs

                val manageAnimations = ManageAnimationModesUseCase(featureFlagRepo, auditRepo)
                val resultAfterDisable =
                    manageAnimations.setModeEnabled(
                        staffId = staffId,
                        mode = DrawAnimationMode.TEAR,
                        enabled = false,
                    )

                // Player-facing query: getAllModeStates returns the current map.
                resultAfterDisable[DrawAnimationMode.TEAR] shouldBe false
                resultAfterDisable[DrawAnimationMode.SCRATCH] shouldBe true
                resultAfterDisable[DrawAnimationMode.FLIP] shouldBe true
                resultAfterDisable[DrawAnimationMode.INSTANT] shouldBe true
            }

            it("Re-enabling a disabled animation mode makes it available again") {
                // Admin disables SCRATCH then re-enables it.  The final player view
                // must show SCRATCH=true.
                val flagStore = ConcurrentHashMap<String, FeatureFlag>()

                val featureFlagRepo = mockk<IFeatureFlagRepository>()
                val auditRepo = mockk<IAuditRepository>()

                DrawAnimationMode.entries.forEach { mode ->
                    flagStore[mode.toFlagKey()] = makeFeatureFlag(mode.toFlagKey(), enabled = true)
                }

                coEvery { featureFlagRepo.findByName(any()) } answers { flagStore[firstArg()] }
                coEvery { featureFlagRepo.save(any()) } answers {
                    val saved = firstArg<FeatureFlag>()
                    flagStore[saved.name] = saved
                    saved
                }
                every { featureFlagRepo.isEnabled(any()) } answers { flagStore[firstArg()]?.enabled ?: false }
                every { auditRepo.record(any()) } just runs

                val manageAnimations = ManageAnimationModesUseCase(featureFlagRepo, auditRepo)

                manageAnimations.setModeEnabled(staffId = staffId, mode = DrawAnimationMode.SCRATCH, enabled = false)
                val finalStates =
                    manageAnimations.setModeEnabled(
                        staffId = staffId,
                        mode = DrawAnimationMode.SCRATCH,
                        enabled = true,
                    )

                finalStates[DrawAnimationMode.SCRATCH] shouldBe true
            }
        }

        // ---------------------------------------------------------------------------
        // Unlimited prize table sync
        // ---------------------------------------------------------------------------

        describe("Unlimited prize table admin-to-player sync") {

            it("Unlimited prize table update is reflected in player draw probabilities") {
                // Admin replaces the prize table on a DRAFT unlimited campaign.
                // The player-facing getPrizeDefinitions call (findDefinitionsByCampaign)
                // must return the new definitions with updated probability values.
                val campaignId = CampaignId.generate()
                val campaign = makeUnlimitedCampaign(id = campaignId, pricePerDraw = 50)

                // Prize definition in-memory store.
                val defStore = ConcurrentHashMap<CampaignId, List<PrizeDefinition>>()
                defStore[campaignId] = emptyList()

                val campaignRepo = mockk<ICampaignRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val marginRiskService = mockk<MarginRiskService>()
                val settingsRepo = mockk<ISystemSettingsRepository>()

                coEvery { campaignRepo.findUnlimitedById(campaignId) } returns campaign
                coEvery { prizeRepo.deleteByUnlimitedCampaignId(campaignId) } answers {
                    defStore[campaignId] = emptyList()
                }
                val savedDefs = slot<List<PrizeDefinition>>()
                coEvery { prizeRepo.saveAll(capture(savedDefs)) } answers {
                    defStore[campaignId] = savedDefs.captured
                }
                coEvery { settingsRepo.getMarginThresholdPct() } returns BigDecimal("30.0")
                coEvery { marginRiskService.calculateUnlimitedMargin(any(), any(), any()) } returns
                    MarginResult(
                        totalRevenuePerUnit = 250,
                        totalCostPerUnit = 100,
                        profitPerUnit = 150,
                        marginPct = BigDecimal("60.0"),
                        belowThreshold = false,
                        thresholdPct = BigDecimal("30.0"),
                    )

                val updatePrizeTable =
                    UpdateUnlimitedPrizeTableUseCase(
                        campaignRepository = campaignRepo,
                        prizeRepository = prizeRepo,
                        marginRiskService = marginRiskService,
                        settingsRepository = settingsRepo,
                    )

                updatePrizeTable.execute(
                    campaignId = campaignId,
                    request =
                        UpdatePrizeTableRequest(
                            prizeTable =
                                listOf(
                                    UnlimitedPrizeEntryRequest(
                                        grade = "A賞",
                                        name = "Grand Prize",
                                        probabilityBps = 10_000,
                                        prizeValue = 2000,
                                        photoUrl = "https://cdn.example.com/a.jpg",
                                        displayOrder = 1,
                                    ),
                                    UnlimitedPrizeEntryRequest(
                                        grade = "B賞",
                                        name = "Standard Prize",
                                        probabilityBps = 990_000,
                                        prizeValue = 100,
                                        photoUrl = "https://cdn.example.com/b.jpg",
                                        displayOrder = 2,
                                    ),
                                ),
                        ),
                    staffId = staffId,
                )

                // Player-facing read: simulate repository returning the stored defs.
                coEvery {
                    prizeRepo.findDefinitionsByCampaign(campaignId, CampaignType.UNLIMITED)
                } answers { defStore[campaignId] ?: emptyList() }

                val playerViewDefs = prizeRepo.findDefinitionsByCampaign(campaignId, CampaignType.UNLIMITED)

                playerViewDefs shouldHaveSize 2
                val gradeA = playerViewDefs.first { it.grade == "A賞" }
                val gradeB = playerViewDefs.first { it.grade == "B賞" }
                gradeA.probabilityBps shouldBe 10_000
                gradeB.probabilityBps shouldBe 990_000
            }
        }
    })
