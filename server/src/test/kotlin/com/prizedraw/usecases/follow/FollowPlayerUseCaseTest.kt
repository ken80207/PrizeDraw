package com.prizedraw.usecases.follow

import com.prizedraw.application.ports.output.IFollowRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.usecases.follow.FollowPlayerUseCase
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.contracts.enums.OAuthProvider
import com.prizedraw.domain.entities.Follow
import com.prizedraw.domain.entities.Player
import com.prizedraw.domain.valueobjects.PlayerId
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.datetime.Clock
import java.util.UUID

/**
 * Unit tests for [FollowPlayerUseCase].
 */
class FollowPlayerUseCaseTest :
    DescribeSpec({

        val now = Clock.System.now()

        fun makePlayer(id: PlayerId = PlayerId.generate()) =
            Player(
                id = id,
                nickname = "Player${id.value.toString().take(4)}",
                playerCode = "ABCD1234",
                avatarUrl = null,
                phoneNumber = null,
                phoneVerifiedAt = null,
                oauthProvider = OAuthProvider.GOOGLE,
                oauthSubject = "sub-${id.value}",
                drawPointsBalance = 0,
                revenuePointsBalance = 0,
                version = 0,
                preferredAnimationMode = DrawAnimationMode.TEAR,
                locale = "zh-TW",
                isActive = true,
                deletedAt = null,
                createdAt = now,
                updatedAt = now,
            )

        afterEach { clearAllMocks() }

        describe("FollowPlayerUseCase") {

            it("creates follow when target exists and not already following") {
                val followerId = UUID.randomUUID()
                val targetId = UUID.randomUUID()
                val targetPlayer = makePlayer(PlayerId(targetId))

                val followRepo = mockk<IFollowRepository>()
                val playerRepo = mockk<IPlayerRepository>()

                coEvery { playerRepo.findById(PlayerId(targetId)) } returns targetPlayer
                coEvery { followRepo.exists(followerId, targetId) } returns false
                coEvery { followRepo.save(any()) } answers { firstArg() }

                val useCase = FollowPlayerUseCase(followRepo, playerRepo)
                useCase.execute(followerId, targetId)

                coVerify(exactly = 1) { followRepo.save(any<Follow>()) }
            }

            it("throws IllegalArgumentException when target player not found") {
                val followerId = UUID.randomUUID()
                val targetId = UUID.randomUUID()

                val followRepo = mockk<IFollowRepository>()
                val playerRepo = mockk<IPlayerRepository>()

                coEvery { playerRepo.findById(PlayerId(targetId)) } returns null

                val useCase = FollowPlayerUseCase(followRepo, playerRepo)

                val ex =
                    shouldThrow<IllegalArgumentException> {
                        useCase.execute(followerId, targetId)
                    }
                ex.message shouldBe "Target player not found"

                coVerify(exactly = 0) { followRepo.save(any()) }
            }

            it("throws IllegalStateException when already following the target") {
                val followerId = UUID.randomUUID()
                val targetId = UUID.randomUUID()
                val targetPlayer = makePlayer(PlayerId(targetId))

                val followRepo = mockk<IFollowRepository>()
                val playerRepo = mockk<IPlayerRepository>()

                coEvery { playerRepo.findById(PlayerId(targetId)) } returns targetPlayer
                coEvery { followRepo.exists(followerId, targetId) } returns true

                val useCase = FollowPlayerUseCase(followRepo, playerRepo)

                val ex =
                    shouldThrow<IllegalStateException> {
                        useCase.execute(followerId, targetId)
                    }
                ex.message shouldBe "Already following this player"

                coVerify(exactly = 0) { followRepo.save(any()) }
            }

            it("throws IllegalArgumentException when follower tries to follow themselves") {
                val playerId = UUID.randomUUID()

                val followRepo = mockk<IFollowRepository>()
                val playerRepo = mockk<IPlayerRepository>()

                val useCase = FollowPlayerUseCase(followRepo, playerRepo)

                val ex =
                    shouldThrow<IllegalArgumentException> {
                        useCase.execute(playerId, playerId)
                    }
                ex.message shouldBe "Cannot follow yourself"

                coVerify(exactly = 0) { playerRepo.findById(any()) }
                coVerify(exactly = 0) { followRepo.save(any()) }
            }
        }
    })
