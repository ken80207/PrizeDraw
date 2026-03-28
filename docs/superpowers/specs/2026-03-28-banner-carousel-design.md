# Banner Carousel (Promotional Banners)

## Overview

Add a banner carousel system for displaying promotional images on both mobile app and web player. Banners are image-only, managed via the admin dashboard with scheduling support. Link functionality (internal/external) is reserved in the data model but not active in v1.

## Requirements

- Display rotating promotional banners on mobile app and web player home screens
- Admin can upload images, set display order, and schedule start/end times
- Banners auto-show/hide based on schedule
- v1: display only (no click action); data model reserves link fields for future use
- Requires OPERATOR role or above to manage

## Data Model

```sql
CREATE TABLE banners (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url       TEXT NOT NULL,
    link_type       VARCHAR(20),            -- NULL | 'INTERNAL' | 'EXTERNAL' (reserved)
    link_url        TEXT,                    -- reserved for future use
    sort_order      INT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    scheduled_start TIMESTAMPTZ,
    scheduled_end   TIMESTAMPTZ,
    created_by      UUID NOT NULL REFERENCES staff(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_banners_active_schedule ON banners (is_active, scheduled_start, scheduled_end);
```

**Active banner query logic:** `is_active = true AND (scheduled_start IS NULL OR scheduled_start <= now()) AND (scheduled_end IS NULL OR scheduled_end > now())`, ordered by `sort_order ASC`.

## API Design

### Public Endpoint (no auth required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/banners` | List currently active banners (schedule-filtered) |

Response: `BannerDto[]` — only active, within schedule window, sorted by `sort_order ASC`.

### Admin Endpoints (OPERATOR+)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/admin/banners` | List all banners (including inactive) |
| POST | `/api/v1/admin/banners` | Create banner |
| PATCH | `/api/v1/admin/banners/{id}` | Update banner |
| DELETE | `/api/v1/admin/banners/{id}` | Delete banner |

### DTOs (api-contracts)

```
BannerDto:
  id: String
  imageUrl: String
  linkType: String?        // reserved
  linkUrl: String?         // reserved
  sortOrder: Int
  isActive: Boolean
  scheduledStart: String?  // ISO 8601
  scheduledEnd: String?    // ISO 8601

CreateBannerRequest:
  imageUrl: String
  linkType: String?
  linkUrl: String?
  sortOrder: Int
  scheduledStart: String?
  scheduledEnd: String?

UpdateBannerRequest:
  imageUrl: String?
  linkType: String?
  linkUrl: String?
  sortOrder: Int?
  isActive: Boolean?
  scheduledStart: String?
  scheduledEnd: String?
```

### Image Upload Flow

1. Admin frontend calls `POST /api/v1/admin/banners/upload-url` with content type
2. Server returns presigned S3 PUT URL via `S3StorageService.generateUploadUrl()`
3. Frontend uploads image directly to S3
4. Frontend sends `POST /api/v1/admin/banners` with the resulting `imageUrl`

## Admin Dashboard

- **Sidebar**: Add "輪播橫幅" item to `ADMIN_NAV_ITEMS` in `Sidebar.tsx`, route `/banners`
- **Page style**: Consistent with announcements page — header + create button, card list below
- **List view**: Thumbnail preview, sort order, active/inactive badge, schedule times, edit/delete actions
- **Create form**: Image upload area (drag & drop or click), sort order input, scheduled start/end datetime pickers
- **Permission**: `OPERATOR` role minimum (same as announcements)

## Implementation Scope

| Layer | Files |
|-------|-------|
| DB migration | `V029__create_banners.sql` |
| api-contracts | `BannerEndpoints.kt`, `BannerDtos.kt` |
| Server domain | `Banner.kt` entity |
| Server infrastructure | `BannerRepository.kt` + `BannersTable` (Exposed) |
| Server use cases | `CreateBannerUseCase`, `UpdateBannerUseCase`, `DeleteBannerUseCase`, `ListAllBannersUseCase`, `ListActiveBannersUseCase` |
| Server routes | `AdminBannerRoutes.kt`, `BannerRoutes.kt` (public) |
| Server DI | Register in `UseCaseModule` + `RepositoryModule` |
| Server routing | Mount in `Routing.kt` |
| Admin frontend | `Sidebar.tsx` menu item + `(admin)/banners/page.tsx` |

## Out of Scope (v1)

- Click-through / link behavior (data model ready, UI not wired)
- Analytics / impression tracking
- A/B testing or audience targeting
- Platform-specific banner targeting (mobile vs web)
