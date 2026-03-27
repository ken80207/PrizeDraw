package com.prizedraw.screens.wallet

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.prizedraw.i18n.S

/** Approximate TWD equivalent rate: 1 revenue point = 1 TWD cent = TWD 0.01. */
private const val POINTS_PER_TWD = 100

/**
 * Withdrawal request screen.
 *
 * Displays the player's current revenue points balance and a bank account form.
 * Shows a TWD equivalent preview below the amount input.
 * Submits to POST /api/v1/withdrawals.
 *
 * TODO(T151): Wire to WithdrawalViewModel — load balance, dispatch SubmitWithdrawal intent.
 *
 * @param revenuePointsBalance  Current revenue points balance.
 * @param onSubmit              Invoked with (bankName, bankCode, holderName, accountNumber, amount).
 * @param onBack                Navigation back.
 */
@Composable
public fun WithdrawalScreen(
    revenuePointsBalance: Int,
    onSubmit: (bankName: String, bankCode: String, holderName: String, accountNumber: String, amount: Int) -> Unit,
    onBack: () -> Unit,
) {
    var bankName by remember { mutableStateOf("") }
    var bankCode by remember { mutableStateOf("") }
    var holderName by remember { mutableStateOf("") }
    var accountNumber by remember { mutableStateOf("") }
    var amountText by remember { mutableStateOf("") }

    val amount = amountText.toIntOrNull() ?: 0
    val twdEquivalent = amount.toDouble() / POINTS_PER_TWD
    val isValid =
        bankName.isNotBlank() &&
            bankCode.isNotBlank() &&
            holderName.isNotBlank() &&
            accountNumber.isNotBlank() &&
            amount in 1..revenuePointsBalance

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(text = S("wallet.withdrawTitle"), style = MaterialTheme.typography.headlineSmall)

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Text(S("wallet.availableBalance"), style = MaterialTheme.typography.labelMedium)
                Text(
                    text = "$revenuePointsBalance pts",
                    style = MaterialTheme.typography.headlineMedium,
                )
            }
        }

        OutlinedTextField(
            value = bankName,
            onValueChange = { bankName = it },
            label = { Text(S("wallet.bankName")) },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = bankCode,
            onValueChange = { bankCode = it },
            label = { Text(S("wallet.bankCode")) },
            modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        )
        OutlinedTextField(
            value = holderName,
            onValueChange = { holderName = it },
            label = { Text(S("wallet.accountHolderName")) },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = accountNumber,
            onValueChange = { accountNumber = it },
            label = { Text(S("wallet.accountNumber")) },
            modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        )
        OutlinedTextField(
            value = amountText,
            onValueChange = { amountText = it.filter { c -> c.isDigit() } },
            label = { Text(S("wallet.amount")) },
            modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            supportingText = {
                if (amount > 0) {
                    Text("≈ TWD ${kotlin.math.round(twdEquivalent * 100) / 100.0}")
                }
            },
            isError = amount > revenuePointsBalance,
        )

        if (amount > revenuePointsBalance) {
            Text(
                text = S("wallet.amountExceedsBalance"),
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            OutlinedButton(onClick = onBack, modifier = Modifier.weight(1f)) { Text(S("common.cancel")) }
            Button(
                onClick = {
                    onSubmit(bankName, bankCode, holderName, accountNumber, amount)
                },
                enabled = isValid,
                modifier = Modifier.weight(1f),
            ) { Text(S("common.submit")) }
        }
    }
}
