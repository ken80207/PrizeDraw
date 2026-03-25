package com.prizedraw.viewmodels.base

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Base class for MVI ViewModels.
 *
 * Holds a [StateFlow] of the current [State] and exposes an [onIntent] handler
 * that subclasses implement to process [Intent] values and emit new states.
 *
 * TODO(T094): integrate with a KMP-compatible coroutine scope (e.g. `viewModelScope`
 *   on Android or a custom `CoroutineScope` with `Dispatchers.Main` on iOS).
 *
 * @param S The state type; must be a sealed class.
 * @param I The intent type; must be a sealed class.
 * @param initialState The state emitted before any intent is processed.
 */
public abstract class BaseViewModel<S : Any, I : Any>(
    initialState: S,
) {
    private val _state = MutableStateFlow(initialState)

    /** Observable current state. */
    public val state: StateFlow<S> = _state.asStateFlow()

    /** Emit a new state value. Call from [onIntent] implementations. */
    protected fun setState(newState: S) {
        _state.value = newState
    }

    /**
     * Process an incoming [intent] and produce side effects or state transitions.
     *
     * Implementations should call [setState] to publish new states and may launch
     * coroutines for async work.
     *
     * @param intent The user action or event to handle.
     */
    public abstract fun onIntent(intent: I)
}
