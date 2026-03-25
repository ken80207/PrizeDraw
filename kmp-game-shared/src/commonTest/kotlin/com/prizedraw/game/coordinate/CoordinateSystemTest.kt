package com.prizedraw.game.coordinate

import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class CoordinateSystemTest {
    private val tileWidth = 64
    private val tileHeight = 32

    // -----------------------------------------------------------------------
    // Round-trip: isoToScreen → screenToIso
    // -----------------------------------------------------------------------

    @Test
    fun isoToScreenAndBackIsIdentity_origin() {
        val original = IsometricPoint(0f, 0f)
        val screen = CoordinateSystem.isoToScreen(original, tileWidth, tileHeight)
        val recovered = CoordinateSystem.screenToIso(screen, tileWidth, tileHeight)
        assertNearlyEqual(original.isoX, recovered.isoX)
        assertNearlyEqual(original.isoY, recovered.isoY)
    }

    @Test
    fun isoToScreenAndBackIsIdentity_integerCoord() {
        val original = IsometricPoint(3f, 5f)
        val screen = CoordinateSystem.isoToScreen(original, tileWidth, tileHeight)
        val recovered = CoordinateSystem.screenToIso(screen, tileWidth, tileHeight)
        assertNearlyEqual(original.isoX, recovered.isoX)
        assertNearlyEqual(original.isoY, recovered.isoY)
    }

    @Test
    fun isoToScreenAndBackIsIdentity_fractionalCoord() {
        val original = IsometricPoint(2.5f, 7.25f)
        val screen = CoordinateSystem.isoToScreen(original, tileWidth, tileHeight)
        val recovered = CoordinateSystem.screenToIso(screen, tileWidth, tileHeight)
        assertNearlyEqual(original.isoX, recovered.isoX)
        assertNearlyEqual(original.isoY, recovered.isoY)
    }

    @Test
    fun screenToIsoAndBackIsIdentity() {
        val original = ScreenPoint(128f, 96f)
        val iso = CoordinateSystem.screenToIso(original, tileWidth, tileHeight)
        val recovered = CoordinateSystem.isoToScreen(iso, tileWidth, tileHeight)
        assertNearlyEqual(original.x, recovered.x)
        assertNearlyEqual(original.y, recovered.y)
    }

    // -----------------------------------------------------------------------
    // Known-value conversions
    // -----------------------------------------------------------------------

    @Test
    fun tileToIsoMapsOriginToOrigin() {
        val iso = CoordinateSystem.tileToIso(0, 0)
        assertNearlyEqual(0f, iso.isoX)
        assertNearlyEqual(0f, iso.isoY)
    }

    @Test
    fun tileToIso_col3row2() {
        val iso = CoordinateSystem.tileToIso(3, 2)
        assertNearlyEqual(3f, iso.isoX)
        assertNearlyEqual(2f, iso.isoY)
    }

    @Test
    fun isoToScreen_knownValues() {
        // Tile (1, 0): should be half a tile-width to the right of origin
        val screen = CoordinateSystem.isoToScreen(IsometricPoint(1f, 0f), tileWidth, tileHeight)
        assertNearlyEqual((tileWidth / 2f), screen.x)
        assertNearlyEqual((tileHeight / 2f), screen.y)
    }

    @Test
    fun isoToScreen_symmetricAboutYAxis() {
        // iso(a, 0) and iso(-a, 0) mirror symmetrically:
        //   screenX(a, 0)  = a * (tileWidth/2)    → positive
        //   screenX(-a, 0) = -a * (tileWidth/2)   → negative (mirror)
        //   screenY(a, 0)  = a * (tileHeight/2)   → positive
        //   screenY(-a, 0) = -a * (tileHeight/2)  → negative (mirror)
        val pos = CoordinateSystem.isoToScreen(IsometricPoint(3f, 0f), tileWidth, tileHeight)
        val neg = CoordinateSystem.isoToScreen(IsometricPoint(-3f, 0f), tileWidth, tileHeight)
        assertNearlyEqual(-pos.x, neg.x) // x-axis mirrors
        assertNearlyEqual(-pos.y, neg.y) // y-axis also mirrors (both axes flip together)
    }

    // -----------------------------------------------------------------------
    // isoToTile
    // -----------------------------------------------------------------------

    @Test
    fun isoToTile_integerPoints() {
        val (col, row) = CoordinateSystem.isoToTile(IsometricPoint(4f, 6f))
        assertEquals(4, col)
        assertEquals(6, row)
    }

    // -----------------------------------------------------------------------
    // Distance
    // -----------------------------------------------------------------------

    @Test
    fun distance_samePoint_isZero() {
        val p = IsometricPoint(3f, 4f)
        assertNearlyEqual(0f, CoordinateSystem.distance(p, p))
    }

    @Test
    fun distance_knownResult() {
        val a = IsometricPoint(0f, 0f)
        val b = IsometricPoint(3f, 4f)
        assertNearlyEqual(5f, CoordinateSystem.distance(a, b))
    }

    @Test
    fun distance_isSymmetric() {
        val a = IsometricPoint(1f, 2f)
        val b = IsometricPoint(5f, 9f)
        assertNearlyEqual(CoordinateSystem.distance(a, b), CoordinateSystem.distance(b, a))
    }

    // -----------------------------------------------------------------------
    // Helper
    // -----------------------------------------------------------------------

    private fun assertNearlyEqual(
        expected: Float,
        actual: Float,
        epsilon: Float = 0.001f,
    ) {
        assertTrue(
            abs(expected - actual) < epsilon,
            "Expected $expected but was $actual (delta > $epsilon)",
        )
    }
}
