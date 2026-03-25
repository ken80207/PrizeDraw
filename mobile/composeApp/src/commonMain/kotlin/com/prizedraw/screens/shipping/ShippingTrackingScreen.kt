package com.prizedraw.screens.shipping

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Divider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prizedraw.contracts.dto.shipping.ShippingOrderDto
import com.prizedraw.contracts.enums.ShippingOrderStatus

/**
 * Shipping order tracking screen.
 *
 * Shows a timeline: PENDING_SHIPMENT → SHIPPED (with tracking number) → DELIVERED.
 * Displays a "Confirm Delivery" button when the order is in SHIPPED state.
 *
 * TODO(T126): Link tracking number to external carrier URL.
 */
@Composable
public fun ShippingTrackingScreen(
    order: ShippingOrderDto,
    onConfirmDelivery: () -> Unit,
    onBack: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            text = "Shipping Order",
            style = MaterialTheme.typography.titleLarge,
        )
        Text(
            text = "Order ID: ${order.id.take(DISPLAY_ID_LENGTH)}…",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Divider()

        // Tracking timeline
        TrackingStep(
            label = "Order Created",
            isCompleted = true,
            description = "Your shipping request has been received.",
        )
        TrackingStep(
            label = "Awaiting Shipment",
            isCompleted =
                order.status != ShippingOrderStatus.PENDING_SHIPMENT ||
                    order.status == ShippingOrderStatus.SHIPPED ||
                    order.status == ShippingOrderStatus.DELIVERED,
            description = "Waiting for operator to fulfill.",
        )
        TrackingStep(
            label = "Shipped",
            isCompleted =
                order.status == ShippingOrderStatus.SHIPPED ||
                    order.status == ShippingOrderStatus.DELIVERED,
            description =
                order.trackingNumber?.let { "${order.carrier ?: "Carrier"}: $it" }
                    ?: "Tracking info not yet available.",
        )
        TrackingStep(
            label = "Delivered",
            isCompleted = order.status == ShippingOrderStatus.DELIVERED,
            description = if (order.deliveredAt != null) "Delivered on ${order.deliveredAt}" else "Pending delivery.",
        )

        if (order.status == ShippingOrderStatus.SHIPPED) {
            Button(
                modifier = Modifier.fillMaxWidth(),
                onClick = onConfirmDelivery,
            ) {
                Text("Confirm Delivery")
            }
        }
    }
}

@Composable
private fun TrackingStep(
    label: String,
    isCompleted: Boolean,
    description: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = if (isCompleted) "✓" else "○",
            color =
                if (isCompleted) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                },
        )
        Column {
            Text(text = label, style = MaterialTheme.typography.bodyMedium)
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

private const val DISPLAY_ID_LENGTH = 8
