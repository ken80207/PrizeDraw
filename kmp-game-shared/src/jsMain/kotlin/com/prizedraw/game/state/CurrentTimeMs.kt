package com.prizedraw.game.state

internal actual fun currentTimeMs(): Long = js("Date.now()").unsafeCast<Double>().toLong()
