package com.prizedraw

import androidx.compose.ui.window.ComposeUIViewController
import com.prizedraw.navigation.PrizeDrawNavGraph

/**
 * iOS entry point that wraps the shared [PrizeDrawNavGraph] in a [ComposeUIViewController].
 *
 * Called from Swift in `iOSApp.swift`:
 * ```swift
 * MainViewControllerKt.MainViewController()
 * ```
 */
@Suppress("ktlint:standard:function-naming")
public fun MainViewController() =
    ComposeUIViewController {
        PrizeDrawNavGraph()
    }
