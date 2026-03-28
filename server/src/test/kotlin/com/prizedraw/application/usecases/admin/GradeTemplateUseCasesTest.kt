package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.output.IGradeTemplateRepository
import com.prizedraw.domain.entities.GradeTemplate
import com.prizedraw.domain.entities.GradeTemplateItem
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.datetime.Clock
import java.util.UUID

class GradeTemplateUseCasesTest :
    DescribeSpec({

        val repo = mockk<IGradeTemplateRepository>()
        val useCases = GradeTemplateUseCases(repo)

        val staffId = UUID.randomUUID()
        val now = Clock.System.now()

        describe("createTemplate") {
            it("saves a template with the correct fields and delegates to repo.save") {
                val items =
                    listOf(
                        GradeTemplateUseCases.ItemInput(
                            name = "SSR",
                            displayOrder = 0,
                            colorCode = "#FFD700",
                            bgColorCode = "#FFF8E1",
                        ),
                        GradeTemplateUseCases.ItemInput(
                            name = "SR",
                            displayOrder = 1,
                            colorCode = "#C0C0C0",
                            bgColorCode = "#F5F5F5",
                        ),
                    )

                val templateSlot = slot<GradeTemplate>()
                coEvery { repo.save(capture(templateSlot)) } answers { templateSlot.captured }

                val result = useCases.createTemplate(staffId = staffId, name = "Test Template", items = items)

                coVerify(exactly = 1) { repo.save(any()) }

                val captured = templateSlot.captured
                captured.name shouldBe "Test Template"
                captured.createdByStaffId shouldBe staffId
                captured.items shouldHaveSize 2
                captured.items[0].name shouldBe "SSR"
                captured.items[0].colorCode shouldBe "#FFD700"
                captured.items[0].bgColorCode shouldBe "#FFF8E1"
                captured.items[0].displayOrder shouldBe 0
                captured.items[0].templateId shouldBe captured.id
                captured.items[1].name shouldBe "SR"

                result.name shouldBe "Test Template"
            }

            it("trims whitespace from template name") {
                val templateSlot = slot<GradeTemplate>()
                coEvery { repo.save(capture(templateSlot)) } answers { templateSlot.captured }

                useCases.createTemplate(
                    staffId = staffId,
                    name = "  My Template  ",
                    items =
                        listOf(
                            GradeTemplateUseCases.ItemInput("A", 0, "#FFFFFF", "#000000"),
                        ),
                )

                templateSlot.captured.name shouldBe "My Template"
            }

            it("throws if name is blank") {
                shouldThrow<IllegalArgumentException> {
                    useCases.createTemplate(staffId = staffId, name = "   ", items = listOf())
                }
            }

            it("throws if items list is empty") {
                shouldThrow<IllegalArgumentException> {
                    useCases.createTemplate(staffId = staffId, name = "Valid", items = emptyList())
                }
            }

            it("throws if colorCode is invalid") {
                shouldThrow<IllegalArgumentException> {
                    useCases.createTemplate(
                        staffId = staffId,
                        name = "Valid",
                        items =
                            listOf(
                                GradeTemplateUseCases.ItemInput("A", 0, "red", "#000000"),
                            ),
                    )
                }
            }

            it("throws if bgColorCode is invalid") {
                shouldThrow<IllegalArgumentException> {
                    useCases.createTemplate(
                        staffId = staffId,
                        name = "Valid",
                        items =
                            listOf(
                                GradeTemplateUseCases.ItemInput("A", 0, "#FFFFFF", "blue"),
                            ),
                    )
                }
            }

            it("accepts 8-digit hex color codes") {
                val templateSlot = slot<GradeTemplate>()
                coEvery { repo.save(capture(templateSlot)) } answers { templateSlot.captured }

                useCases.createTemplate(
                    staffId = staffId,
                    name = "Alpha Test",
                    items =
                        listOf(
                            GradeTemplateUseCases.ItemInput("A", 0, "#FFD700FF", "#FFF8E1AA"),
                        ),
                )

                templateSlot.captured.items[0].colorCode shouldBe "#FFD700FF"
            }
        }

        describe("deleteTemplate") {
            it("delegates to repo.delete with the given id") {
                val templateId = UUID.randomUUID()
                coEvery { repo.delete(templateId) } returns Unit

                useCases.deleteTemplate(templateId)

                coVerify(exactly = 1) { repo.delete(templateId) }
            }
        }

        describe("listTemplates") {
            it("delegates to repo.findAll") {
                val fakeTemplate =
                    GradeTemplate(
                        id = UUID.randomUUID(),
                        name = "Template A",
                        createdByStaffId = staffId,
                        items = emptyList(),
                        createdAt = now,
                        updatedAt = now,
                    )
                coEvery { repo.findAll() } returns listOf(fakeTemplate)

                val result = useCases.listTemplates()

                result shouldHaveSize 1
                result[0].name shouldBe "Template A"
                coVerify(exactly = 1) { repo.findAll() }
            }
        }

        describe("getTemplate") {
            it("delegates to repo.findById") {
                val templateId = UUID.randomUUID()
                coEvery { repo.findById(templateId) } returns null

                val result = useCases.getTemplate(templateId)

                result shouldBe null
                coVerify(exactly = 1) { repo.findById(templateId) }
            }
        }

        describe("updateTemplate") {
            it("returns null when template does not exist") {
                val templateId = UUID.randomUUID()
                coEvery { repo.findById(templateId) } returns null

                val result =
                    useCases.updateTemplate(
                        id = templateId,
                        name = "New Name",
                        items = listOf(GradeTemplateUseCases.ItemInput("A", 0, "#FFFFFF", "#000000")),
                    )

                result shouldBe null
                coVerify(exactly = 0) { repo.update(any()) }
            }

            it("saves updated template with new name and items") {
                val templateId = UUID.randomUUID()
                val existing =
                    GradeTemplate(
                        id = templateId,
                        name = "Old Name",
                        createdByStaffId = staffId,
                        items =
                            listOf(
                                GradeTemplateItem(UUID.randomUUID(), templateId, "Old Item", 0, "#111111", "#222222"),
                            ),
                        createdAt = now,
                        updatedAt = now,
                    )

                coEvery { repo.findById(templateId) } returns existing
                val updatedSlot = slot<GradeTemplate>()
                coEvery { repo.update(capture(updatedSlot)) } answers { updatedSlot.captured }

                val result =
                    useCases.updateTemplate(
                        id = templateId,
                        name = "New Name",
                        items = listOf(GradeTemplateUseCases.ItemInput("New Item", 0, "#AABBCC", "#DDEEFF")),
                    )

                coVerify(exactly = 1) { repo.update(any()) }
                updatedSlot.captured.name shouldBe "New Name"
                updatedSlot.captured.items shouldHaveSize 1
                updatedSlot.captured.items[0].name shouldBe "New Item"
            }
        }
    })
