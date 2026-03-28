# Banner Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a banner carousel system for promotional images, managed via admin dashboard, displayed on mobile app and web player.

**Architecture:** New `banners` domain following existing hexagonal architecture (ports-and-adapters). Server-side direct upload via `POST /api/v1/storage/upload` (shared endpoint, reuses existing `ImageUpload.tsx` component). Public `GET /api/v1/banners` endpoint with Redis caching for client consumption.

**Tech Stack:** Kotlin/Ktor 3.x, Exposed ORM, Koin DI, PostgreSQL, S3/MinIO, Next.js 14 admin dashboard, Redis cache

**Spec:** `docs/superpowers/specs/2026-03-28-banner-carousel-design.md`

**Deviations from spec:**
1. The spec proposed presigned URL upload (`POST /api/v1/admin/banners/upload-url`). The admin already has an `ImageUpload.tsx` component that posts directly to `POST /api/v1/storage/upload` (used by campaigns/prizes). We create that shared server endpoint instead, so we reuse the existing component without changes. The `GenerateBannerUploadUrlRequest/Response` DTOs from the spec are replaced by this approach.
2. The spec lists `ListActiveBannersUseCase` and `ListAllBannersUseCase`. These are skipped — the routes call the repository directly for simple read-only queries with no business logic, which is consistent with how `StatusRoutes.kt` and `AdminAnnouncementRoutes.kt` work in this codebase.

---

## File Structure

### New Files

| File | Responsibility |
|------|----------------|
| `server/src/main/resources/db/migration/V029__create_banners.sql` | Database table |
| `api-contracts/.../endpoints/BannerEndpoints.kt` | Endpoint path constants |
| `api-contracts/.../dto/banner/BannerDtos.kt` | DTOs for banner CRUD |
| `api-contracts/.../dto/storage/StorageDtos.kt` | DTO for storage upload response |
| `api-contracts/.../endpoints/StorageEndpoints.kt` | Storage upload endpoint constant |
| `server/.../domain/entities/Banner.kt` | Domain entity |
| `server/.../application/ports/input/admin/BannerUseCasePorts.kt` | Use case interfaces + commands + exception |
| `server/.../application/ports/output/IBannerRepository.kt` | Repository port |
| `server/.../application/usecases/admin/CreateBannerUseCase.kt` | Create use case |
| `server/.../application/usecases/admin/UpdateBannerUseCase.kt` | Update use case |
| `server/.../application/usecases/admin/DeactivateBannerUseCase.kt` | Soft-delete use case |
| `server/.../infrastructure/persistence/tables/BannersTable.kt` | Exposed table definition |
| `server/.../infrastructure/persistence/repositories/BannerRepositoryImpl.kt` | Repository implementation |
| `server/.../api/routes/AdminBannerRoutes.kt` | Admin CRUD routes |
| `server/.../api/routes/BannerRoutes.kt` | Public list route |
| `server/.../api/routes/StorageUploadRoute.kt` | Shared file upload endpoint |
| `admin/src/app/(admin)/banners/page.tsx` | Admin banner management page |

### Modified Files

| File | Change |
|------|--------|
| `server/.../infrastructure/di/RepositoryModule.kt` | Add `IBannerRepository` binding |
| `server/.../infrastructure/di/UseCaseModule.kt` | Add banner use case bindings |
| `server/.../api/plugins/Routing.kt` | Mount banner + storage routes |
| `admin/src/lib/roles.ts` | Add banner nav item to `NAV_ITEMS` |

---

## Task 1: Database Migration

**Files:**
- Create: `server/src/main/resources/db/migration/V029__create_banners.sql`

- [ ] **Step 1: Create migration file**

```sql
-- V029__create_banners.sql
CREATE TABLE banners (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url       TEXT NOT NULL,
    link_type       VARCHAR(20),
    link_url        TEXT,
    sort_order      INT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    scheduled_start TIMESTAMPTZ,
    scheduled_end   TIMESTAMPTZ,
    created_by      UUID NOT NULL REFERENCES staff(id),
    updated_by      UUID REFERENCES staff(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_banners_active_schedule ON banners (is_active, scheduled_start, scheduled_end);
```

- [ ] **Step 2: Verify migration compiles**

Run: `cd /Users/ken/Project/PrizeDraw/PrizeDraw && ./gradlew build -x test`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add server/src/main/resources/db/migration/V029__create_banners.sql
git commit -m "feat(db): add banners table migration V029"
```

---

## Task 2: API Contracts — Endpoints + DTOs

**Files:**
- Create: `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/endpoints/BannerEndpoints.kt`
- Create: `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/dto/banner/BannerDtos.kt`
- Create: `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/endpoints/StorageEndpoints.kt`
- Create: `api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/dto/storage/StorageDtos.kt`

- [ ] **Step 1: Create BannerEndpoints.kt**

```kotlin
package com.prizedraw.contracts.endpoints

public object BannerEndpoints {
    public const val BANNERS: String = "/api/v1/banners"
    public const val ADMIN_BANNERS: String = "/api/v1/admin/banners"
    public const val ADMIN_BANNER_BY_ID: String = "/api/v1/admin/banners/{id}"
}
```

- [ ] **Step 2: Create BannerDtos.kt**

```kotlin
package com.prizedraw.contracts.dto.banner

import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

@Serializable
public data class BannerDto(
    val id: String,
    val imageUrl: String,
    val linkType: String? = null,
    val linkUrl: String? = null,
    val sortOrder: Int,
    val isActive: Boolean,
    val scheduledStart: Instant? = null,
    val scheduledEnd: Instant? = null,
)

@Serializable
public data class CreateBannerRequest(
    val imageUrl: String,
    val linkType: String? = null,
    val linkUrl: String? = null,
    val sortOrder: Int = 0,
    val scheduledStart: Instant? = null,
    val scheduledEnd: Instant? = null,
)

@Serializable
public data class UpdateBannerRequest(
    val imageUrl: String? = null,
    val linkType: String? = null,
    val linkUrl: String? = null,
    val sortOrder: Int? = null,
    val isActive: Boolean? = null,
    val scheduledStart: Instant? = null,
    val scheduledEnd: Instant? = null,
)
```

- [ ] **Step 3: Create StorageEndpoints.kt**

```kotlin
package com.prizedraw.contracts.endpoints

public object StorageEndpoints {
    public const val UPLOAD: String = "/api/v1/storage/upload"
}
```

- [ ] **Step 4: Create StorageDtos.kt**

```kotlin
package com.prizedraw.contracts.dto.storage

import kotlinx.serialization.Serializable

@Serializable
public data class UploadResponse(
    val url: String,
)
```

- [ ] **Step 5: Verify build**

Run: `cd /Users/ken/Project/PrizeDraw/PrizeDraw && ./gradlew build -x test`
Expected: BUILD SUCCESSFUL

- [ ] **Step 6: Commit**

```bash
git add api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/endpoints/BannerEndpoints.kt \
  api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/dto/banner/BannerDtos.kt \
  api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/endpoints/StorageEndpoints.kt \
  api-contracts/src/commonMain/kotlin/com/prizedraw/contracts/dto/storage/StorageDtos.kt
git commit -m "feat(contracts): add banner and storage upload DTOs and endpoints"
```

---

## Task 3: Domain Entity

**Files:**
- Create: `server/src/main/kotlin/com/prizedraw/domain/entities/Banner.kt`

- [ ] **Step 1: Create Banner entity**

```kotlin
package com.prizedraw.domain.entities

import kotlinx.datetime.Instant
import java.util.UUID

public data class Banner(
    val id: UUID,
    val imageUrl: String,
    val linkType: String?,
    val linkUrl: String?,
    val sortOrder: Int,
    val isActive: Boolean,
    val scheduledStart: Instant?,
    val scheduledEnd: Instant?,
    val createdBy: UUID,
    val updatedBy: UUID?,
    val createdAt: Instant,
    val updatedAt: Instant,
)
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/ken/Project/PrizeDraw/PrizeDraw && ./gradlew build -x test`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add server/src/main/kotlin/com/prizedraw/domain/entities/Banner.kt
git commit -m "feat(domain): add Banner entity"
```

---

## Task 4: Repository Port + Implementation

**Files:**
- Create: `server/src/main/kotlin/com/prizedraw/application/ports/output/IBannerRepository.kt`
- Create: `server/src/main/kotlin/com/prizedraw/infrastructure/persistence/tables/BannersTable.kt`
- Create: `server/src/main/kotlin/com/prizedraw/infrastructure/persistence/repositories/BannerRepositoryImpl.kt`

- [ ] **Step 1: Create IBannerRepository port**

```kotlin
package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.Banner
import java.util.UUID

public interface IBannerRepository {
    public suspend fun findAllActive(): List<Banner>
    public suspend fun findAll(): List<Banner>
    public suspend fun findById(id: UUID): Banner?
    public suspend fun save(banner: Banner): Banner
    public suspend fun deactivate(id: UUID, updatedBy: UUID): Banner?
}
```

- [ ] **Step 2: Create BannersTable (Exposed)**

```kotlin
package com.prizedraw.infrastructure.persistence.tables

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

public object BannersTable : Table("banners") {
    public val id = uuid("id").autoGenerate()
    public val imageUrl = text("image_url")
    public val linkType = varchar("link_type", 20).nullable()
    public val linkUrl = text("link_url").nullable()
    public val sortOrder = integer("sort_order").default(0)
    public val isActive = bool("is_active").default(true)
    public val scheduledStart = timestampWithTimeZone("scheduled_start").nullable()
    public val scheduledEnd = timestampWithTimeZone("scheduled_end").nullable()
    public val createdBy = uuid("created_by")
    public val updatedBy = uuid("updated_by").nullable()
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}
```

- [ ] **Step 3: Create BannerRepositoryImpl**

Follow the `ServerAnnouncementRepositoryImpl` pattern exactly: use `newSuspendedTransaction`, `ResultRow` mapper, `OffsetDateTime` conversions.

```kotlin
package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IBannerRepository
import com.prizedraw.domain.entities.Banner
import com.prizedraw.infrastructure.persistence.tables.BannersTable
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

public class BannerRepositoryImpl : IBannerRepository {

    override suspend fun findAllActive(): List<Banner> =
        newSuspendedTransaction {
            val now = OffsetDateTime.now(ZoneOffset.UTC)
            BannersTable
                .selectAll()
                .where {
                    (BannersTable.isActive eq true) and
                        ((BannersTable.scheduledStart.isNull()) or (BannersTable.scheduledStart lessEq now)) and
                        ((BannersTable.scheduledEnd.isNull()) or (BannersTable.scheduledEnd greater now))
                }
                .orderBy(BannersTable.sortOrder to SortOrder.ASC, BannersTable.createdAt to SortOrder.DESC)
                .map { it.toBanner() }
        }

    override suspend fun findAll(): List<Banner> =
        newSuspendedTransaction {
            BannersTable
                .selectAll()
                .orderBy(BannersTable.sortOrder to SortOrder.ASC, BannersTable.createdAt to SortOrder.DESC)
                .map { it.toBanner() }
        }

    override suspend fun findById(id: UUID): Banner? =
        newSuspendedTransaction {
            BannersTable
                .selectAll()
                .where { BannersTable.id eq id }
                .singleOrNull()
                ?.toBanner()
        }

    override suspend fun save(banner: Banner): Banner =
        newSuspendedTransaction {
            val now = OffsetDateTime.ofInstant(banner.updatedAt.toJavaInstant(), ZoneOffset.UTC)
            val exists = BannersTable.selectAll().where { BannersTable.id eq banner.id }.count() > 0

            if (exists) {
                BannersTable.update({ BannersTable.id eq banner.id }) {
                    it[imageUrl] = banner.imageUrl
                    it[linkType] = banner.linkType
                    it[linkUrl] = banner.linkUrl
                    it[sortOrder] = banner.sortOrder
                    it[isActive] = banner.isActive
                    it[scheduledStart] = banner.scheduledStart?.let { ts ->
                        OffsetDateTime.ofInstant(ts.toJavaInstant(), ZoneOffset.UTC)
                    }
                    it[scheduledEnd] = banner.scheduledEnd?.let { ts ->
                        OffsetDateTime.ofInstant(ts.toJavaInstant(), ZoneOffset.UTC)
                    }
                    it[updatedBy] = banner.updatedBy
                    it[updatedAt] = now
                }
            } else {
                BannersTable.insert {
                    it[id] = banner.id
                    it[imageUrl] = banner.imageUrl
                    it[linkType] = banner.linkType
                    it[linkUrl] = banner.linkUrl
                    it[sortOrder] = banner.sortOrder
                    it[isActive] = banner.isActive
                    it[scheduledStart] = banner.scheduledStart?.let { ts ->
                        OffsetDateTime.ofInstant(ts.toJavaInstant(), ZoneOffset.UTC)
                    }
                    it[scheduledEnd] = banner.scheduledEnd?.let { ts ->
                        OffsetDateTime.ofInstant(ts.toJavaInstant(), ZoneOffset.UTC)
                    }
                    it[createdBy] = banner.createdBy
                    it[updatedBy] = banner.updatedBy
                    it[createdAt] = now
                    it[updatedAt] = now
                }
            }
            banner
        }

    override suspend fun deactivate(id: UUID, updatedBy: UUID): Banner? =
        newSuspendedTransaction {
            val now = OffsetDateTime.now(ZoneOffset.UTC)
            val count = BannersTable.update({ BannersTable.id eq id }) {
                it[isActive] = false
                it[BannersTable.updatedBy] = updatedBy
                it[updatedAt] = now
            }
            if (count > 0) {
                BannersTable.selectAll().where { BannersTable.id eq id }.single().toBanner()
            } else {
                null
            }
        }

    private fun ResultRow.toBanner(): Banner =
        Banner(
            id = this[BannersTable.id],
            imageUrl = this[BannersTable.imageUrl],
            linkType = this[BannersTable.linkType],
            linkUrl = this[BannersTable.linkUrl],
            sortOrder = this[BannersTable.sortOrder],
            isActive = this[BannersTable.isActive],
            scheduledStart = this[BannersTable.scheduledStart]?.toInstant()?.toKotlinInstant(),
            scheduledEnd = this[BannersTable.scheduledEnd]?.toInstant()?.toKotlinInstant(),
            createdBy = this[BannersTable.createdBy],
            updatedBy = this[BannersTable.updatedBy],
            createdAt = this[BannersTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[BannersTable.updatedAt].toInstant().toKotlinInstant(),
        )
}
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/ken/Project/PrizeDraw/PrizeDraw && ./gradlew build -x test`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add server/src/main/kotlin/com/prizedraw/application/ports/output/IBannerRepository.kt \
  server/src/main/kotlin/com/prizedraw/infrastructure/persistence/tables/BannersTable.kt \
  server/src/main/kotlin/com/prizedraw/infrastructure/persistence/repositories/BannerRepositoryImpl.kt
git commit -m "feat(infra): add Banner repository port and Exposed implementation"
```

---

## Task 5: Use Case Ports + Implementations

**Files:**
- Create: `server/src/main/kotlin/com/prizedraw/application/ports/input/admin/BannerUseCasePorts.kt`
- Create: `server/src/main/kotlin/com/prizedraw/application/usecases/admin/CreateBannerUseCase.kt`
- Create: `server/src/main/kotlin/com/prizedraw/application/usecases/admin/UpdateBannerUseCase.kt`
- Create: `server/src/main/kotlin/com/prizedraw/application/usecases/admin/DeactivateBannerUseCase.kt`

- [ ] **Step 1: Create BannerUseCasePorts.kt**

```kotlin
package com.prizedraw.application.ports.input.admin

import com.prizedraw.domain.entities.Banner
import com.prizedraw.domain.valueobjects.StaffId
import kotlinx.datetime.Instant
import java.util.UUID

public data class CreateBannerCommand(
    val actorStaffId: StaffId,
    val imageUrl: String,
    val linkType: String?,
    val linkUrl: String?,
    val sortOrder: Int,
    val scheduledStart: Instant?,
    val scheduledEnd: Instant?,
)

public interface ICreateBannerUseCase {
    public suspend fun execute(command: CreateBannerCommand): Banner
}

public interface IUpdateBannerUseCase {
    public suspend fun execute(
        actorStaffId: StaffId,
        id: UUID,
        imageUrl: String?,
        linkType: String?,
        linkUrl: String?,
        sortOrder: Int?,
        isActive: Boolean?,
        scheduledStart: Instant?,
        scheduledEnd: Instant?,
    ): Banner
}

public interface IDeactivateBannerUseCase {
    public suspend fun execute(actorStaffId: StaffId, id: UUID): Banner
}

public class BannerNotFoundException(id: UUID) : NoSuchElementException("Banner '$id' not found")
```

- [ ] **Step 2: Create CreateBannerUseCase.kt**

```kotlin
package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.input.admin.CreateBannerCommand
import com.prizedraw.application.ports.input.admin.ICreateBannerUseCase
import com.prizedraw.application.ports.output.IBannerRepository
import com.prizedraw.domain.entities.Banner
import kotlinx.datetime.Clock
import java.util.UUID

public class CreateBannerUseCase(
    private val bannerRepository: IBannerRepository,
) : ICreateBannerUseCase {
    override suspend fun execute(command: CreateBannerCommand): Banner {
        require(command.imageUrl.isNotBlank()) { "Image URL must not be blank" }

        val now = Clock.System.now()
        val banner = Banner(
            id = UUID.randomUUID(),
            imageUrl = command.imageUrl.trim(),
            linkType = command.linkType?.trim(),
            linkUrl = command.linkUrl?.trim(),
            sortOrder = command.sortOrder,
            isActive = true,
            scheduledStart = command.scheduledStart,
            scheduledEnd = command.scheduledEnd,
            createdBy = command.actorStaffId.value,
            updatedBy = null,
            createdAt = now,
            updatedAt = now,
        )
        return bannerRepository.save(banner)
    }
}
```

- [ ] **Step 3: Create UpdateBannerUseCase.kt**

```kotlin
package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.input.admin.BannerNotFoundException
import com.prizedraw.application.ports.input.admin.IUpdateBannerUseCase
import com.prizedraw.application.ports.output.IBannerRepository
import com.prizedraw.domain.entities.Banner
import com.prizedraw.domain.valueobjects.StaffId
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import java.util.UUID

public class UpdateBannerUseCase(
    private val bannerRepository: IBannerRepository,
) : IUpdateBannerUseCase {
    override suspend fun execute(
        actorStaffId: StaffId,
        id: UUID,
        imageUrl: String?,
        linkType: String?,
        linkUrl: String?,
        sortOrder: Int?,
        isActive: Boolean?,
        scheduledStart: Instant?,
        scheduledEnd: Instant?,
    ): Banner {
        val existing = bannerRepository.findById(id)
            ?: throw BannerNotFoundException(id)

        val updated = existing.copy(
            imageUrl = imageUrl?.trim() ?: existing.imageUrl,
            linkType = linkType ?: existing.linkType,
            linkUrl = linkUrl ?: existing.linkUrl,
            sortOrder = sortOrder ?: existing.sortOrder,
            isActive = isActive ?: existing.isActive,
            scheduledStart = scheduledStart ?: existing.scheduledStart,
            scheduledEnd = scheduledEnd ?: existing.scheduledEnd,
            updatedBy = actorStaffId.value,
            updatedAt = Clock.System.now(),
        )
        return bannerRepository.save(updated)
    }
}
```

- [ ] **Step 4: Create DeactivateBannerUseCase.kt**

```kotlin
package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.input.admin.BannerNotFoundException
import com.prizedraw.application.ports.input.admin.IDeactivateBannerUseCase
import com.prizedraw.application.ports.output.IBannerRepository
import com.prizedraw.domain.entities.Banner
import com.prizedraw.domain.valueobjects.StaffId
import java.util.UUID

public class DeactivateBannerUseCase(
    private val bannerRepository: IBannerRepository,
) : IDeactivateBannerUseCase {
    override suspend fun execute(actorStaffId: StaffId, id: UUID): Banner =
        bannerRepository.deactivate(id, actorStaffId.value)
            ?: throw BannerNotFoundException(id)
}
```

- [ ] **Step 5: Verify build**

Run: `cd /Users/ken/Project/PrizeDraw/PrizeDraw && ./gradlew build -x test`
Expected: BUILD SUCCESSFUL

- [ ] **Step 6: Commit**

```bash
git add server/src/main/kotlin/com/prizedraw/application/ports/input/admin/BannerUseCasePorts.kt \
  server/src/main/kotlin/com/prizedraw/application/usecases/admin/CreateBannerUseCase.kt \
  server/src/main/kotlin/com/prizedraw/application/usecases/admin/UpdateBannerUseCase.kt \
  server/src/main/kotlin/com/prizedraw/application/usecases/admin/DeactivateBannerUseCase.kt
git commit -m "feat(app): add banner CRUD use cases"
```

---

## Task 6: DI Registration

**Files:**
- Modify: `server/src/main/kotlin/com/prizedraw/infrastructure/di/RepositoryModule.kt`
- Modify: `server/src/main/kotlin/com/prizedraw/infrastructure/di/UseCaseModule.kt`

- [ ] **Step 1: Add repository binding in RepositoryModule.kt**

After the follow repository binding (currently last entry), add:

```kotlin
// Banner carousel
single<IBannerRepository> { BannerRepositoryImpl() }
```

Add imports:
```kotlin
import com.prizedraw.application.ports.output.IBannerRepository
import com.prizedraw.infrastructure.persistence.repositories.BannerRepositoryImpl
```

- [ ] **Step 2: Add use case bindings in UseCaseModule.kt**

After the announcement use case bindings (~line 610), add:

```kotlin
// --- Banner Carousel ---
single<ICreateBannerUseCase> {
    CreateBannerUseCase(bannerRepository = get<IBannerRepository>())
}

single<IUpdateBannerUseCase> {
    UpdateBannerUseCase(bannerRepository = get<IBannerRepository>())
}

single<IDeactivateBannerUseCase> {
    DeactivateBannerUseCase(bannerRepository = get<IBannerRepository>())
}
```

Add imports:
```kotlin
import com.prizedraw.application.ports.input.admin.ICreateBannerUseCase
import com.prizedraw.application.ports.input.admin.IUpdateBannerUseCase
import com.prizedraw.application.ports.input.admin.IDeactivateBannerUseCase
import com.prizedraw.application.ports.output.IBannerRepository
import com.prizedraw.application.usecases.admin.CreateBannerUseCase
import com.prizedraw.application.usecases.admin.UpdateBannerUseCase
import com.prizedraw.application.usecases.admin.DeactivateBannerUseCase
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/ken/Project/PrizeDraw/PrizeDraw && ./gradlew build -x test`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit**

```bash
git add server/src/main/kotlin/com/prizedraw/infrastructure/di/RepositoryModule.kt \
  server/src/main/kotlin/com/prizedraw/infrastructure/di/UseCaseModule.kt
git commit -m "feat(di): register banner repository and use cases in Koin"
```

---

## Task 7: Server Routes — Storage Upload + Admin Banner + Public Banner

**Files:**
- Create: `server/src/main/kotlin/com/prizedraw/api/routes/StorageUploadRoute.kt`
- Create: `server/src/main/kotlin/com/prizedraw/api/routes/AdminBannerRoutes.kt`
- Create: `server/src/main/kotlin/com/prizedraw/api/routes/BannerRoutes.kt`

- [ ] **Step 1: Create StorageUploadRoute.kt**

This is the shared upload endpoint that `ImageUpload.tsx` already targets. It receives multipart form data, uploads to S3, returns `{ url }`.

```kotlin
package com.prizedraw.api.routes

import com.prizedraw.api.plugins.requireStaffWithRole
import com.prizedraw.application.ports.output.IStorageService
import com.prizedraw.contracts.dto.storage.UploadResponse
import com.prizedraw.contracts.endpoints.StorageEndpoints
import com.prizedraw.contracts.enums.StaffRole
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.PartData
import io.ktor.http.content.forEachPart
import io.ktor.server.application.call
import io.ktor.server.request.receiveMultipart
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.post
import java.util.UUID

private val ALLOWED_CONTENT_TYPES = setOf("image/jpeg", "image/png", "image/webp")
private const val MAX_FILE_SIZE = 5L * 1024 * 1024 // 5 MB

public fun Route.storageUploadRoute() {
    val storageService: IStorageService by inject()

    post(StorageEndpoints.UPLOAD) {
        call.requireStaffWithRole(StaffRole.OPERATOR) ?: return@post

        val multipart = call.receiveMultipart()
        var uploadedUrl: String? = null

        multipart.forEachPart { part ->
            if (part is PartData.FileItem && part.name == "file") {
                val contentType = part.contentType?.toString() ?: ""
                if (contentType !in ALLOWED_CONTENT_TYPES) {
                    part.dispose()
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Unsupported file type: $contentType"))
                    return@post
                }

                val bytes = part.provider().readRemaining().readByteArray()
                if (bytes.size > MAX_FILE_SIZE) {
                    part.dispose()
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "File too large (max 5MB)"))
                    return@post
                }

                val extension = when (contentType) {
                    "image/jpeg" -> "jpg"
                    "image/png" -> "png"
                    "image/webp" -> "webp"
                    else -> "bin"
                }
                val key = "uploads/${UUID.randomUUID()}.$extension"
                uploadedUrl = storageService.upload(key, bytes, contentType)
            }
            part.dispose()
        }

        if (uploadedUrl != null) {
            call.respond(HttpStatusCode.OK, UploadResponse(url = uploadedUrl!!))
        } else {
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to "No file provided"))
        }
    }
}
```

- [ ] **Step 2: Create AdminBannerRoutes.kt**

Follow the `AdminAnnouncementRoutes.kt` pattern exactly.

```kotlin
package com.prizedraw.api.routes

import com.prizedraw.api.plugins.requireStaffWithRole
import com.prizedraw.application.ports.input.admin.BannerNotFoundException
import com.prizedraw.application.ports.input.admin.CreateBannerCommand
import com.prizedraw.application.ports.input.admin.ICreateBannerUseCase
import com.prizedraw.application.ports.input.admin.IDeactivateBannerUseCase
import com.prizedraw.application.ports.input.admin.IUpdateBannerUseCase
import com.prizedraw.application.ports.output.IBannerRepository
import com.prizedraw.contracts.dto.banner.BannerDto
import com.prizedraw.contracts.dto.banner.CreateBannerRequest
import com.prizedraw.contracts.dto.banner.UpdateBannerRequest
import com.prizedraw.contracts.endpoints.BannerEndpoints
import com.prizedraw.contracts.enums.StaffRole
import com.prizedraw.domain.entities.Banner
import com.prizedraw.infrastructure.external.redis.CacheService
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import java.util.UUID

private const val BANNERS_CACHE_KEY = "banners:active"

public fun Route.adminBannerRoutes() {
    listAllBannersRoute()
    createBannerRoute()
    updateBannerRoute()
    deactivateBannerRoute()
}

private fun Route.listAllBannersRoute() {
    val bannerRepository: IBannerRepository by inject()
    get(BannerEndpoints.ADMIN_BANNERS) {
        call.requireStaffWithRole(StaffRole.OPERATOR) ?: return@get
        val banners = bannerRepository.findAll()
        call.respond(HttpStatusCode.OK, banners.map { it.toDto() })
    }
}

private fun Route.createBannerRoute() {
    val createBanner: ICreateBannerUseCase by inject()
    val cacheService: CacheService by inject()
    post(BannerEndpoints.ADMIN_BANNERS) {
        val actor = call.requireStaffWithRole(StaffRole.OPERATOR) ?: return@post
        val request = call.receive<CreateBannerRequest>()
        runCatching {
            createBanner.execute(
                CreateBannerCommand(
                    actorStaffId = actor.staffId,
                    imageUrl = request.imageUrl,
                    linkType = request.linkType,
                    linkUrl = request.linkUrl,
                    sortOrder = request.sortOrder,
                    scheduledStart = request.scheduledStart,
                    scheduledEnd = request.scheduledEnd,
                ),
            )
        }.fold(
            onSuccess = {
                cacheService.invalidate(BANNERS_CACHE_KEY)
                call.respond(HttpStatusCode.Created, it.toDto())
            },
            onFailure = { e ->
                call.respond(
                    HttpStatusCode.BadRequest,
                    mapOf("error" to (e.message ?: "Failed to create banner")),
                )
            },
        )
    }
}

private fun Route.updateBannerRoute() {
    val updateBanner: IUpdateBannerUseCase by inject()
    val cacheService: CacheService by inject()
    patch(BannerEndpoints.ADMIN_BANNER_BY_ID) {
        val actor = call.requireStaffWithRole(StaffRole.OPERATOR) ?: return@patch
        val id = call.parameters["id"]
            ?.let { runCatching { UUID.fromString(it) }.getOrNull() }
            ?: return@patch call.respond(
                HttpStatusCode.BadRequest,
                mapOf("error" to "Invalid banner ID"),
            )

        val request = call.receive<UpdateBannerRequest>()
        runCatching {
            updateBanner.execute(
                actorStaffId = actor.staffId,
                id = id,
                imageUrl = request.imageUrl,
                linkType = request.linkType,
                linkUrl = request.linkUrl,
                sortOrder = request.sortOrder,
                isActive = request.isActive,
                scheduledStart = request.scheduledStart,
                scheduledEnd = request.scheduledEnd,
            )
        }.fold(
            onSuccess = {
                cacheService.invalidate(BANNERS_CACHE_KEY)
                call.respond(HttpStatusCode.OK, it.toDto())
            },
            onFailure = { e ->
                when (e) {
                    is BannerNotFoundException ->
                        call.respond(HttpStatusCode.NotFound, mapOf("error" to "Banner not found"))
                    else ->
                        call.respond(
                            HttpStatusCode.BadRequest,
                            mapOf("error" to (e.message ?: "Failed to update banner")),
                        )
                }
            },
        )
    }
}

private fun Route.deactivateBannerRoute() {
    val deactivateBanner: IDeactivateBannerUseCase by inject()
    val cacheService: CacheService by inject()
    delete(BannerEndpoints.ADMIN_BANNER_BY_ID) {
        val actor = call.requireStaffWithRole(StaffRole.OPERATOR) ?: return@delete
        val id = call.parameters["id"]
            ?.let { runCatching { UUID.fromString(it) }.getOrNull() }
            ?: return@delete call.respond(
                HttpStatusCode.BadRequest,
                mapOf("error" to "Invalid banner ID"),
            )

        runCatching {
            deactivateBanner.execute(actorStaffId = actor.staffId, id = id)
        }.fold(
            onSuccess = {
                cacheService.invalidate(BANNERS_CACHE_KEY)
                call.respond(HttpStatusCode.NoContent)
            },
            onFailure = { e ->
                when (e) {
                    is BannerNotFoundException ->
                        call.respond(HttpStatusCode.NotFound, mapOf("error" to "Banner not found"))
                    else ->
                        call.respond(
                            HttpStatusCode.InternalServerError,
                            mapOf("error" to (e.message ?: "Failed to deactivate banner")),
                        )
                }
            },
        )
    }
}

private fun Banner.toDto(): BannerDto =
    BannerDto(
        id = id.toString(),
        imageUrl = imageUrl,
        linkType = linkType,
        linkUrl = linkUrl,
        sortOrder = sortOrder,
        isActive = isActive,
        scheduledStart = scheduledStart,
        scheduledEnd = scheduledEnd,
    )
```

- [ ] **Step 3: Create BannerRoutes.kt (public endpoint with caching)**

```kotlin
package com.prizedraw.api.routes

import com.prizedraw.application.ports.output.IBannerRepository
import com.prizedraw.contracts.dto.banner.BannerDto
import com.prizedraw.contracts.endpoints.BannerEndpoints
import com.prizedraw.domain.entities.Banner
import com.prizedraw.infrastructure.external.redis.CacheService
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

private const val CACHE_KEY = "banners:active"
private const val CACHE_TTL_SECONDS = 60L

public fun Route.bannerRoutes() {
    val bannerRepository: IBannerRepository by inject()
    val cacheService: CacheService by inject()
    val json = Json { ignoreUnknownKeys = true }

    get(BannerEndpoints.BANNERS) {
        val cached = cacheService.get(CACHE_KEY)
        val banners: List<BannerDto> = if (cached != null) {
            json.decodeFromString(cached)
        } else {
            val active = bannerRepository.findAllActive().map { it.toPublicDto() }
            cacheService.set(CACHE_KEY, json.encodeToString(active), CACHE_TTL_SECONDS)
            active
        }
        call.response.header("Cache-Control", "public, max-age=60")
        call.respond(HttpStatusCode.OK, banners)
    }
}

private fun Banner.toPublicDto(): BannerDto =
    BannerDto(
        id = id.toString(),
        imageUrl = imageUrl,
        linkType = linkType,
        linkUrl = linkUrl,
        sortOrder = sortOrder,
        isActive = true,
        scheduledStart = scheduledStart,
        scheduledEnd = scheduledEnd,
    )
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/ken/Project/PrizeDraw/PrizeDraw && ./gradlew build -x test`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add server/src/main/kotlin/com/prizedraw/api/routes/StorageUploadRoute.kt \
  server/src/main/kotlin/com/prizedraw/api/routes/AdminBannerRoutes.kt \
  server/src/main/kotlin/com/prizedraw/api/routes/BannerRoutes.kt
git commit -m "feat(api): add storage upload, admin banner CRUD, and public banner routes"
```

---

## Task 8: Mount Routes in Routing.kt

**Files:**
- Modify: `server/src/main/kotlin/com/prizedraw/api/plugins/Routing.kt`

- [ ] **Step 1: Add public banner route**

In `Routing.kt`, after the status routes (around line 147), add:

```kotlin
// Banner carousel — public, no auth required
bannerRoutes()
```

- [ ] **Step 2: Add admin routes inside `authenticate("staff")` block**

After `adminAnnouncementRoutes()` (around line 203), add:

```kotlin
// Banner carousel admin management
adminBannerRoutes()

// Shared storage upload (staff-authenticated)
storageUploadRoute()
```

- [ ] **Step 3: Add imports**

```kotlin
import com.prizedraw.api.routes.bannerRoutes
import com.prizedraw.api.routes.adminBannerRoutes
import com.prizedraw.api.routes.storageUploadRoute
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/ken/Project/PrizeDraw/PrizeDraw && ./gradlew build -x test`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add server/src/main/kotlin/com/prizedraw/api/plugins/Routing.kt
git commit -m "feat(routing): mount banner and storage upload routes"
```

---

## Task 9: Admin Frontend — Sidebar + Banner Management Page

**Files:**
- Modify: `admin/src/lib/roles.ts`
- Create: `admin/src/app/(admin)/banners/page.tsx`

- [ ] **Step 1: Add banner nav item to NAV_ITEMS in roles.ts**

Add after the leaderboard entry (before payments):

```typescript
{ href: '/banners', icon: '🖼', label: '輪播橫幅', minRole: 'OPERATOR' },
```

- [ ] **Step 2: Create banners/page.tsx**

**IMPORTANT:** Read `node_modules/next/dist/docs/` first for any Next.js API changes (per AGENTS.md).

Create `/Users/ken/Project/PrizeDraw/PrizeDraw/admin/src/app/(admin)/banners/page.tsx` — follow the announcements page pattern (single-file, `"use client"`, apiClient for data fetching). Key elements:

- Banner interface: `{ id, imageUrl, linkType, linkUrl, sortOrder, isActive, scheduledStart, scheduledEnd }`
- Create form with: `ImageUpload` component for image, sort order number input, scheduled start/end datetime pickers
- List view: thumbnail image, sort order badge, active/inactive status, schedule info, deactivate button
- Use existing `ImageUpload` component from `@/components/ImageUpload`
- Use existing `LoadingSkeleton` from `@/components/LoadingSkeleton`
- API calls via `apiClient.get/post/patch/delete`

```tsx
"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/services/apiClient";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ImageUpload } from "@/components/ImageUpload";

interface Banner {
  id: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  scheduledStart: string | null;
  scheduledEnd: string | null;
}

interface CreateForm {
  imageUrl: string;
  sortOrder: number;
  scheduledStart: string;
  scheduledEnd: string;
}

const EMPTY_FORM: CreateForm = {
  imageUrl: "",
  sortOrder: 0,
  scheduledStart: "",
  scheduledEnd: "",
};

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadBanners = () => {
    setIsLoading(true);
    apiClient
      .get<Banner[]>("/api/v1/admin/banners")
      .then((data) => {
        setBanners(data);
        setError(null);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "載入失敗");
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadBanners();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.imageUrl) {
      alert("請先上傳圖片");
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post("/api/v1/admin/banners", {
        imageUrl: form.imageUrl,
        sortOrder: form.sortOrder,
        scheduledStart: form.scheduledStart || null,
        scheduledEnd: form.scheduledEnd || null,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      loadBanners();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "建立失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!window.confirm("確定要停用此橫幅？")) return;
    setDeletingId(id);
    try {
      await apiClient.delete(`/api/v1/admin/banners/${id}`);
      loadBanners();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "停用失敗");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">輪播橫幅管理</h1>
          <p className="text-sm text-slate-500">管理首頁推廣輪播圖片，支援排程上下架</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          {showForm ? "取消" : "+ 新增橫幅"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">新增橫幅</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <ImageUpload
              label="橫幅圖片"
              onUpload={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
              currentUrl={form.imageUrl || undefined}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">排序（數字小的排前面）</label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">開始時間（選填）</label>
                <input
                  type="datetime-local"
                  value={form.scheduledStart}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledStart: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">結束時間（選填）</label>
                <input
                  type="datetime-local"
                  value={form.scheduledEnd}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledEnd: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !form.imageUrl}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {isSubmitting ? "送出中…" : "建立橫幅"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Banner list */}
      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <LoadingSkeleton rows={4} columns={3} />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : banners.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-400">
          尚無橫幅
        </div>
      ) : (
        <div className="space-y-2">
          {banners.map((b) => {
            const isDeleting = deletingId === b.id;
            return (
              <div
                key={b.id}
                className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.imageUrl}
                  alt="橫幅"
                  className="h-16 w-28 shrink-0 rounded-md border border-slate-100 object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      排序: {b.sortOrder}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        b.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {b.isActive ? "啟用中" : "已停用"}
                    </span>
                  </div>
                  {(b.scheduledStart || b.scheduledEnd) && (
                    <p className="mt-1 text-xs text-slate-400">
                      {b.scheduledStart && `開始: ${new Date(b.scheduledStart).toLocaleString("zh-TW")}`}
                      {b.scheduledStart && b.scheduledEnd && " — "}
                      {b.scheduledEnd && `結束: ${new Date(b.scheduledEnd).toLocaleString("zh-TW")}`}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => handleDeactivate(b.id)}
                  disabled={isDeleting || !b.isActive}
                  className="shrink-0 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  {isDeleting ? "停用中…" : "停用"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify admin build**

Run: `cd /Users/ken/Project/PrizeDraw/PrizeDraw/admin && pnpm lint`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add admin/src/lib/roles.ts admin/src/app/\(admin\)/banners/page.tsx
git commit -m "feat(admin): add banner carousel management page and sidebar nav"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Full server build**

Run: `cd /Users/ken/Project/PrizeDraw/PrizeDraw && ./gradlew build -x test`
Expected: BUILD SUCCESSFUL

- [ ] **Step 2: Admin lint**

Run: `cd /Users/ken/Project/PrizeDraw/PrizeDraw/admin && pnpm lint`
Expected: No errors

- [ ] **Step 3: Review all changes**

Run: `cd /Users/ken/Project/PrizeDraw/PrizeDraw && git log --oneline -10`
Verify all commits are present and correctly ordered.
