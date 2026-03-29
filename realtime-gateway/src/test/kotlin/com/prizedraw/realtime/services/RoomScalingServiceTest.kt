package com.prizedraw.realtime.services

import com.prizedraw.domain.entities.RoomInstance
import com.prizedraw.realtime.infrastructure.redis.RedisClient
import com.prizedraw.realtime.infrastructure.redis.RedisPubSub
import com.prizedraw.realtime.ports.IRoomInstanceRepository
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.just
import io.mockk.mockk
import io.mockk.runs
import kotlinx.datetime.Clock
import java.util.UUID

/**
 * Unit tests for [RoomScalingService] that do not require a database connection.
 *
 * [IRoomInstanceRepository], [RedisClient], and [RedisPubSub] are all mocked.
 *
 * [RoomScalingService.assignRoom] is intentionally excluded here: it wraps its logic
 * in an Exposed [newSuspendedTransaction] that requires a live database. That path is
 * covered by integration tests that spin up an H2 in-memory database.
 *
 * Tests covered:
 * - [RoomScalingService.getCampaignStats] aggregates player counts across all active shards.
 * - [RoomScalingService.listActiveRooms] delegates to the repository.
 * - [RoomScalingService.leaveRoom] decrements the player count.
 * - [RoomScalingService.findShard] returns an active shard and null for inactive ones.
 * - [RoomScalingService.cleanupEmptyRooms] invokes the repository cleanup with the configured parameters.
 * - Scale-up threshold constant is set to the documented value of 0.85.
 * - Default max players constant matches the documented value of 30.
 */
class RoomScalingServiceTest : FunSpec({

    val roomRepo = mockk<IRoomInstanceRepository>()
    val redisClient = mockk<RedisClient>(relaxed = true)
    val redisPubSub = mockk<RedisPubSub>()

    lateinit var service: RoomScalingService

    beforeEach {
        clearAllMocks()
        service = RoomScalingService(
            roomInstanceRepository = roomRepo,
            redisClient = redisClient,
            redisPubSub = redisPubSub,
        )
        coEvery { redisPubSub.publish(any(), any()) } just runs
    }

    fun makeRoom(
        campaignId: UUID,
        playerCount: Int,
        maxPlayers: Int = RoomScalingService.DEFAULT_MAX_PLAYERS,
        instanceNumber: Int = 1,
        isActive: Boolean = true,
    ): RoomInstance {
        val now = Clock.System.now()
        return RoomInstance(
            id = UUID.randomUUID(),
            campaignId = campaignId,
            instanceNumber = instanceNumber,
            playerCount = playerCount,
            maxPlayers = maxPlayers,
            isActive = isActive,
            createdAt = now,
            updatedAt = now,
        )
    }

    // ------------------------------------------------------------------ //
    // getCampaignStats                                                    //
    // ------------------------------------------------------------------ //

    test("getCampaignStats aggregates viewer counts across all active shards") {
        val campaignId = UUID.randomUUID()
        val rooms = listOf(
            makeRoom(campaignId, playerCount = 10, instanceNumber = 1),
            makeRoom(campaignId, playerCount = 15, instanceNumber = 2),
            makeRoom(campaignId, playerCount = 5, instanceNumber = 3),
        )
        coEvery { roomRepo.findActiveByCampaign(campaignId) } returns rooms

        val stats = service.getCampaignStats(campaignId)

        stats.totalViewers shouldBe 30
        stats.activeRooms shouldBe 3
    }

    test("getCampaignStats returns zero viewers when no active shards exist") {
        val campaignId = UUID.randomUUID()
        coEvery { roomRepo.findActiveByCampaign(campaignId) } returns emptyList()

        val stats = service.getCampaignStats(campaignId)

        stats.totalViewers shouldBe 0
        stats.activeRooms shouldBe 0
    }

    test("getCampaignStats returns single shard viewer count correctly") {
        val campaignId = UUID.randomUUID()
        val room = makeRoom(campaignId, playerCount = 22)
        coEvery { roomRepo.findActiveByCampaign(campaignId) } returns listOf(room)

        val stats = service.getCampaignStats(campaignId)

        stats.totalViewers shouldBe 22
        stats.activeRooms shouldBe 1
    }

    // ------------------------------------------------------------------ //
    // listActiveRooms                                                     //
    // ------------------------------------------------------------------ //

    test("listActiveRooms delegates to repository") {
        val campaignId = UUID.randomUUID()
        val rooms = listOf(makeRoom(campaignId, playerCount = 5, instanceNumber = 1))
        coEvery { roomRepo.findActiveByCampaign(campaignId) } returns rooms

        val result = service.listActiveRooms(campaignId)

        result shouldBe rooms
        coVerify(exactly = 1) { roomRepo.findActiveByCampaign(campaignId) }
    }

    // ------------------------------------------------------------------ //
    // leaveRoom                                                           //
    // ------------------------------------------------------------------ //

    test("leaveRoom decrements player count via repository") {
        val roomId = UUID.randomUUID()
        coEvery { roomRepo.decrementPlayerCount(roomId) } just runs

        service.leaveRoom(roomId)

        coVerify(exactly = 1) { roomRepo.decrementPlayerCount(roomId) }
    }

    // ------------------------------------------------------------------ //
    // findShard                                                           //
    // ------------------------------------------------------------------ //

    test("findShard returns an active shard when it exists") {
        val roomId = UUID.randomUUID()
        val room = makeRoom(UUID.randomUUID(), playerCount = 5, isActive = true)
            .copy(id = roomId)
        coEvery { roomRepo.findById(roomId) } returns room

        val result = service.findShard(roomId)

        result shouldNotBe null
        result?.id shouldBe roomId
        result?.isActive shouldBe true
    }

    test("findShard returns null for an inactive shard") {
        val roomId = UUID.randomUUID()
        val inactiveRoom = makeRoom(UUID.randomUUID(), playerCount = 0, isActive = false)
            .copy(id = roomId)
        coEvery { roomRepo.findById(roomId) } returns inactiveRoom

        val result = service.findShard(roomId)

        result shouldBe null
    }

    test("findShard returns null when shard does not exist") {
        val roomId = UUID.randomUUID()
        coEvery { roomRepo.findById(roomId) } returns null

        val result = service.findShard(roomId)

        result shouldBe null
    }

    // ------------------------------------------------------------------ //
    // cleanupEmptyRooms                                                  //
    // ------------------------------------------------------------------ //

    test("cleanupEmptyRooms invokes deactivateEmptyRooms with correct parameters") {
        coEvery { roomRepo.deactivateEmptyRooms(any(), any()) } just runs

        service.cleanupEmptyRooms()

        // Verify the grace period (5 minutes) and minimum shard count (1) documented in the
        // companion object are forwarded to the repository unchanged.
        coVerify(exactly = 1) {
            roomRepo.deactivateEmptyRooms(
                emptyForMinutes = 5,
                keepMinimum = 1,
            )
        }
    }

    // ------------------------------------------------------------------ //
    // Scale-up threshold contract                                        //
    // ------------------------------------------------------------------ //

    test("SCALE_UP_THRESHOLD is 0.85 as documented") {
        RoomScalingService.SCALE_UP_THRESHOLD shouldBe 0.85
    }

    test("DEFAULT_MAX_PLAYERS is 30 as documented") {
        RoomScalingService.DEFAULT_MAX_PLAYERS shouldBe 30
    }

    test("scale-up threshold at 85% of 30 players evaluates to 25 effective capacity") {
        // 30 * 0.85 = 25.5 — rooms with playerCount < 25.5 (i.e. ≤ 25) are below threshold.
        // This test guards the threshold arithmetic used in assignRoom.
        val threshold = RoomScalingService.DEFAULT_MAX_PLAYERS * RoomScalingService.SCALE_UP_THRESHOLD
        val roomAtCapacity = makeRoom(UUID.randomUUID(), playerCount = 26)
        val roomBelowCapacity = makeRoom(UUID.randomUUID(), playerCount = 25)

        (roomAtCapacity.playerCount < threshold) shouldBe false
        (roomBelowCapacity.playerCount < threshold) shouldBe true
    }
})
