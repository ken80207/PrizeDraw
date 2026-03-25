package com.prizedraw.domain.models

/**
 * Describes the app update requirement derived from the server status response.
 *
 * Populated by comparing the running [currentVersion] against [minRequiredVersion]
 * returned in the `/api/v1/status` `minAppVersion` field for the current platform.
 *
 * @property currentVersion The version string of the currently installed app (e.g. `"1.2.3"`).
 * @property minRequiredVersion The server-mandated minimum version, or null when no floor is set.
 * @property isUpdateRequired True when [currentVersion] is semantically below [minRequiredVersion].
 * @property updateUrl Deep-link to the platform store listing (Play Store for Android, App Store
 *   for iOS). Null when the platform URL is not yet configured.
 */
public data class AppUpdateInfo(
    val currentVersion: String,
    val minRequiredVersion: String?,
    val isUpdateRequired: Boolean,
    val updateUrl: String?,
) {
    public companion object {
        /**
         * Constructs an [AppUpdateInfo] by comparing version strings.
         *
         * Version strings are split by `.` and each component compared numerically.
         * Non-numeric components fall back to lexicographic comparison so pre-release
         * suffixes (e.g. `1.0.0-rc1`) are handled gracefully.
         *
         * @param currentVersion The running app's version string.
         * @param minRequiredVersion The server-mandated floor, or null for no requirement.
         * @param updateUrl Platform store URL for the update button.
         * @return A fully resolved [AppUpdateInfo].
         */
        public fun create(
            currentVersion: String,
            minRequiredVersion: String?,
            updateUrl: String?,
        ): AppUpdateInfo {
            val isRequired =
                if (minRequiredVersion == null) {
                    false
                } else {
                    isVersionBelow(currentVersion, minRequiredVersion)
                }
            return AppUpdateInfo(
                currentVersion = currentVersion,
                minRequiredVersion = minRequiredVersion,
                isUpdateRequired = isRequired,
                updateUrl = updateUrl,
            )
        }

        private fun isVersionBelow(
            current: String,
            minimum: String,
        ): Boolean {
            val currentParts = current.split(".").map { it.toIntOrNull() ?: 0 }
            val minimumParts = minimum.split(".").map { it.toIntOrNull() ?: 0 }
            val maxLength = maxOf(currentParts.size, minimumParts.size)
            for (i in 0 until maxLength) {
                val c = currentParts.getOrElse(i) { 0 }
                val m = minimumParts.getOrElse(i) { 0 }
                if (c < m) return true
                if (c > m) return false
            }
            return false
        }
    }
}
