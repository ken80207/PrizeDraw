# Banner Carousel Display (Web + Mobile)

## Overview

Wire up the banner carousel display on web player and mobile app, consuming the existing `GET /api/v1/banners` public endpoint.

## Web Player

**Approach:** Replace the existing static hero section in `web/src/app/page.tsx` with a functional banner carousel.

- Fetch banners from `GET /api/v1/banners` via `apiClient`
- Auto-play: 5-second interval between slides
- Manual swipe/click navigation
- Indicator dots: clickable, reflect current slide
- CSS transition for slide animation (no extra library)
- On manual interaction, pause auto-play for 10 seconds then resume
- Fallback: if no banners returned, show original campaign hero

**Component:** `web/src/components/BannerCarousel.tsx`
- Props: `banners: BannerData[]` (fetched by parent page)
- Internal state: `currentIndex`, auto-play timer
- Each slide: full-width image with gradient overlay, matching current hero dimensions (`h-[400px] lg:h-[500px]`)

**Data flow:** `page.tsx` fetches banners alongside campaigns in `useEffect` → passes to `BannerCarousel` → carousel handles slides/timers internally.

## Mobile App

**Approach:** Add banner carousel at the top of `CampaignListScreen`.

- Fetch banners from `GET /api/v1/banners` using Ktor client
- Compose `HorizontalPager` for swipe support
- Auto-play: 5-second interval via `LaunchedEffect` + `delay`
- Coil `AsyncImage` for image loading
- Row of indicator dots below pager
- On manual swipe, pause auto-play for 10 seconds
- If no banners, don't render the carousel section

**Files:**
- `mobile/composeApp/src/commonMain/kotlin/com/prizedraw/screens/campaign/BannerCarousel.kt` — composable
- Modify `CampaignListScreen.kt` — add carousel at top

## Shared Behavior

| Behavior | Value |
|----------|-------|
| Auto-play interval | 5 seconds |
| Pause after manual interaction | 10 seconds |
| API endpoint | `GET /api/v1/banners` |
| Fallback (no banners) | Web: campaign hero / Mobile: hide |

## Out of Scope

- Click-through / link behavior (v1 display only)
- Swipe gesture animations beyond basic transition
- Preloading next/prev images
