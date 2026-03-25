@file:OptIn(ExperimentalJsExport::class)

package com.prizedraw.shared

// @JsExport wrappers for web consumption will be added in Phase 2
// This file bridges the KMP shared business logic to the JavaScript/TypeScript world.

@JsExport
public object PrizeDrawShared {
    public val version: String = "0.1.0"
}
