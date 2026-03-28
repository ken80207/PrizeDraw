package com.prizedraw.usecases.follow

import com.prizedraw.application.ports.output.IFollowRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.usecases.follow.SearchPlayerByCodeUseCase
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.contracts.enums.OAuthProvider
import com.prizedraw.domain.entities.Player
import com.prizedraw.domain.valueobjects.PlayerId
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.datetime.Clock
import java.util.UUID

/**
 * Unit tests for [SearchPlayerByCodeUseCase].
 */
class SearchPlayerByCodeUseCaseTest :
    DescribeSpec({

        val now = Clock.System.now()

        fun makePlayer(
            id: PlayerId = PlayerId.generate(),
            playerCode: String = "ABCD1234",
            nickname: String = "TestPlayer",
            avatarUrl: String? = "https://cdn.example.com/avatar.jpg",
        ) = Player(
            id = id,
            nickname = nickname,
            playerCode = playerCode,
            avatarUrl = avatarUrl,
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

        describe("SearchPlayerByCodeUseCase") {

            it("returns player DTO with isFollowing=true when requester follows the found player") {
                val requesterId = UUID.randomUUID()
                val targetPlayer = makePlayer(playerCode = "ABCD1234")

                val playerRepo = mockk<IPlayerRepository>()
                val followRepo = mockk<IFollowRepository>()

                coEvery { playerRepo.findByPlayerCode("ABCD1234") } returns targetPlayer
                coEvery { followRepo.exists(requesterId, targetPlayer.id.value) } returns true

                val useCase = SearchPlayerByCodeUseCase(playerRepo, followRepo)
                val result = useCase.execute(requesterId, "abcd1234")

                result.shouldNotBeNull()
                result.playerId shouldBe targetPlayer.id.value.toString()
                result.nickname shouldBe targetPlayer.nickname
                result.avatarUrl shouldBe targetPlayer.avatarUrl
                result.playerCode shouldBe targetPlayer.playerCode
                result.isFollowing shouldBe true
            }

            it("returns player DTO with isFollowing=false when requester does not follow the found player") {
                val requesterId = UUID.randomUUID()
                val targetPlayer = makePlayer(playerCode = "WXYZ5678")

                val playerRepo = mockk<IPlayerRepository>()
                val followRepo = mockk<IFollowRepository>()

                coEvery { playerRepo.findByPlayerCode("WXYZ5678") } returns targetPlayer
                coEvery { followRepo.exists(requesterId, targetPlayer.id.value) } returns false

                val useCase = SearchPlayerByCodeUseCase(playerRepo, followRepo)
                val result = useCase.execute(requesterId, "wxyz5678")

                result.shouldNotBeNull()
                result.isFollowing shouldBe false
            }

            it("returns null when player code is not found") {
                val requesterId = UUID.randomUUID()

                val playerRepo = mockk<IPlayerRepository>()
                val followRepo = mockk<IFollowRepository>()

                coEvery { playerRepo.findByPlayerCode("NOTFOUND") } returns null

                val useCase = SearchPlayerByCodeUseCase(playerRepo, followRepo)
                val result = useCase.execute(requesterId, "notfound")

                result.shouldBeNull()
                coVerify(exactly = 0) { followRepo.exists(any(), any()) }
            }

            it("upper-cases the code before querying the repository") {
                val requesterId = UUID.randomUUID()
                val targetPlayer = makePlayer(playerCode = "UPPER123")

                val playerRepo = mockk<IPlayerRepository>()
                val followRepo = mockk<IFollowRepository>()

                coEvery { playerRepo.findByPlayerCode("UPPER123") } returns targetPlayer
                coEvery { followRepo.exists(requesterId, targetPlayer.id.value) } returns false

                val useCase = SearchPlayerByCodeUseCase(playerRepo, followRepo)
                useCase.execute(requesterId, "upper123")

                coVerify(exactly = 1) { playerRepo.findByPlayerCode("UPPER123") }
            }
        }
    })
