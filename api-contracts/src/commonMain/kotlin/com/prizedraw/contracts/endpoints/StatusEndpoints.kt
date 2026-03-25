package com.prizedraw.contracts.endpoints

/**
 * Canonical URL constants for the server status and announcement endpoints.
 *
 * [STATUS] is intentionally public and requires no authentication — it is the
 * very first endpoint all clients check on startup.
 */
public object StatusEndpoints {
    /** Public endpoint returning current server status and active announcements. */
    public const val STATUS: String = "/api/v1/status"

    /** Admin endpoints for managing server announcements. */
    public const val ADMIN_ANNOUNCEMENTS: String = "/api/v1/admin/announcements"

    /** Admin endpoint to operate on a single announcement by ID. */
    public const val ADMIN_ANNOUNCEMENT_BY_ID: String = "/api/v1/admin/announcements/{id}"
}
