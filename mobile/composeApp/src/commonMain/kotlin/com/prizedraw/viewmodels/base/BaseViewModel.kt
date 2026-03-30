package com.prizedraw.viewmodels.base

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Base class for MVI ViewModels.
 *
 * Holds a [StateFlow] of the current [State] and exposes an [onIntent] handler
 * that subclasses implement to process [Intent] values and emit new states.
 *
 * Provides [viewModelScope] — a [MainScope]-backed [CoroutineScope] that subclasses
 * use for async work. Call [clear] when the ViewModel is no longer needed to cancel
 * all in-flight coroutines.
 *
 * TODO(T094): replace [MainScope] with a platform-injected scope once Koin DI lands.
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

    /**
     * Coroutine scope tied to this ViewModel's lifecycle.
     *
     * Backed by [MainScope] (Dispatchers.Main + SupervisorJob) so individual child
     * coroutine failures do not cancel sibling coroutines.
     */
    protected val viewModelScope: CoroutineScope = MainScope()

    /** Emit a new state value. Call from [onIntent] implementations. */
    protected fun setState(newState: S) {
        _state.value = newState
    }

    /**
     * Process an incoming [intent] and produce side effects or state transitions.
     *
     * Implementations should call [setState] to publish new states and may launch
     * coroutines for async work via [viewModelScope].
     *
     * @param intent The user action or event to handle.
     */
    public abstract fun onIntent(intent: I)

    /**
     * Cancels [viewModelScope] and all running coroutines.
     *
     * Call this from the platform lifecycle owner (e.g. `onCleared` on Android) when
     * the ViewModel is about to be discarded.
     */
    public open fun clear() {
        viewModelScope.cancel()
    }
}
