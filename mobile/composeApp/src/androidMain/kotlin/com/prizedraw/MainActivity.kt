package com.prizedraw

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.prizedraw.navigation.PrizeDrawNavGraph

/**
 * Single-activity entry point for the PrizeDraw Android application.
 *
 * Hosts the Compose Multiplatform [PrizeDrawNavGraph] root navigation graph.
 * Edge-to-edge display is enabled so the Compose content manages insets.
 */
public class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            PrizeDrawNavGraph()
        }
    }
}
