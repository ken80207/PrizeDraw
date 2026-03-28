package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.output.ICampaignGradeRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.IGradeTemplateRepository
import com.prizedraw.contracts.dto.grade.ApplyMode
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.domain.entities.CampaignGrade
import com.prizedraw.domain.entities.GradeTemplate
import com.prizedraw.domain.entities.GradeTemplateItem
import com.prizedraw.domain.entities.KujiCampaign
import com.prizedraw.domain.valueobjects.CampaignGradeId
import com.prizedraw.domain.valueobjects.CampaignId
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.datetime.Clock
import java.util.UUID

class CampaignGradeUseCasesTest :
    DescribeSpec({

        val campaignRepo = mockk<ICampaignRepository>()
        val gradeRepo = mockk<ICampaignGradeRepository>()
        val templateRepo = mockk<IGradeTemplateRepository>()

        val useCases = CampaignGradeUseCases(campaignRepo, gradeRepo, templateRepo)

        val now = Clock.System.now()
        val campaignId = CampaignId.generate()
        val templateId = UUID.randomUUID()

        beforeTest { clearAllMocks() }

        fun makeKujiCampaign(id: CampaignId): KujiCampaign =
            KujiCampaign(
                id = id,
                title = "Test Kuji",
                description = null,
                coverImageUrl = null,
                pricePerDraw = 100,
                drawSessionSeconds = 30,
                status = CampaignStatus.DRAFT,
                activatedAt = null,
                soldOutAt = null,
                lowStockNotifiedAt = null,
                createdByStaffId = UUID.randomUUID(),
                deletedAt = null,
                createdAt = now,
                updatedAt = now,
            )

        fun makeTemplate(vararg names: String): GradeTemplate {
            val id = templateId
            return GradeTemplate(
                id = id,
                name = "My Template",
                createdByStaffId = UUID.randomUUID(),
                items =
                    names.mapIndexed { idx, name ->
                        GradeTemplateItem(
                            id = UUID.randomUUID(),
                            templateId = id,
                            name = name,
                            displayOrder = idx,
                            colorCode = "#FFD700",
                            bgColorCode = "#FFF8E1",
                        )
                    },
                createdAt = now,
                updatedAt = now,
            )
        }

        describe("applyTemplate — REPLACE mode") {
            it("copies template items to campaign with correct kujiCampaignId FK") {
                val template = makeTemplate("SSR", "SR", "R")

                coEvery { templateRepo.findById(templateId) } returns template
                coEvery { campaignRepo.findKujiById(campaignId) } returns makeKujiCampaign(campaignId)
                coEvery { gradeRepo.findByCampaignId(campaignId) } returns emptyList()

                val savedSlot = slot<List<CampaignGrade>>()
                coEvery { gradeRepo.replaceAll(campaignId, capture(savedSlot)) } answers { savedSlot.captured }

                val result = useCases.applyTemplate(campaignId, templateId, ApplyMode.REPLACE)

                coVerify(exactly = 1) { gradeRepo.replaceAll(campaignId, any()) }

                result shouldHaveSize 3
                result[0].name shouldBe "SSR"
                result[0].kujiCampaignId shouldBe campaignId
                result[0].unlimitedCampaignId shouldBe null
                result[1].name shouldBe "SR"
                result[2].name shouldBe "R"
            }

            it("copies template items to campaign with correct unlimitedCampaignId FK for unlimited campaigns") {
                val template = makeTemplate("A", "B")

                coEvery { templateRepo.findById(templateId) } returns template
                coEvery { campaignRepo.findKujiById(campaignId) } returns null
                coEvery { gradeRepo.findByCampaignId(campaignId) } returns emptyList()

                val savedSlot = slot<List<CampaignGrade>>()
                coEvery { gradeRepo.replaceAll(campaignId, capture(savedSlot)) } answers { savedSlot.captured }

                val result = useCases.applyTemplate(campaignId, templateId, ApplyMode.REPLACE)

                result shouldHaveSize 2
                result[0].unlimitedCampaignId shouldBe campaignId
                result[0].kujiCampaignId shouldBe null
            }

            it("throws when template not found") {
                coEvery { templateRepo.findById(templateId) } returns null

                shouldThrow<IllegalArgumentException> {
                    useCases.applyTemplate(campaignId, templateId, ApplyMode.REPLACE)
                }
            }

            it("throws when existing grades have prize references") {
                val template = makeTemplate("SSR")
                val existingGradeId = CampaignGradeId.generate()
                val existingGrade =
                    CampaignGrade(
                        id = existingGradeId,
                        kujiCampaignId = campaignId,
                        unlimitedCampaignId = null,
                        name = "Old Grade",
                        displayOrder = 0,
                        colorCode = "#FFFFFF",
                        bgColorCode = "#000000",
                        createdAt = now,
                        updatedAt = now,
                    )

                coEvery { templateRepo.findById(templateId) } returns template
                coEvery { campaignRepo.findKujiById(campaignId) } returns makeKujiCampaign(campaignId)
                coEvery { gradeRepo.findByCampaignId(campaignId) } returns listOf(existingGrade)
                coEvery { gradeRepo.countPrizeReferences(existingGradeId) } returns 3L

                shouldThrow<IllegalStateException> {
                    useCases.applyTemplate(campaignId, templateId, ApplyMode.REPLACE)
                }
            }
        }

        describe("applyTemplate — MERGE mode") {
            it("adds only new grades that do not exist by name") {
                val template = makeTemplate("Existing", "New Grade")

                val existingGrade =
                    CampaignGrade(
                        id = CampaignGradeId.generate(),
                        kujiCampaignId = campaignId,
                        unlimitedCampaignId = null,
                        name = "Existing",
                        displayOrder = 0,
                        colorCode = "#FFFFFF",
                        bgColorCode = "#000000",
                        createdAt = now,
                        updatedAt = now,
                    )

                val newGrade =
                    CampaignGrade(
                        id = CampaignGradeId.generate(),
                        kujiCampaignId = campaignId,
                        unlimitedCampaignId = null,
                        name = "New Grade",
                        displayOrder = 1,
                        colorCode = "#FFD700",
                        bgColorCode = "#FFF8E1",
                        createdAt = now,
                        updatedAt = now,
                    )

                coEvery { templateRepo.findById(templateId) } returns template
                coEvery { campaignRepo.findKujiById(campaignId) } returns makeKujiCampaign(campaignId)
                coEvery { gradeRepo.findByCampaignId(campaignId) } returns listOf(existingGrade) andThen listOf(existingGrade, newGrade)

                val addedSlot = slot<List<CampaignGrade>>()
                coEvery { gradeRepo.saveAll(capture(addedSlot)) } answers { addedSlot.captured }

                val result = useCases.applyTemplate(campaignId, templateId, ApplyMode.MERGE)

                coVerify(exactly = 1) { gradeRepo.saveAll(any()) }
                addedSlot.captured shouldHaveSize 1
                addedSlot.captured[0].name shouldBe "New Grade"
                addedSlot.captured[0].displayOrder shouldBe 1

                result shouldHaveSize 2
            }

            it("skips saveAll when all template names already exist") {
                val template = makeTemplate("Existing")
                val existingGrade =
                    CampaignGrade(
                        id = CampaignGradeId.generate(),
                        kujiCampaignId = campaignId,
                        unlimitedCampaignId = null,
                        name = "Existing",
                        displayOrder = 0,
                        colorCode = "#FFFFFF",
                        bgColorCode = "#000000",
                        createdAt = now,
                        updatedAt = now,
                    )

                coEvery { templateRepo.findById(templateId) } returns template
                coEvery { campaignRepo.findKujiById(campaignId) } returns makeKujiCampaign(campaignId)
                coEvery { gradeRepo.findByCampaignId(campaignId) } returns listOf(existingGrade)

                val result = useCases.applyTemplate(campaignId, templateId, ApplyMode.MERGE)

                coVerify(exactly = 0) { gradeRepo.saveAll(any()) }
                result shouldHaveSize 1
            }
        }

        describe("batchUpdate") {
            it("replaces all grades for the campaign") {
                val grades =
                    listOf(
                        CampaignGradeUseCases.GradeInput(null, "SSR", 0, "#FFD700", "#FFF8E1"),
                        CampaignGradeUseCases.GradeInput(null, "SR", 1, "#C0C0C0", "#F5F5F5"),
                    )

                coEvery { campaignRepo.findKujiById(campaignId) } returns makeKujiCampaign(campaignId)
                coEvery { gradeRepo.findByCampaignId(campaignId) } returns emptyList()

                val replacedSlot = slot<List<CampaignGrade>>()
                coEvery { gradeRepo.replaceAll(campaignId, capture(replacedSlot)) } answers { replacedSlot.captured }

                val result = useCases.batchUpdate(campaignId, grades)

                coVerify(exactly = 1) { gradeRepo.replaceAll(campaignId, any()) }
                result shouldHaveSize 2
                result[0].name shouldBe "SSR"
                result[0].kujiCampaignId shouldBe campaignId
            }

            it("throws when grades list is empty") {
                shouldThrow<IllegalArgumentException> {
                    useCases.batchUpdate(campaignId, emptyList())
                }
            }

            it("throws when a grade being removed has prize references") {
                val existingId = CampaignGradeId.generate()
                val existingGrade =
                    CampaignGrade(
                        id = existingId,
                        kujiCampaignId = campaignId,
                        unlimitedCampaignId = null,
                        name = "Grade to Remove",
                        displayOrder = 0,
                        colorCode = "#FFFFFF",
                        bgColorCode = "#000000",
                        createdAt = now,
                        updatedAt = now,
                    )

                val grades =
                    listOf(
                        CampaignGradeUseCases.GradeInput(null, "New Grade", 0, "#FFD700", "#FFF8E1"),
                    )

                coEvery { campaignRepo.findKujiById(campaignId) } returns makeKujiCampaign(campaignId)
                coEvery { gradeRepo.findByCampaignId(campaignId) } returns listOf(existingGrade)
                coEvery { gradeRepo.countPrizeReferences(existingId) } returns 2L

                shouldThrow<IllegalStateException> {
                    useCases.batchUpdate(campaignId, grades)
                }
            }

            it("preserves existing grade id when id is provided") {
                val existingId = CampaignGradeId.generate()
                val existingGrade =
                    CampaignGrade(
                        id = existingId,
                        kujiCampaignId = campaignId,
                        unlimitedCampaignId = null,
                        name = "Existing",
                        displayOrder = 0,
                        colorCode = "#FFFFFF",
                        bgColorCode = "#000000",
                        createdAt = now,
                        updatedAt = now,
                    )

                val grades =
                    listOf(
                        CampaignGradeUseCases.GradeInput(existingId.value.toString(), "Existing Updated", 0, "#FFFFFF", "#000000"),
                    )

                coEvery { campaignRepo.findKujiById(campaignId) } returns makeKujiCampaign(campaignId)
                coEvery { gradeRepo.findByCampaignId(campaignId) } returns listOf(existingGrade)

                val replacedSlot = slot<List<CampaignGrade>>()
                coEvery { gradeRepo.replaceAll(campaignId, capture(replacedSlot)) } answers { replacedSlot.captured }

                useCases.batchUpdate(campaignId, grades)

                replacedSlot.captured[0].id shouldBe existingId
                replacedSlot.captured[0].name shouldBe "Existing Updated"
            }
        }

        describe("listGrades") {
            it("delegates to repo.findByCampaignId") {
                coEvery { gradeRepo.findByCampaignId(campaignId) } returns emptyList()

                val result = useCases.listGrades(campaignId)

                result shouldHaveSize 0
                coVerify(exactly = 1) { gradeRepo.findByCampaignId(campaignId) }
            }
        }
    })
