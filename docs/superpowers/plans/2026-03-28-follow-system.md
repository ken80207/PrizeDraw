# Follow System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a unidirectional follow (fan) system where players can follow others and receive notifications when followed players draw or hit rare prizes.

**Architecture:** Extends the existing hexagonal architecture with a new `Follow` domain entity, `IFollowRepository` output port, Exposed implementation, and Ktor routes. Notification fan-out reuses the existing outbox pattern + FCM + WebSocket infrastructure. Player code generation added as a new column on the players table.

**Tech Stack:** Kotlin/Ktor, Exposed ORM, PostgreSQL, Redis pub/sub, FCM, Kotest + mockk

**Spec:** `docs/superpowers/specs/2026-03-28-follow-system-design.md`

---

## File Structure

### New Files
| Path | Responsibility |
|------|---------------|
| `server/src/main/resources/db/migration/V026__add_player_code.sql` | Migration: add player_code column + backfill |
| `server/src/main/resources/db/migration/V027__create_follows.sql` | Migration: follows table |
| `server/src/main/resources/db/migration/V028__add_prize_is_rare.sql` | Migration: is_rare column on prize_definitions |
| `server/src/main/kotlin/com/prizedraw/domain/entities/Follow.kt` | Follow domain entity |
| `server/src/main/kotlin/com/prizedraw/domain/services/PlayerCodeGenerator.kt` | Player code generation logic |
| `server/src/main/kotlin/com/prizedraw/application/ports/output/IFollowRepository.kt` | Follow repository output port |
| `server/src/main/kotlin/com/prizedraw/application/ports/input/follow/IFollowPlayerUseCase.kt` | Follow input port |
| `server/src/main/kotlin/com/prizedraw/application/ports/input/follow/IUnfollowPlayerUseCase.kt` | Unfollow input port |
| `server/src/main/kotlin/com/prizedraw/application/ports/input/follow/IGetFollowingListUseCase.kt` | Get following list input port |
| `server/src/main/kotlin/com/prizedraw/application/ports/input/follow/IGetFollowersListUseCase.kt` | Get followers list input port |
| `server/src/main/kotlin/com/prizedraw/application/ports/input/follow/IGetFollowStatusUseCase.kt` | Check follow status input port |
| `server/src/main/kotlin/com/prizedraw/application/ports/input/follow/ISearchPlayerByCodeUseCase.kt` | Search by player code input port |
| `server/src/main/kotlin/com/prizedraw/application/ports/input/follow/IBatchFollowStatusUseCase.kt` | Batch follow status for chat room |
| `server/src/main/kotlin/com/prizedraw/application/usecases/follow/FollowPlayerUseCase.kt` | Follow use case impl |
| `server/src/main/kotlin/com/prizedraw/application/usecases/follow/UnfollowPlayerUseCase.kt` | Unfollow use case impl |
| `server/src/main/kotlin/com/prizedraw/application/usecases/follow/GetFollowingListUseCase.kt` | Following list impl |
| `server/src/main/kotlin/com/prizedraw/application/usecases/follow/GetFollowersListUseCase.kt` | Followers list impl |
| `server/src/main/kotlin/com/prizedraw/application/usecases/follow/GetFollowStatusUseCase.kt` | Follow status impl |
| `server/src/main/kotlin/com/prizedraw/application/usecases/follow/SearchPlayerByCodeUseCase.kt` | Player search impl |
| `server/src/main/kotlin/com/prizedraw/application/usecases/follow/BatchFollowStatusUseCase.kt` | Batch status impl |
| `server/src/main/kotlin/com/prizedraw/infrastructure/persistence/tables/FollowsTable.kt` | Exposed table definition |
| `server/src/main/kotlin/com/prizedraw/infrastructure/persistence/repositories/FollowRepositoryImpl.kt` | Exposed repository impl |
| `server/src/main/kotlin/com/prizedraw/api/routes/FollowRoutes.kt` | Ktor follow routes |
| ~~`server/src/main/kotlin/com/prizedraw/api/routes/PlayerSearchRoutes.kt`~~ | Search route embedded in FollowRoutes.kt |
| `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/endpoints/FollowEndpoints.kt` | Endpoint constants |
| `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/dto/follow/FollowDtos.kt` | Follow DTOs |
| `server/src/test/kotlin/com/prizedraw/usecases/follow/FollowPlayerUseCaseTest.kt` | Follow use case tests |
| `server/src/test/kotlin/com/prizedraw/usecases/follow/UnfollowPlayerUseCaseTest.kt` | Unfollow use case tests |
| `server/src/test/kotlin/com/prizedraw/usecases/follow/GetFollowListUseCaseTest.kt` | List use case tests |
| `server/src/test/kotlin/com/prizedraw/usecases/follow/SearchPlayerByCodeUseCaseTest.kt` | Search use case tests |
| `server/src/test/kotlin/com/prizedraw/domain/services/PlayerCodeGeneratorTest.kt` | Code generator tests |
| `server/src/test/kotlin/com/prizedraw/integration/FollowNotificationTest.kt` | Notification fan-out tests |

### Modified Files
| Path | Change |
|------|--------|
| `server/src/main/kotlin/com/prizedraw/infrastructure/persistence/tables/PlayersTable.kt` | Add `playerCode` column |
| `server/src/main/kotlin/com/prizedraw/infrastructure/persistence/tables/PrizesTable.kt` | Add `isRare` column to prize definitions sub-table |
| `server/src/main/kotlin/com/prizedraw/domain/entities/Player.kt` | Add `playerCode` property |
| `server/src/main/kotlin/com/prizedraw/domain/entities/PrizeDefinition.kt` | Add `isRare` property |
| `server/src/main/kotlin/com/prizedraw/application/ports/output/IPlayerRepository.kt` | Add `findByPlayerCode()` |
| `server/src/main/kotlin/com/prizedraw/infrastructure/persistence/repositories/PlayerRepositoryImpl.kt` | Implement `findByPlayerCode()`, include `playerCode` in mappings |
| `server/src/main/kotlin/com/prizedraw/infrastructure/di/RepositoryModule.kt` | Register `IFollowRepository` |
| `server/src/main/kotlin/com/prizedraw/infrastructure/di/UseCaseModule.kt` | Register follow use cases |
| `server/src/main/kotlin/com/prizedraw/api/plugins/Routing.kt` | Mount follow + search routes |
| `server/src/main/kotlin/com/prizedraw/api/plugins/RateLimit.kt` | Add `follow` rate limit tier (30/min) |
| `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/dto/notification/NotificationDtos.kt` | Add `FOLLOWING_DRAW_STARTED`, `FOLLOWING_RARE_PRIZE_DRAWN` to `PlayerWsEventType` |
| `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/dto/player/PlayerDtos.kt` | Add `playerCode`, `followerCount`, `followingCount` to profile DTO |
| `server/src/main/kotlin/com/prizedraw/application/events/OutboxWorker.kt` | Add follow notification fan-out handlers |
| `server/src/main/kotlin/com/prizedraw/application/events/DomainEvent.kt` | Add `FollowingDrawStarted`, `FollowingRarePrizeDrawn` events |
| `server/src/main/kotlin/com/prizedraw/application/usecases/draw/DrawKujiUseCase.kt` | Emit `following.draw_started` outbox event |
| `server/src/main/kotlin/com/prizedraw/application/usecases/draw/DrawUnlimitedUseCase.kt` | Emit `following.draw_started` outbox event |
| `server/src/main/resources/i18n/messages_zh_TW.properties` | Add follow notification i18n keys |
| `server/src/main/resources/i18n/messages_en.properties` | Add follow notification i18n keys |

---

## Pre-requisite: Fix V024 Duplicate

Before starting, the duplicate V024 migration must be resolved.

- [ ] **Step 1: Rename V024__create_feed_events.sql to V025__create_feed_events.sql**

```bash
cd /Users/ken/Project/PrizeDraw/PrizeDraw
mv server/src/main/resources/db/migration/V024__create_feed_events.sql \
   server/src/main/resources/db/migration/V025__create_feed_events.sql
```

- [ ] **Step 2: Verify no other V025 exists**

```bash
ls server/src/main/resources/db/migration/V025*
```

Expected: only `V025__create_feed_events.sql`

- [ ] **Step 3: Commit**

```bash
git add server/src/main/resources/db/migration/
git commit -m "fix: renumber duplicate V024 feed_events migration to V025"
```

---

## Task 1: Player Code — Domain + Migration

**Files:**
- Create: `server/src/main/kotlin/com/prizedraw/domain/services/PlayerCodeGenerator.kt`
- Create: `server/src/test/kotlin/com/prizedraw/domain/services/PlayerCodeGeneratorTest.kt`
- Create: `server/src/main/resources/db/migration/V026__add_player_code.sql`
- Modify: `server/src/main/kotlin/com/prizedraw/domain/entities/Player.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/infrastructure/persistence/tables/PlayersTable.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/application/ports/output/IPlayerRepository.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/infrastructure/persistence/repositories/PlayerRepositoryImpl.kt`

- [ ] **Step 1: Write PlayerCodeGenerator test**

```kotlin
// server/src/test/kotlin/com/prizedraw/domain/services/PlayerCodeGeneratorTest.kt
package com.prizedraw.domain.services

import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldHaveLength
import io.kotest.matchers.string.shouldMatch

class PlayerCodeGeneratorTest : DescribeSpec({
    describe("generate") {
        it("produces an 8-character uppercase alphanumeric code") {
            val code = PlayerCodeGenerator.generate()
            code shouldHaveLength 8
            code shouldMatch Regex("^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$")
        }

        it("excludes confusable characters 0, O, 1, I, L") {
            // Generate 100 codes and verify none contain confusable chars
            repeat(100) {
                val code = PlayerCodeGenerator.generate()
                code.none { it in "01OIL" } shouldBe true
            }
        }

        it("generates unique codes") {
            val codes = (1..1000).map { PlayerCodeGenerator.generate() }.toSet()
            // With 656M combinations, 1000 codes should all be unique
            codes.size shouldBe 1000
        }
    }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew :server:test --tests "com.prizedraw.domain.services.PlayerCodeGeneratorTest" --info`
Expected: FAIL — `PlayerCodeGenerator` not found

- [ ] **Step 3: Write PlayerCodeGenerator**

```kotlin
// server/src/main/kotlin/com/prizedraw/domain/services/PlayerCodeGenerator.kt
package com.prizedraw.domain.services

import kotlin.random.Random

/**
 * Generates unique 8-character player codes from a safe alphanumeric charset.
 *
 * Excludes visually confusable characters: 0/O, 1/I/L.
 */
public object PlayerCodeGenerator {
    private const val CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
    private const val CODE_LENGTH = 8

    /** Generates a random player code. Caller must check uniqueness. */
    public fun generate(): String =
        buildString(CODE_LENGTH) {
            repeat(CODE_LENGTH) {
                append(CHARSET[Random.nextInt(CHARSET.length)])
            }
        }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew :server:test --tests "com.prizedraw.domain.services.PlayerCodeGeneratorTest" --info`
Expected: PASS

- [ ] **Step 5: Add playerCode to Player entity**

Modify `server/src/main/kotlin/com/prizedraw/domain/entities/Player.kt`:
- Add `@property playerCode` KDoc entry
- Add `val playerCode: String` property after `nickname`

```kotlin
public data class Player(
    val id: PlayerId,
    val nickname: String,
    val playerCode: String,  // <-- add after nickname
    val avatarUrl: String?,
    // ... rest unchanged
)
```

- [ ] **Step 6: Add playerCode to PlayersTable**

Modify `server/src/main/kotlin/com/prizedraw/infrastructure/persistence/tables/PlayersTable.kt`:

Add after `nickname`:
```kotlin
public val playerCode = varchar("player_code", 8).uniqueIndex("idx_players_player_code")
```

- [ ] **Step 7: Add findByPlayerCode to IPlayerRepository**

Modify `server/src/main/kotlin/com/prizedraw/application/ports/output/IPlayerRepository.kt`:

Add methods:
```kotlin
/** Finds a non-deleted player by their unique player code. */
public suspend fun findByPlayerCode(code: String): Player?

/** Finds multiple non-deleted players by ID in a single query. */
public suspend fun findByIds(ids: List<PlayerId>): List<Player>
```

- [ ] **Step 8: Update PlayerRepositoryImpl**

Modify `server/src/main/kotlin/com/prizedraw/infrastructure/persistence/repositories/PlayerRepositoryImpl.kt`:
- Add `playerCode` to `toPlayer()` mapping: `playerCode = row[PlayersTable.playerCode],`
- Add `playerCode` to `save()` insert/update
- Add `findByPlayerCode()` and `findByIds()` implementations:

```kotlin
override suspend fun findByPlayerCode(code: String): Player? = newSuspendedTransaction {
    PlayersTable.selectAll()
        .where { (PlayersTable.playerCode eq code) and (PlayersTable.deletedAt.isNull()) }
        .singleOrNull()
        ?.let(::toPlayer)
}

override suspend fun findByIds(ids: List<PlayerId>): List<Player> = newSuspendedTransaction {
    if (ids.isEmpty()) return@newSuspendedTransaction emptyList()
    PlayersTable.selectAll()
        .where { (PlayersTable.id inList ids.map { it.value }) and (PlayersTable.deletedAt.isNull()) }
        .map(::toPlayer)
}
```

- [ ] **Step 9: Write migration V026**

```sql
-- server/src/main/resources/db/migration/V026__add_player_code.sql

-- Add player_code column (nullable first for backfill)
ALTER TABLE players ADD COLUMN player_code VARCHAR(8);

-- Backfill existing players with random codes
DO $$
DECLARE
    charset TEXT := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    player_row RECORD;
    new_code TEXT;
    collision BOOLEAN;
BEGIN
    FOR player_row IN SELECT id FROM players WHERE player_code IS NULL LOOP
        collision := TRUE;
        WHILE collision LOOP
            new_code := '';
            FOR i IN 1..8 LOOP
                new_code := new_code || substr(charset, floor(random() * 30 + 1)::int, 1);
            END LOOP;
            collision := EXISTS(SELECT 1 FROM players WHERE player_code = new_code);
        END LOOP;
        UPDATE players SET player_code = new_code WHERE id = player_row.id;
    END LOOP;
END $$;

-- Now make it NOT NULL and add unique index
ALTER TABLE players ALTER COLUMN player_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_player_code ON players (player_code);
```

- [ ] **Step 10: Commit**

```bash
git add server/src/main/kotlin/com/prizedraw/domain/services/PlayerCodeGenerator.kt \
       server/src/test/kotlin/com/prizedraw/domain/services/PlayerCodeGeneratorTest.kt \
       server/src/main/kotlin/com/prizedraw/domain/entities/Player.kt \
       server/src/main/kotlin/com/prizedraw/infrastructure/persistence/tables/PlayersTable.kt \
       server/src/main/kotlin/com/prizedraw/application/ports/output/IPlayerRepository.kt \
       server/src/main/kotlin/com/prizedraw/infrastructure/persistence/repositories/PlayerRepositoryImpl.kt \
       server/src/main/resources/db/migration/V026__add_player_code.sql
git commit -m "feat(follow): add player code generation and migration"
```

---

## Task 2: Follow Domain + Repository

**Files:**
- Create: `server/src/main/kotlin/com/prizedraw/domain/entities/Follow.kt`
- Create: `server/src/main/kotlin/com/prizedraw/application/ports/output/IFollowRepository.kt`
- Create: `server/src/main/kotlin/com/prizedraw/infrastructure/persistence/tables/FollowsTable.kt`
- Create: `server/src/main/kotlin/com/prizedraw/infrastructure/persistence/repositories/FollowRepositoryImpl.kt`
- Create: `server/src/main/resources/db/migration/V027__create_follows.sql`
- Modify: `server/src/main/kotlin/com/prizedraw/infrastructure/di/RepositoryModule.kt`

- [ ] **Step 1: Write Follow entity**

```kotlin
// server/src/main/kotlin/com/prizedraw/domain/entities/Follow.kt
package com.prizedraw.domain.entities

import kotlinx.datetime.Instant
import java.util.UUID

/**
 * Represents a unidirectional follow relationship (fan model).
 *
 * [followerId] follows [followingId]. No approval required.
 *
 * @property id Surrogate primary key.
 * @property followerId The player who follows.
 * @property followingId The player being followed.
 * @property createdAt Timestamp when the follow was created.
 */
public data class Follow(
    val id: UUID = UUID.randomUUID(),
    val followerId: UUID,
    val followingId: UUID,
    val createdAt: Instant,
)
```

- [ ] **Step 2: Write IFollowRepository port**

```kotlin
// server/src/main/kotlin/com/prizedraw/application/ports/output/IFollowRepository.kt
package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.Follow
import java.util.UUID

/**
 * Output port for follow relationship persistence.
 */
public interface IFollowRepository {
    /** Creates a follow relationship. Returns the created Follow. */
    public suspend fun save(follow: Follow): Follow

    /** Deletes a follow relationship. Returns true if a row was deleted. */
    public suspend fun delete(followerId: UUID, followingId: UUID): Boolean

    /** Checks if a follow relationship exists. */
    public suspend fun exists(followerId: UUID, followingId: UUID): Boolean

    /** Checks follow status for multiple target players at once. Returns set of followed player IDs. */
    public suspend fun existsBatch(followerId: UUID, followingIds: List<UUID>): Set<UUID>

    /** Returns paginated list of players that [followerId] follows, newest first. */
    public suspend fun findFollowing(followerId: UUID, limit: Int, offset: Int): List<Follow>

    /** Returns paginated list of players that follow [followingId], newest first. */
    public suspend fun findFollowers(followingId: UUID, limit: Int, offset: Int): List<Follow>

    /** Count of players that [playerId] follows. */
    public suspend fun countFollowing(playerId: UUID): Int

    /** Count of players that follow [playerId]. */
    public suspend fun countFollowers(playerId: UUID): Int

    /** Returns (followId, followerId) pairs in batches for notification fan-out. Cursor-based via followId. */
    public suspend fun findFollowerIdsBatch(followingId: UUID, afterFollowId: UUID?, limit: Int): List<Pair<UUID, UUID>>
}
```

- [ ] **Step 3: Write FollowsTable**

```kotlin
// server/src/main/kotlin/com/prizedraw/infrastructure/persistence/tables/FollowsTable.kt
package com.prizedraw.infrastructure.persistence.tables

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/**
 * Exposed table definition for the `follows` table.
 *
 * Represents unidirectional follow relationships between players.
 */
public object FollowsTable : Table("follows") {
    public val id = uuid("id").autoGenerate()
    public val followerId = uuid("follower_id").references(PlayersTable.id)
    public val followingId = uuid("following_id").references(PlayersTable.id)
    public val createdAt = timestampWithTimeZone("created_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)

    init {
        uniqueIndex("uq_follows_follower_following", followerId, followingId)
        index("idx_follows_follower", false, followerId, createdAt)
        index("idx_follows_following", false, followingId, createdAt)
    }
}
```

- [ ] **Step 4: Write FollowRepositoryImpl**

```kotlin
// server/src/main/kotlin/com/prizedraw/infrastructure/persistence/repositories/FollowRepositoryImpl.kt
package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IFollowRepository
import com.prizedraw.domain.entities.Follow
import com.prizedraw.infrastructure.persistence.tables.FollowsTable
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.deleteWhere
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.time.OffsetDateTime
import java.util.UUID

/**
 * Exposed implementation of [IFollowRepository].
 */
public class FollowRepositoryImpl : IFollowRepository {

    override suspend fun save(follow: Follow): Follow = newSuspendedTransaction {
        FollowsTable.insert {
            it[id] = follow.id
            it[followerId] = follow.followerId
            it[followingId] = follow.followingId
            it[createdAt] = OffsetDateTime.now()
        }
        follow
    }

    override suspend fun delete(followerId: UUID, followingId: UUID): Boolean = newSuspendedTransaction {
        FollowsTable.deleteWhere {
            (FollowsTable.followerId eq followerId) and (FollowsTable.followingId eq followingId)
        } > 0
    }

    override suspend fun exists(followerId: UUID, followingId: UUID): Boolean = newSuspendedTransaction {
        FollowsTable.selectAll()
            .where { (FollowsTable.followerId eq followerId) and (FollowsTable.followingId eq followingId) }
            .count() > 0
    }

    override suspend fun existsBatch(followerId: UUID, followingIds: List<UUID>): Set<UUID> = newSuspendedTransaction {
        if (followingIds.isEmpty()) return@newSuspendedTransaction emptySet()
        FollowsTable.select(FollowsTable.followingId)
            .where { (FollowsTable.followerId eq followerId) and (FollowsTable.followingId inList followingIds) }
            .map { it[FollowsTable.followingId] }
            .toSet()
    }

    override suspend fun findFollowing(followerId: UUID, limit: Int, offset: Int): List<Follow> =
        newSuspendedTransaction {
            FollowsTable.selectAll()
                .where { FollowsTable.followerId eq followerId }
                .orderBy(FollowsTable.createdAt, SortOrder.DESC)
                .limit(limit).offset(offset.toLong())
                .map(::toFollow)
        }

    override suspend fun findFollowers(followingId: UUID, limit: Int, offset: Int): List<Follow> =
        newSuspendedTransaction {
            FollowsTable.selectAll()
                .where { FollowsTable.followingId eq followingId }
                .orderBy(FollowsTable.createdAt, SortOrder.DESC)
                .limit(limit).offset(offset.toLong())
                .map(::toFollow)
        }

    override suspend fun countFollowing(playerId: UUID): Int = newSuspendedTransaction {
        FollowsTable.selectAll()
            .where { FollowsTable.followerId eq playerId }
            .count().toInt()
    }

    override suspend fun countFollowers(playerId: UUID): Int = newSuspendedTransaction {
        FollowsTable.selectAll()
            .where { FollowsTable.followingId eq playerId }
            .count().toInt()
    }

    override suspend fun findFollowerIdsBatch(followingId: UUID, afterFollowId: UUID?, limit: Int): List<Pair<UUID, UUID>> =
        newSuspendedTransaction {
            val query = FollowsTable.select(FollowsTable.id, FollowsTable.followerId)
                .where {
                    val base = FollowsTable.followingId eq followingId
                    if (afterFollowId != null) base and (FollowsTable.id greater afterFollowId) else base
                }
                .orderBy(FollowsTable.id, SortOrder.ASC)
                .limit(limit)
            query.map { it[FollowsTable.id] to it[FollowsTable.followerId] }
        }

    private fun toFollow(row: ResultRow): Follow = Follow(
        id = row[FollowsTable.id],
        followerId = row[FollowsTable.followerId],
        followingId = row[FollowsTable.followingId],
        createdAt = row[FollowsTable.createdAt].toInstant().toKotlinInstant(),
    )
}
```

- [ ] **Step 5: Write migration V027**

```sql
-- server/src/main/resources/db/migration/V027__create_follows.sql

CREATE TABLE follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_follows_follower_following UNIQUE (follower_id, following_id),
    CONSTRAINT chk_follows_no_self CHECK (follower_id != following_id)
);

CREATE INDEX idx_follows_follower ON follows (follower_id, created_at DESC);
CREATE INDEX idx_follows_following ON follows (following_id, created_at DESC);
```

- [ ] **Step 6: Register in RepositoryModule**

Modify `server/src/main/kotlin/com/prizedraw/infrastructure/di/RepositoryModule.kt`:

Add import:
```kotlin
import com.prizedraw.application.ports.output.IFollowRepository
import com.prizedraw.infrastructure.persistence.repositories.FollowRepositoryImpl
```

Add binding inside `module {}`:
```kotlin
// Follow system
single<IFollowRepository> { FollowRepositoryImpl() }
```

- [ ] **Step 7: Commit**

```bash
git add server/src/main/kotlin/com/prizedraw/domain/entities/Follow.kt \
       server/src/main/kotlin/com/prizedraw/application/ports/output/IFollowRepository.kt \
       server/src/main/kotlin/com/prizedraw/infrastructure/persistence/tables/FollowsTable.kt \
       server/src/main/kotlin/com/prizedraw/infrastructure/persistence/repositories/FollowRepositoryImpl.kt \
       server/src/main/resources/db/migration/V027__create_follows.sql \
       server/src/main/kotlin/com/prizedraw/infrastructure/di/RepositoryModule.kt
git commit -m "feat(follow): add Follow entity, repository port, Exposed impl, and migration"
```

---

## Task 3: API Contracts — DTOs + Endpoints + WebSocket Events

**Files:**
- Create: `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/endpoints/FollowEndpoints.kt`
- Create: `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/dto/follow/FollowDtos.kt`
- Modify: `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/dto/notification/NotificationDtos.kt`
- Modify: `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/dto/player/PlayerDtos.kt` (if exists)

- [ ] **Step 1: Write FollowEndpoints**

```kotlin
// api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/endpoints/FollowEndpoints.kt
package com.prizedraw.contracts.endpoints

/** API endpoint constants for the follow system. */
public object FollowEndpoints {
    public const val FOLLOW: String = "/api/v1/follows/{playerId}"
    public const val FOLLOWING_LIST: String = "/api/v1/follows/following"
    public const val FOLLOWERS_LIST: String = "/api/v1/follows/followers"
    public const val FOLLOW_STATUS: String = "/api/v1/follows/{playerId}/status"
    public const val BATCH_FOLLOW_STATUS: String = "/api/v1/follows/batch-status"
    public const val SEARCH_BY_CODE: String = "/api/v1/players/search"
}
```

- [ ] **Step 2: Write FollowDtos**

```kotlin
// api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/dto/follow/FollowDtos.kt
package com.prizedraw.contracts.dto.follow

import kotlinx.serialization.Serializable

/** A player summary used in follow lists and search results. */
@Serializable
public data class FollowPlayerDto(
    val playerId: String,
    val nickname: String,
    val avatarUrl: String?,
    val playerCode: String,
    val isFollowing: Boolean = false,
)

/** Paginated follow list response. */
@Serializable
public data class FollowListResponse(
    val items: List<FollowPlayerDto>,
    val total: Int,
    val limit: Int,
    val offset: Int,
)

/** Follow status check response. */
@Serializable
public data class FollowStatusResponse(
    val isFollowing: Boolean,
)

/** Batch follow status request body. */
@Serializable
public data class BatchFollowStatusRequest(
    val playerIds: List<String>,
)

/** Batch follow status response. Maps player IDs to follow status. */
@Serializable
public data class BatchFollowStatusResponse(
    val statuses: Map<String, Boolean>,
)

/** Player search result. */
@Serializable
public data class PlayerSearchResponse(
    val player: FollowPlayerDto?,
)
```

- [ ] **Step 3: Add new WebSocket event types**

Modify `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/dto/notification/NotificationDtos.kt`:

Add to `PlayerWsEventType` enum before the closing brace:
```kotlin
    // Follow
    FOLLOWING_DRAW_STARTED,
    FOLLOWING_RARE_PRIZE_DRAWN,
```

- [ ] **Step 4: Commit**

```bash
git add api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/endpoints/FollowEndpoints.kt \
       api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/dto/follow/FollowDtos.kt \
       api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/dto/notification/NotificationDtos.kt
git commit -m "feat(follow): add follow API contracts, DTOs, and WebSocket event types"
```

---

## Task 4: Follow Use Cases

**Files:**
- Create: `server/src/main/kotlin/com/prizedraw/application/ports/input/follow/IFollowPlayerUseCase.kt`
- Create: `server/src/main/kotlin/com/prizedraw/application/ports/input/follow/IUnfollowPlayerUseCase.kt`
- Create: `server/src/main/kotlin/com/prizedraw/application/ports/input/follow/IGetFollowingListUseCase.kt`
- Create: `server/src/main/kotlin/com/prizedraw/application/ports/input/follow/IGetFollowersListUseCase.kt`
- Create: `server/src/main/kotlin/com/prizedraw/application/ports/input/follow/IGetFollowStatusUseCase.kt`
- Create: `server/src/main/kotlin/com/prizedraw/application/ports/input/follow/ISearchPlayerByCodeUseCase.kt`
- Create: `server/src/main/kotlin/com/prizedraw/application/ports/input/follow/IBatchFollowStatusUseCase.kt`
- Create: `server/src/main/kotlin/com/prizedraw/application/usecases/follow/FollowPlayerUseCase.kt`
- Create: `server/src/main/kotlin/com/prizedraw/application/usecases/follow/UnfollowPlayerUseCase.kt`
- Create: `server/src/main/kotlin/com/prizedraw/application/usecases/follow/GetFollowingListUseCase.kt`
- Create: `server/src/main/kotlin/com/prizedraw/application/usecases/follow/GetFollowersListUseCase.kt`
- Create: `server/src/main/kotlin/com/prizedraw/application/usecases/follow/GetFollowStatusUseCase.kt`
- Create: `server/src/main/kotlin/com/prizedraw/application/usecases/follow/SearchPlayerByCodeUseCase.kt`
- Create: `server/src/main/kotlin/com/prizedraw/application/usecases/follow/BatchFollowStatusUseCase.kt`
- Create: `server/src/test/kotlin/com/prizedraw/usecases/follow/FollowPlayerUseCaseTest.kt`
- Create: `server/src/test/kotlin/com/prizedraw/usecases/follow/UnfollowPlayerUseCaseTest.kt`
- Create: `server/src/test/kotlin/com/prizedraw/usecases/follow/SearchPlayerByCodeUseCaseTest.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/infrastructure/di/UseCaseModule.kt`

- [ ] **Step 1: Write input port interfaces**

All follow input ports follow the same minimal pattern. Each file under `application/ports/input/follow/`:

```kotlin
// IFollowPlayerUseCase.kt
package com.prizedraw.application.ports.input.follow

import java.util.UUID

public interface IFollowPlayerUseCase {
    public suspend fun execute(followerId: UUID, targetPlayerId: UUID)
}
```

```kotlin
// IUnfollowPlayerUseCase.kt
package com.prizedraw.application.ports.input.follow

import java.util.UUID

public interface IUnfollowPlayerUseCase {
    public suspend fun execute(followerId: UUID, targetPlayerId: UUID)
}
```

```kotlin
// IGetFollowingListUseCase.kt
package com.prizedraw.application.ports.input.follow

import com.prizedraw.contracts.dto.follow.FollowListResponse
import java.util.UUID

public interface IGetFollowingListUseCase {
    public suspend fun execute(playerId: UUID, limit: Int, offset: Int): FollowListResponse
}
```

```kotlin
// IGetFollowersListUseCase.kt
package com.prizedraw.application.ports.input.follow

import com.prizedraw.contracts.dto.follow.FollowListResponse
import java.util.UUID

public interface IGetFollowersListUseCase {
    public suspend fun execute(playerId: UUID, limit: Int, offset: Int): FollowListResponse
}
```

```kotlin
// IGetFollowStatusUseCase.kt
package com.prizedraw.application.ports.input.follow

import java.util.UUID

public interface IGetFollowStatusUseCase {
    public suspend fun execute(followerId: UUID, targetPlayerId: UUID): Boolean
}
```

```kotlin
// ISearchPlayerByCodeUseCase.kt
package com.prizedraw.application.ports.input.follow

import com.prizedraw.contracts.dto.follow.FollowPlayerDto
import java.util.UUID

public interface ISearchPlayerByCodeUseCase {
    public suspend fun execute(requesterId: UUID, code: String): FollowPlayerDto?
}
```

```kotlin
// IBatchFollowStatusUseCase.kt
package com.prizedraw.application.ports.input.follow

import java.util.UUID

public interface IBatchFollowStatusUseCase {
    public suspend fun execute(followerId: UUID, targetPlayerIds: List<UUID>): Map<UUID, Boolean>
}
```

- [ ] **Step 2: Write FollowPlayerUseCase test**

```kotlin
// server/src/test/kotlin/com/prizedraw/usecases/follow/FollowPlayerUseCaseTest.kt
package com.prizedraw.usecases.follow

import com.prizedraw.application.ports.output.IFollowRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.usecases.follow.FollowPlayerUseCase
import com.prizedraw.domain.entities.Player
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import java.util.UUID

class FollowPlayerUseCaseTest : DescribeSpec({
    val followRepository = mockk<IFollowRepository>(relaxed = true)
    val playerRepository = mockk<IPlayerRepository>(relaxed = true)
    val useCase = FollowPlayerUseCase(followRepository, playerRepository)

    afterEach { clearAllMocks() }

    describe("execute") {
        val followerId = UUID.randomUUID()
        val targetId = UUID.randomUUID()

        it("creates a follow relationship when target exists and not already following") {
            coEvery { playerRepository.findById(any()) } returns mockk<Player>(relaxed = true)
            coEvery { followRepository.exists(followerId, targetId) } returns false
            coEvery { followRepository.save(any()) } returnsArgument 0

            useCase.execute(followerId, targetId)

            coVerify(exactly = 1) { followRepository.save(match { it.followerId == followerId && it.followingId == targetId }) }
        }

        it("throws when target player does not exist") {
            coEvery { playerRepository.findById(any()) } returns null

            shouldThrow<IllegalArgumentException> {
                useCase.execute(followerId, targetId)
            }
        }

        it("throws when already following") {
            coEvery { playerRepository.findById(any()) } returns mockk<Player>(relaxed = true)
            coEvery { followRepository.exists(followerId, targetId) } returns true

            shouldThrow<IllegalStateException> {
                useCase.execute(followerId, targetId)
            }
        }

        it("throws when trying to follow self") {
            shouldThrow<IllegalArgumentException> {
                useCase.execute(followerId, followerId)
            }
        }
    }
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `./gradlew :server:test --tests "com.prizedraw.usecases.follow.FollowPlayerUseCaseTest" --info`
Expected: FAIL — `FollowPlayerUseCase` not found

- [ ] **Step 4: Write all use case implementations**

```kotlin
// server/src/main/kotlin/com/prizedraw/application/usecases/follow/FollowPlayerUseCase.kt
package com.prizedraw.application.usecases.follow

import com.prizedraw.application.ports.input.follow.IFollowPlayerUseCase
import com.prizedraw.application.ports.output.IFollowRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.domain.entities.Follow
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Clock
import java.util.UUID

public class FollowPlayerUseCase(
    private val followRepository: IFollowRepository,
    private val playerRepository: IPlayerRepository,
) : IFollowPlayerUseCase {
    override suspend fun execute(followerId: UUID, targetPlayerId: UUID) {
        require(followerId != targetPlayerId) { "Cannot follow yourself" }

        val target = playerRepository.findById(PlayerId(targetPlayerId))
            ?: throw IllegalArgumentException("Target player not found")

        check(!followRepository.exists(followerId, targetPlayerId)) { "Already following this player" }

        followRepository.save(
            Follow(
                followerId = followerId,
                followingId = targetPlayerId,
                createdAt = Clock.System.now(),
            ),
        )
    }
}
```

```kotlin
// server/src/main/kotlin/com/prizedraw/application/usecases/follow/UnfollowPlayerUseCase.kt
package com.prizedraw.application.usecases.follow

import com.prizedraw.application.ports.input.follow.IUnfollowPlayerUseCase
import com.prizedraw.application.ports.output.IFollowRepository
import java.util.UUID

public class UnfollowPlayerUseCase(
    private val followRepository: IFollowRepository,
) : IUnfollowPlayerUseCase {
    override suspend fun execute(followerId: UUID, targetPlayerId: UUID) {
        followRepository.delete(followerId, targetPlayerId)
    }
}
```

```kotlin
// server/src/main/kotlin/com/prizedraw/application/usecases/follow/GetFollowingListUseCase.kt
package com.prizedraw.application.usecases.follow

import com.prizedraw.application.ports.input.follow.IGetFollowingListUseCase
import com.prizedraw.application.ports.output.IFollowRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.contracts.dto.follow.FollowListResponse
import com.prizedraw.contracts.dto.follow.FollowPlayerDto
import com.prizedraw.domain.valueobjects.PlayerId
import java.util.UUID

public class GetFollowingListUseCase(
    private val followRepository: IFollowRepository,
    private val playerRepository: IPlayerRepository,
) : IGetFollowingListUseCase {
    override suspend fun execute(playerId: UUID, limit: Int, offset: Int): FollowListResponse {
        val follows = followRepository.findFollowing(playerId, limit, offset)
        val total = followRepository.countFollowing(playerId)
        // Batch-load all players in one query to avoid N+1
        val playerIds = follows.map { PlayerId(it.followingId) }
        val playersById = playerRepository.findByIds(playerIds).associateBy { it.id.value }
        val items = follows.map { follow ->
            val player = playersById[follow.followingId]
            FollowPlayerDto(
                playerId = follow.followingId.toString(),
                nickname = player?.nickname ?: "",
                avatarUrl = player?.avatarUrl,
                playerCode = player?.playerCode ?: "",
                isFollowing = true,
            )
        }
        return FollowListResponse(items = items, total = total, limit = limit, offset = offset)
    }
}
```

```kotlin
// server/src/main/kotlin/com/prizedraw/application/usecases/follow/GetFollowersListUseCase.kt
package com.prizedraw.application.usecases.follow

import com.prizedraw.application.ports.input.follow.IGetFollowersListUseCase
import com.prizedraw.application.ports.output.IFollowRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.contracts.dto.follow.FollowListResponse
import com.prizedraw.contracts.dto.follow.FollowPlayerDto
import com.prizedraw.domain.valueobjects.PlayerId
import java.util.UUID

public class GetFollowersListUseCase(
    private val followRepository: IFollowRepository,
    private val playerRepository: IPlayerRepository,
) : IGetFollowersListUseCase {
    override suspend fun execute(playerId: UUID, limit: Int, offset: Int): FollowListResponse {
        val follows = followRepository.findFollowers(playerId, limit, offset)
        val total = followRepository.countFollowers(playerId)
        val followerIds = follows.map { it.followerId }
        // Batch-load all players + check which ones I follow back
        val playersById = playerRepository.findByIds(followerIds.map { PlayerId(it) }).associateBy { it.id.value }
        val followedByMe = followRepository.existsBatch(playerId, followerIds)
        val items = follows.map { follow ->
            val player = playersById[follow.followerId]
            FollowPlayerDto(
                playerId = follow.followerId.toString(),
                nickname = player?.nickname ?: "",
                avatarUrl = player?.avatarUrl,
                playerCode = player?.playerCode ?: "",
                isFollowing = follow.followerId in followedByMe,
            )
        }
        return FollowListResponse(items = items, total = total, limit = limit, offset = offset)
    }
}
```

```kotlin
// server/src/main/kotlin/com/prizedraw/application/usecases/follow/GetFollowStatusUseCase.kt
package com.prizedraw.application.usecases.follow

import com.prizedraw.application.ports.input.follow.IGetFollowStatusUseCase
import com.prizedraw.application.ports.output.IFollowRepository
import java.util.UUID

public class GetFollowStatusUseCase(
    private val followRepository: IFollowRepository,
) : IGetFollowStatusUseCase {
    override suspend fun execute(followerId: UUID, targetPlayerId: UUID): Boolean =
        followRepository.exists(followerId, targetPlayerId)
}
```

```kotlin
// server/src/main/kotlin/com/prizedraw/application/usecases/follow/SearchPlayerByCodeUseCase.kt
package com.prizedraw.application.usecases.follow

import com.prizedraw.application.ports.input.follow.ISearchPlayerByCodeUseCase
import com.prizedraw.application.ports.output.IFollowRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.contracts.dto.follow.FollowPlayerDto
import java.util.UUID

public class SearchPlayerByCodeUseCase(
    private val playerRepository: IPlayerRepository,
    private val followRepository: IFollowRepository,
) : ISearchPlayerByCodeUseCase {
    override suspend fun execute(requesterId: UUID, code: String): FollowPlayerDto? {
        val player = playerRepository.findByPlayerCode(code.uppercase()) ?: return null
        val isFollowing = followRepository.exists(requesterId, player.id.value)
        return FollowPlayerDto(
            playerId = player.id.value.toString(),
            nickname = player.nickname,
            avatarUrl = player.avatarUrl,
            playerCode = player.playerCode,
            isFollowing = isFollowing,
        )
    }
}
```

```kotlin
// server/src/main/kotlin/com/prizedraw/application/usecases/follow/BatchFollowStatusUseCase.kt
package com.prizedraw.application.usecases.follow

import com.prizedraw.application.ports.input.follow.IBatchFollowStatusUseCase
import com.prizedraw.application.ports.output.IFollowRepository
import java.util.UUID

public class BatchFollowStatusUseCase(
    private val followRepository: IFollowRepository,
) : IBatchFollowStatusUseCase {
    override suspend fun execute(followerId: UUID, targetPlayerIds: List<UUID>): Map<UUID, Boolean> {
        val followedSet = followRepository.existsBatch(followerId, targetPlayerIds)
        return targetPlayerIds.associateWith { it in followedSet }
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `./gradlew :server:test --tests "com.prizedraw.usecases.follow.*" --info`
Expected: PASS

- [ ] **Step 6: Register use cases in UseCaseModule**

Modify `server/src/main/kotlin/com/prizedraw/infrastructure/di/UseCaseModule.kt`:

Add imports and bindings inside `module {}`:
```kotlin
// --- Follow System ---
single<IFollowPlayerUseCase> {
    FollowPlayerUseCase(
        followRepository = get<IFollowRepository>(),
        playerRepository = get<IPlayerRepository>(),
    )
}
single<IUnfollowPlayerUseCase> {
    UnfollowPlayerUseCase(followRepository = get<IFollowRepository>())
}
single<IGetFollowingListUseCase> {
    GetFollowingListUseCase(
        followRepository = get<IFollowRepository>(),
        playerRepository = get<IPlayerRepository>(),
    )
}
single<IGetFollowersListUseCase> {
    GetFollowersListUseCase(
        followRepository = get<IFollowRepository>(),
        playerRepository = get<IPlayerRepository>(),
    )
}
single<IGetFollowStatusUseCase> {
    GetFollowStatusUseCase(followRepository = get<IFollowRepository>())
}
single<ISearchPlayerByCodeUseCase> {
    SearchPlayerByCodeUseCase(
        playerRepository = get<IPlayerRepository>(),
        followRepository = get<IFollowRepository>(),
    )
}
single<IBatchFollowStatusUseCase> {
    BatchFollowStatusUseCase(followRepository = get<IFollowRepository>())
}
```

- [ ] **Step 7: Commit**

```bash
git add server/src/main/kotlin/com/prizedraw/application/ports/input/follow/ \
       server/src/main/kotlin/com/prizedraw/application/usecases/follow/ \
       server/src/test/kotlin/com/prizedraw/usecases/follow/ \
       server/src/main/kotlin/com/prizedraw/infrastructure/di/UseCaseModule.kt
git commit -m "feat(follow): add follow use cases with tests and DI registration"
```

---

## Task 5: Ktor Routes + Rate Limiting

**Files:**
- Create: `server/src/main/kotlin/com/prizedraw/api/routes/FollowRoutes.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/api/plugins/Routing.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/api/plugins/RateLimit.kt`

- [ ] **Step 1: Write FollowRoutes**

```kotlin
// server/src/main/kotlin/com/prizedraw/api/routes/FollowRoutes.kt
package com.prizedraw.api.routes

import com.prizedraw.application.ports.input.follow.IBatchFollowStatusUseCase
import com.prizedraw.application.ports.input.follow.IFollowPlayerUseCase
import com.prizedraw.application.ports.input.follow.IGetFollowStatusUseCase
import com.prizedraw.application.ports.input.follow.IGetFollowersListUseCase
import com.prizedraw.application.ports.input.follow.IGetFollowingListUseCase
import com.prizedraw.application.ports.input.follow.ISearchPlayerByCodeUseCase
import com.prizedraw.application.ports.input.follow.IUnfollowPlayerUseCase
import com.prizedraw.contracts.dto.follow.BatchFollowStatusRequest
import com.prizedraw.contracts.dto.follow.BatchFollowStatusResponse
import com.prizedraw.contracts.dto.follow.FollowStatusResponse
import com.prizedraw.contracts.dto.follow.PlayerSearchResponse
import io.ktor.http.HttpStatusCode
import io.ktor.server.auth.authenticate
import io.ktor.server.auth.principal
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import java.util.UUID

/**
 * Registers follow system routes.
 *
 * All routes require `player` JWT authentication.
 * Uses project's RouteKoinExt.inject() — not org.koin.ktor.ext.inject.
 */
public fun Route.followRoutes() {
    val followPlayerUseCase by inject<IFollowPlayerUseCase>()
    val unfollowPlayerUseCase by inject<IUnfollowPlayerUseCase>()
    val getFollowingListUseCase by inject<IGetFollowingListUseCase>()
    val getFollowersListUseCase by inject<IGetFollowersListUseCase>()
    val getFollowStatusUseCase by inject<IGetFollowStatusUseCase>()
    val searchPlayerByCodeUseCase by inject<ISearchPlayerByCodeUseCase>()
    val batchFollowStatusUseCase by inject<IBatchFollowStatusUseCase>()

    authenticate("player") {
        route("/api/v1/follows") {
            // GET /api/v1/follows/following?limit=20&offset=0
            get("/following") {
                val principal = call.principal<PlayerPrincipal>() ?: error("Missing principal")
                val limit = (call.request.queryParameters["limit"]?.toIntOrNull() ?: 20).coerceIn(1, 50)
                val offset = (call.request.queryParameters["offset"]?.toIntOrNull() ?: 0).coerceAtLeast(0)
                val result = getFollowingListUseCase.execute(principal.playerId, limit, offset)
                call.respond(HttpStatusCode.OK, result)
            }

            // GET /api/v1/follows/followers?limit=20&offset=0
            get("/followers") {
                val principal = call.principal<PlayerPrincipal>() ?: error("Missing principal")
                val limit = (call.request.queryParameters["limit"]?.toIntOrNull() ?: 20).coerceIn(1, 50)
                val offset = (call.request.queryParameters["offset"]?.toIntOrNull() ?: 0).coerceAtLeast(0)
                val result = getFollowersListUseCase.execute(principal.playerId, limit, offset)
                call.respond(HttpStatusCode.OK, result)
            }

            // POST /api/v1/follows/batch-status
            post("/batch-status") {
                val principal = call.principal<PlayerPrincipal>() ?: error("Missing principal")
                val request = call.receive<BatchFollowStatusRequest>()
                val targetIds = request.playerIds.map { UUID.fromString(it) }
                val statuses = batchFollowStatusUseCase.execute(principal.playerId, targetIds)
                call.respond(
                    HttpStatusCode.OK,
                    BatchFollowStatusResponse(statuses.mapKeys { it.key.toString() }),
                )
            }

            // POST /api/v1/follows/{playerId}  (rate-limited under "follow" tier)
            post("/{playerId}") {
                val principal = call.principal<PlayerPrincipal>() ?: error("Missing principal")
                val targetId = UUID.fromString(call.parameters["playerId"] ?: error("Missing playerId"))
                try {
                    followPlayerUseCase.execute(principal.playerId, targetId)
                    call.respond(HttpStatusCode.Created)
                } catch (e: IllegalArgumentException) {
                    // Distinguish self-follow (400) from target-not-found (404)
                    if (e.message?.contains("yourself") == true) {
                        call.respond(HttpStatusCode.BadRequest, mapOf("error" to e.message))
                    } else {
                        call.respond(HttpStatusCode.NotFound, mapOf("error" to e.message))
                    }
                } catch (e: IllegalStateException) {
                    call.respond(HttpStatusCode.Conflict, mapOf("error" to e.message))
                }
            }

            // DELETE /api/v1/follows/{playerId}  (rate-limited under "follow" tier)
            delete("/{playerId}") {
                val principal = call.principal<PlayerPrincipal>() ?: error("Missing principal")
                val targetId = UUID.fromString(call.parameters["playerId"] ?: error("Missing playerId"))
                unfollowPlayerUseCase.execute(principal.playerId, targetId)
                call.respond(HttpStatusCode.NoContent)
            }

            // GET /api/v1/follows/{playerId}/status
            get("/{playerId}/status") {
                val principal = call.principal<PlayerPrincipal>() ?: error("Missing principal")
                val targetId = UUID.fromString(call.parameters["playerId"] ?: error("Missing playerId"))
                val isFollowing = getFollowStatusUseCase.execute(principal.playerId, targetId)
                call.respond(HttpStatusCode.OK, FollowStatusResponse(isFollowing))
            }
        }

        // GET /api/v1/players/search?code={code}
        get("/api/v1/players/search") {
            val principal = call.principal<PlayerPrincipal>() ?: error("Missing principal")
            val code = call.request.queryParameters["code"] ?: ""
            val player = searchPlayerByCodeUseCase.execute(principal.playerId, code)
            call.respond(HttpStatusCode.OK, PlayerSearchResponse(player))
        }
    }
}
```

- [ ] **Step 2: Add follow rate limit tier**

Modify `server/src/main/kotlin/com/prizedraw/api/plugins/RateLimit.kt`:

Add a new rate limit tier:
```kotlin
rateLimit(RateLimitName("follow")) {
    rateLimiter(limit = 30, refillPeriod = 60.seconds)
    requestKey { call -> call.principal<PlayerPrincipal>()?.playerId?.toString() ?: "anon" }
}
```

Wrap the follow/unfollow routes (POST/DELETE) in the `follow` rate limit in FollowRoutes.

- [ ] **Step 3: Mount routes in Routing.kt**

Modify `server/src/main/kotlin/com/prizedraw/api/plugins/Routing.kt`:

Add:
```kotlin
followRoutes()
```

- [ ] **Step 4: Verify build compiles**

Run: `./gradlew :server:build -x test`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add server/src/main/kotlin/com/prizedraw/api/routes/FollowRoutes.kt \
       server/src/main/kotlin/com/prizedraw/api/plugins/Routing.kt \
       server/src/main/kotlin/com/prizedraw/api/plugins/RateLimit.kt
git commit -m "feat(follow): add Ktor follow routes with rate limiting"
```

---

## Task 6: Prize is_rare + Migration

**Files:**
- Create: `server/src/main/resources/db/migration/V028__add_prize_is_rare.sql`
- Modify: `server/src/main/kotlin/com/prizedraw/domain/entities/PrizeDefinition.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/infrastructure/persistence/tables/PrizesTable.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/infrastructure/persistence/repositories/PrizeRepositoryImpl.kt`

- [ ] **Step 1: Write migration**

```sql
-- server/src/main/resources/db/migration/V028__add_prize_is_rare.sql

ALTER TABLE prize_definitions ADD COLUMN is_rare BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 2: Add isRare to PrizeDefinition entity**

Modify `server/src/main/kotlin/com/prizedraw/domain/entities/PrizeDefinition.kt`:

Add `@property isRare` KDoc and property:
```kotlin
/** Whether this prize triggers follower notifications when drawn. */
val isRare: Boolean = false,
```

- [ ] **Step 3: Add isRare to PrizesTable**

Modify the prize definitions section in `server/src/main/kotlin/com/prizedraw/infrastructure/persistence/tables/PrizesTable.kt`:

Add column:
```kotlin
val isRare = bool("is_rare").default(false)
```

- [ ] **Step 4: Update PrizeRepositoryImpl mappings**

Modify `server/src/main/kotlin/com/prizedraw/infrastructure/persistence/repositories/PrizeRepositoryImpl.kt`:
- Add `isRare = row[PrizeDefinitionsTable.isRare]` to the `toPrizeDefinition()` mapper
- Add `isRare` to insert/update operations

- [ ] **Step 5: Commit**

```bash
git add server/src/main/resources/db/migration/V028__add_prize_is_rare.sql \
       server/src/main/kotlin/com/prizedraw/domain/entities/PrizeDefinition.kt \
       server/src/main/kotlin/com/prizedraw/infrastructure/persistence/tables/PrizesTable.kt \
       server/src/main/kotlin/com/prizedraw/infrastructure/persistence/repositories/PrizeRepositoryImpl.kt
git commit -m "feat(follow): add is_rare column to prize_definitions for follower notifications"
```

---

## Task 7: Notification Fan-out — Domain Events + OutboxWorker

**Files:**
- Modify: `server/src/main/kotlin/com/prizedraw/application/events/DomainEvent.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/application/events/OutboxWorker.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/application/usecases/draw/DrawKujiUseCase.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/application/usecases/draw/DrawUnlimitedUseCase.kt`
- Modify: `server/src/main/resources/i18n/messages_zh_TW.properties`
- Modify: `server/src/main/resources/i18n/messages_en.properties`
- Create: `server/src/test/kotlin/com/prizedraw/integration/FollowNotificationTest.kt`

- [ ] **Step 1: Add domain events**

Modify `server/src/main/kotlin/com/prizedraw/application/events/DomainEvent.kt`:

Add two new events:
```kotlin
/** Emitted when a player starts drawing; triggers fan-out to followers. */
public data class FollowingDrawStarted(
    val playerId: UUID,
    val playerNickname: String,
    val campaignId: UUID,
    val campaignName: String,
) : DomainEvent {
    override val eventType: String = "following.draw_started"
    override val aggregateType: String = "Player"
    override val aggregateId: UUID = playerId
}

/** Emitted when a player draws a rare prize; triggers fan-out to followers. */
public data class FollowingRarePrizeDrawn(
    val playerId: UUID,
    val playerNickname: String,
    val campaignId: UUID,
    val campaignName: String,
    val prizeName: String,
    val prizeGrade: String,
) : DomainEvent {
    override val eventType: String = "following.rare_prize_drawn"
    override val aggregateType: String = "Player"
    override val aggregateId: UUID = playerId
}
```

- [ ] **Step 2: Emit draw_started in DrawKujiUseCase**

Modify `server/src/main/kotlin/com/prizedraw/application/usecases/draw/DrawKujiUseCase.kt`:

After the draw business logic completes, before returning, add:
```kotlin
// Notify followers that this player started drawing
outboxRepository.enqueue(
    FollowingDrawStarted(
        playerId = player.id.value.toString(),
        playerNickname = player.nickname,
        campaignId = campaign.id.toString(),
        campaignName = campaign.title,
    ),
)
```

And if the prize drawn has `isRare == true`:
```kotlin
if (prizeDefinition.isRare) {
    outboxRepository.enqueue(
        FollowingRarePrizeDrawn(
            playerId = player.id.value.toString(),
            playerNickname = player.nickname,
            campaignId = campaign.id.toString(),
            campaignName = campaign.title,
            prizeName = prizeDefinition.name,
            prizeGrade = prizeDefinition.grade,
        ),
    )
}
```

- [ ] **Step 3: Emit draw_started in DrawUnlimitedUseCase**

Same pattern as Step 2 in `DrawUnlimitedUseCase.kt`.

- [ ] **Step 4: Add fan-out handlers in OutboxWorker**

Modify `server/src/main/kotlin/com/prizedraw/application/events/OutboxWorker.kt`:

The OutboxWorker needs a new dependency: `IFollowRepository`. Add it to the constructor.

Add to the `dispatch()` when-block:
```kotlin
"following.draw_started" -> handleFollowingDrawStarted(event)
"following.rare_prize_drawn" -> handleFollowingRarePrizeDrawn(event)
```

Override `extractPlayerIds()` for follow events to return empty (fan-out handled separately):
```kotlin
"following.draw_started", "following.rare_prize_drawn" -> emptyList()
```

Add handler methods:
```kotlin
private suspend fun handleFollowingDrawStarted(event: OutboxEvent) {
    fanOutToFollowers(event, "notification.following.draw_started")
}

private suspend fun handleFollowingRarePrizeDrawn(event: OutboxEvent) {
    fanOutToFollowers(event, "notification.following.rare_prize_drawn")
}

/**
 * Fans out notifications to all followers of the player in the event.
 * Uses cursor-based batching (500 per batch) to avoid memory issues.
 * Dispatches as a dedicated coroutine to not block other outbox processing.
 */
private suspend fun fanOutToFollowers(event: OutboxEvent, i18nKey: String) {
    val drawingPlayerId = event.payload["playerId"]?.jsonPrimitive?.content ?: return
    val playerUuid = UUID.fromString(drawingPlayerId)
    val nickname = event.payload["playerNickname"]?.jsonPrimitive?.content ?: ""
    val campaignName = event.payload["campaignName"]?.jsonPrimitive?.content ?: ""

    val title = i18nService.get(i18nKey + ".title")
    val body = i18nService.get(i18nKey + ".body", nickname, campaignName)

    scope.launch {
        var afterFollowId: UUID? = null
        while (true) {
            // Returns List<Pair<followId, followerId>>
            val batch = followRepository.findFollowerIdsBatch(playerUuid, afterFollowId, FCM_BATCH_SIZE)
            if (batch.isEmpty()) break

            val followerIds = batch.map { it.second }

            // Persist notifications in bulk
            val notifications = followerIds.map { followerId ->
                Notification(
                    playerId = followerId,
                    eventType = event.eventType,
                    title = title,
                    body = body,
                    data = event.payload.mapValues { it.value.jsonPrimitive.content },
                )
            }
            notificationRepository.batchInsertIgnore(notifications)

            // WebSocket push to online followers
            for (followerId in followerIds) {
                val wsPayload = buildWsPayload(event, notifications.first { it.playerId == followerId })
                pubSub.publish("ws:player:$followerId", wsPayload)
            }

            // FCM batch push
            notificationService.sendPushBatch(
                followerIds.map { PlayerId(it) },
                PushNotificationPayload(
                    title = title,
                    body = body,
                    data = mapOf(
                        "eventType" to event.eventType,
                        "campaignId" to (event.payload["campaignId"]?.jsonPrimitive?.content ?: ""),
                    ),
                ),
            )

            // Use the last follow row's ID as cursor for next batch
            afterFollowId = batch.lastOrNull()?.first
            if (batch.size < FCM_BATCH_SIZE) break
        }
    }
}

private companion object {
    const val POLL_INTERVAL_SECONDS = 5L
    const val BATCH_SIZE = 100
    const val MAX_ATTEMPTS = 5
    const val FCM_BATCH_SIZE = 500
    val BASE_BACKOFF = 2.seconds
}
```

- [ ] **Step 5: Add i18n keys**

Modify `server/src/main/resources/i18n/messages_zh_TW.properties`:
```properties
notification.following.draw_started.title=好友正在抽獎
notification.following.draw_started.body={0} 正在抽 {1}！快來圍觀！
notification.following.rare_prize_drawn.title=好友抽到大獎！
notification.following.rare_prize_drawn.body={0} 在 {1} 抽到了 {2}！
```

Modify `server/src/main/resources/i18n/messages_en.properties`:
```properties
notification.following.draw_started.title=Friend is drawing
notification.following.draw_started.body={0} is drawing in {1}! Come watch!
notification.following.rare_prize_drawn.title=Friend hit a rare prize!
notification.following.rare_prize_drawn.body={0} drew {1} in {2}!
```

- [ ] **Step 6: Write notification fan-out test**

```kotlin
// server/src/test/kotlin/com/prizedraw/integration/FollowNotificationTest.kt
package com.prizedraw.integration

import com.prizedraw.application.events.OutboxWorker
import com.prizedraw.application.ports.output.IFollowRepository
import com.prizedraw.application.ports.output.INotificationRepository
import com.prizedraw.application.ports.output.INotificationService
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPubSubService
import com.prizedraw.domain.entities.OutboxEvent
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import java.util.UUID

class FollowNotificationTest : DescribeSpec({
    val outboxRepo = mockk<IOutboxRepository>(relaxed = true)
    val notificationService = mockk<INotificationService>(relaxed = true)
    val pubSub = mockk<IPubSubService>(relaxed = true)
    val notificationRepo = mockk<INotificationRepository>(relaxed = true)
    val followRepo = mockk<IFollowRepository>(relaxed = true)

    afterEach { clearAllMocks() }

    describe("following.draw_started fan-out") {
        it("sends notifications to all followers in batches") {
            val drawingPlayerId = UUID.randomUUID()
            val follower1 = UUID.randomUUID()
            val follower2 = UUID.randomUUID()

            coEvery { followRepo.findFollowerIdsBatch(drawingPlayerId, null, 500) } returns listOf(follower1, follower2)
            coEvery { followRepo.findFollowerIdsBatch(drawingPlayerId, any(), 500) } returns emptyList()

            // Verify that batchInsertIgnore is called with 2 notifications
            coVerify(timeout = 5000) {
                notificationRepo.batchInsertIgnore(match { it.size == 2 })
            }
        }
    }
})
```

- [ ] **Step 7: Run tests**

Run: `./gradlew :server:test --tests "com.prizedraw.integration.FollowNotificationTest" --info`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add server/src/main/kotlin/com/prizedraw/application/events/DomainEvent.kt \
       server/src/main/kotlin/com/prizedraw/application/events/OutboxWorker.kt \
       server/src/main/kotlin/com/prizedraw/application/usecases/draw/DrawKujiUseCase.kt \
       server/src/main/kotlin/com/prizedraw/application/usecases/draw/DrawUnlimitedUseCase.kt \
       server/src/main/resources/i18n/ \
       server/src/test/kotlin/com/prizedraw/integration/FollowNotificationTest.kt
git commit -m "feat(follow): add follow notification fan-out via outbox worker"
```

---

## Task 8: Player Profile Updates

**Files:**
- Modify: `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/dto/player/PlayerDtos.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/application/usecases/player/GetPlayerProfileUseCase.kt`
- Modify: login/registration flow to generate player code on new player creation

- [ ] **Step 1: Add follow fields to player profile DTO**

Modify the player profile DTO to include:
```kotlin
val playerCode: String,
val followerCount: Int,
val followingCount: Int,
```

- [ ] **Step 2: Update GetPlayerProfileUseCase**

Add `IFollowRepository` dependency. In `execute()`, query follower/following counts and include in response along with `playerCode`.

- [ ] **Step 3: Generate player code on registration**

Modify the login/registration use case (LoginUseCase) to call `PlayerCodeGenerator.generate()` and set it on new Player entities, with a retry loop for collisions:
```kotlin
var playerCode: String
do {
    playerCode = PlayerCodeGenerator.generate()
} while (playerRepository.findByPlayerCode(playerCode) != null)
```

- [ ] **Step 4: Verify build**

Run: `./gradlew :server:build -x test`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/dto/player/ \
       server/src/main/kotlin/com/prizedraw/application/usecases/player/GetPlayerProfileUseCase.kt \
       server/src/main/kotlin/com/prizedraw/application/usecases/auth/LoginUseCase.kt
git commit -m "feat(follow): add playerCode, followerCount, followingCount to player profile"
```

---

## Task 9: Full Build + Integration Test

- [ ] **Step 1: Run full test suite**

Run: `./gradlew :server:test --info`
Expected: All tests PASS

- [ ] **Step 2: Run lint**

Run: `./gradlew ktlintCheck detekt`
Expected: No violations

- [ ] **Step 3: Fix any issues found**

Address lint/test failures.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(follow): follow system complete — all tests passing"
```
