package com.prizedraw.application.ports.input.admin

import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.domain.valueobjects.StaffId

/**
 * Input port for enabling or disabling individual draw animation modes.
 *
 * Each mode maps to a feature flag keyed `animation_mode_{mode.lowercase()}`,
 * e.g. `animation_mode_tear`. When a mode is disabled, clients must fall back
 * to [DrawAnimationMode.INSTANT].
 */
public interface IManageAnimationModesUseCase {
    /**
     * Sets the enabled state of [mode] for all players.
     *
     * @param staffId The staff member performing the change.
     * @param mode The animation mode to toggle.
     * @param enabled True to enable, false to disable.
     * @return Map of all animation mode keys to their current enabled state.
     */
    public suspend fun setModeEnabled(
        staffId: StaffId,
        mode: DrawAnimationMode,
        enabled: Boolean,
    ): Map<DrawAnimationMode, Boolean>

    /**
     * Returns the current enabled state for every animation mode.
     *
     * @return Map of all animation mode keys to their current enabled state.
     */
    public suspend fun getAllModeStates(): Map<DrawAnimationMode, Boolean>
}
