package com.prizedraw.screens.shipping

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prizedraw.i18n.S

/**
 * Shipping address form screen.
 *
 * Collects recipient name, phone, address lines, city, postal code, and country.
 * On submit, invokes [onSubmit] with the collected values.
 *
 * TODO(T126): Replace country input with a country picker dropdown.
 * TODO(T126): Add form validation and error feedback per field.
 *
 * @param prizeInstanceId The ID of the prize being shipped.
 * @param onSubmit Callback invoked with form data on valid submission.
 * @param onBack Callback to navigate back.
 */
@Composable
public fun ShippingFormScreen(
    prizeInstanceId: String,
    onSubmit: (ShippingFormData) -> Unit,
    onBack: () -> Unit,
) {
    var recipientName by remember { mutableStateOf("") }
    var recipientPhone by remember { mutableStateOf("") }
    var addressLine1 by remember { mutableStateOf("") }
    var addressLine2 by remember { mutableStateOf("") }
    var city by remember { mutableStateOf("") }
    var postalCode by remember { mutableStateOf("") }
    var countryCode by remember { mutableStateOf("TW") }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(text = S("shipping.addressTitle"), style = androidx.compose.material3.MaterialTheme.typography.titleLarge)

        OutlinedTextField(
            value = recipientName,
            onValueChange = { recipientName = it },
            label = { Text(S("shipping.recipientName")) },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = recipientPhone,
            onValueChange = { recipientPhone = it },
            label = { Text(S("shipping.phoneNumber")) },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = addressLine1,
            onValueChange = { addressLine1 = it },
            label = { Text(S("shipping.addressLine1")) },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = addressLine2,
            onValueChange = { addressLine2 = it },
            label = { Text(S("shipping.addressLine2Optional")) },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = city,
            onValueChange = { city = it },
            label = { Text(S("shipping.city")) },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = postalCode,
            onValueChange = { postalCode = it },
            label = { Text(S("shipping.postalCode")) },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = countryCode,
            onValueChange = { countryCode = it.uppercase().take(2) },
            label = { Text(S("shipping.countryCode")) },
            modifier = Modifier.fillMaxWidth(),
        )

        Button(
            modifier = Modifier.fillMaxWidth(),
            enabled =
                recipientName.isNotBlank() &&
                    recipientPhone.isNotBlank() &&
                    addressLine1.isNotBlank() &&
                    city.isNotBlank() &&
                    postalCode.isNotBlank() &&
                    countryCode.length == 2,
            onClick = {
                onSubmit(
                    ShippingFormData(
                        prizeInstanceId = prizeInstanceId,
                        recipientName = recipientName.trim(),
                        recipientPhone = recipientPhone.trim(),
                        addressLine1 = addressLine1.trim(),
                        addressLine2 = addressLine2.trim().ifBlank { null },
                        city = city.trim(),
                        postalCode = postalCode.trim(),
                        countryCode = countryCode,
                    ),
                )
            },
        ) {
            Text(S("shipping.requestShipping"))
        }
    }
}

/** Aggregates validated shipping form fields before API submission. */
public data class ShippingFormData(
    val prizeInstanceId: String,
    val recipientName: String,
    val recipientPhone: String,
    val addressLine1: String,
    val addressLine2: String?,
    val city: String,
    val postalCode: String,
    val countryCode: String,
)
