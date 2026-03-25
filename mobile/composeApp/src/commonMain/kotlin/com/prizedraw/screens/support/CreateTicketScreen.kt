package com.prizedraw.screens.support

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prizedraw.viewmodels.support.SupportIntent
import com.prizedraw.viewmodels.support.SupportViewModel

private data class TicketCategory(
    val value: String,
    val label: String,
)

private val CATEGORIES =
    listOf(
        TicketCategory("TRADE_DISPUTE", "Trade Dispute"),
        TicketCategory("DRAW_ISSUE", "Draw Issue"),
        TicketCategory("ACCOUNT_ISSUE", "Account Issue"),
        TicketCategory("SHIPPING_ISSUE", "Shipping Issue"),
        TicketCategory("PAYMENT_ISSUE", "Payment Issue"),
        TicketCategory("OTHER", "Other"),
    )

/**
 * Create ticket form screen.
 *
 * Presents:
 * - An [ExposedDropdownMenuBox] for category selection.
 * - A single-line [OutlinedTextField] for the subject.
 * - A multi-line [OutlinedTextField] for the description body.
 * - A submit button that dispatches [SupportIntent.CreateTicket].
 *
 * Handles loading and error states from the shared [SupportViewModel].
 *
 * TODO(T170): Navigate to TicketDetailScreen on successful creation
 *   (observe a side-effect / navigation event from the ViewModel).
 *
 * @param viewModel The shared support MVI ViewModel.
 * @param onBack Invoked when the user presses the back arrow.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
public fun CreateTicketScreen(
    viewModel: SupportViewModel,
    onBack: () -> Unit,
) {
    val state by viewModel.state.collectAsState()

    var selectedCategory by remember { mutableStateOf(CATEGORIES.last()) }
    var categoryExpanded by remember { mutableStateOf(false) }
    var subject by remember { mutableStateOf("") }
    var body by remember { mutableStateOf("") }

    val canSubmit = subject.isNotBlank() && body.isNotBlank() && !state.isLoading

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("New Support Ticket") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { innerPadding ->
        if (state.isLoading) {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .padding(innerPadding),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator()
            }
            return@Scaffold
        }

        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Category dropdown
            ExposedDropdownMenuBox(
                expanded = categoryExpanded,
                onExpandedChange = { categoryExpanded = !categoryExpanded },
            ) {
                OutlinedTextField(
                    value = selectedCategory.label,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Category") },
                    trailingIcon = {
                        ExposedDropdownMenuDefaults.TrailingIcon(expanded = categoryExpanded)
                    },
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                )
                ExposedDropdownMenu(
                    expanded = categoryExpanded,
                    onDismissRequest = { categoryExpanded = false },
                ) {
                    CATEGORIES.forEach { category ->
                        DropdownMenuItem(
                            text = { Text(category.label) },
                            onClick = {
                                selectedCategory = category
                                categoryExpanded = false
                            },
                            contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding,
                        )
                    }
                }
            }

            // Subject
            OutlinedTextField(
                value = subject,
                onValueChange = { subject = it },
                label = { Text("Subject") },
                placeholder = { Text("Brief description of the issue") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            // Body
            OutlinedTextField(
                value = body,
                onValueChange = { body = it },
                label = { Text("Description") },
                placeholder = { Text("Please provide as much detail as possible…") },
                minLines = 5,
                maxLines = 10,
                modifier = Modifier.fillMaxWidth(),
            )

            state.error?.let { err ->
                Text(
                    text = err,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                )
            }

            Button(
                onClick = {
                    viewModel.onIntent(
                        SupportIntent.CreateTicket(
                            category = selectedCategory.value,
                            subject = subject.trim(),
                            body = body.trim(),
                        ),
                    )
                },
                enabled = canSubmit,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Submit Ticket")
            }
        }
    }
}
