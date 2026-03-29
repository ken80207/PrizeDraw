package com.prizedraw.screens.wallet

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Badge
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.prizedraw.components.button.PrimaryButton
import com.prizedraw.components.card.PrizeDrawCard
import com.prizedraw.components.card.StatCard
import com.prizedraw.components.common.TransactionRow
import com.prizedraw.components.layout.FilterTabs
import com.prizedraw.components.layout.SectionHeader
import com.prizedraw.contracts.dto.player.WalletDto
import com.prizedraw.i18n.S
import com.prizedraw.navigation.WindowWidthSizeClass
import com.prizedraw.navigation.rememberWindowWidthSizeClass

private val TRANSACTION_TABS = listOf("All", "Recharge", "Spend", "Withdrawal")

private data class RechargePackage(
    val label: String,
    val pts: Int,
    val bonusPts: Int,
    val price: String,
    val isPopular: Boolean = false,
)

private val RECHARGE_PACKAGES =
    listOf(
        RechargePackage(label = "Starter Pack", pts = 500, bonusPts = 0, price = "\$4.99"),
        RechargePackage(label = "Custom Pack", pts = 1_000, bonusPts = 50, price = "\$9.99", isPopular = true),
        RechargePackage(label = "Whale Pack", pts = 5_000, bonusPts = 500, price = "\$44.99"),
    )

/**
 * Wallet screen displaying dual point balances, quick recharge packages,
 * a custom recharge input, profit withdrawal card, and paginated transaction history.
 *
 * Layout:
 * - Two [StatCard]s for Purchase Points (amber) and Profit Points.
 * - Quick Recharge section with three package cards and a "POPULAR" badge on the middle option.
 * - Custom recharge amount input + [PrimaryButton] for "RECHARGE NOW".
 * - Profit Withdrawal card (shown right column on tablet, below on phone).
 * - Transaction History with [FilterTabs] (All / Recharge / Spend / Withdrawal) and [TransactionRow] list.
 *
 * @param wallet Current wallet data including balances and transaction history.
 * @param onTopUp Callback invoked when the user triggers a top-up action.
 */
@Composable
public fun WalletScreen(
    wallet: WalletDto,
    onTopUp: () -> Unit,
) {
    var selectedTransactionTab by remember { mutableIntStateOf(0) }
    var customRechargeAmount by remember { mutableStateOf("") }
    var withdrawalAmount by remember { mutableStateOf("") }

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val windowSize = rememberWindowWidthSizeClass(maxWidth)
        val isTablet = windowSize == WindowWidthSizeClass.Medium

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Balance stats row
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    StatCard(
                        value = "${wallet.drawPointsBalance} pts",
                        label = S("wallet.drawPoints"),
                        modifier = Modifier.weight(1f),
                    )
                    StatCard(
                        value = "${wallet.revenuePointsBalance} pts",
                        label = S("wallet.revenuePoints"),
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            // Quick Recharge + Profit Withdrawal (side by side on tablet, stacked on phone)
            item {
                if (isTablet) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        verticalAlignment = Alignment.Top,
                    ) {
                        Column(modifier = Modifier.weight(1.5f)) {
                            QuickRechargeSection(
                                customAmount = customRechargeAmount,
                                onCustomAmountChange = { customRechargeAmount = it },
                                onRecharge = onTopUp,
                            )
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            ProfitWithdrawalCard(
                                amount = withdrawalAmount,
                                onAmountChange = { withdrawalAmount = it },
                                onWithdraw = {},
                            )
                        }
                    }
                } else {
                    QuickRechargeSection(
                        customAmount = customRechargeAmount,
                        onCustomAmountChange = { customRechargeAmount = it },
                        onRecharge = onTopUp,
                    )
                }
            }

            // Profit withdrawal below on phone
            if (!isTablet) {
                item {
                    ProfitWithdrawalCard(
                        amount = withdrawalAmount,
                        onAmountChange = { withdrawalAmount = it },
                        onWithdraw = {},
                    )
                }
            }

            // Transaction history
            item {
                SectionHeader(
                    title = S("wallet.transactionHistory"),
                    subtitle = S("wallet.transactionSubtitle"),
                )
                FilterTabs(
                    tabs = TRANSACTION_TABS,
                    selectedIndex = selectedTransactionTab,
                    onTabSelected = { selectedTransactionTab = it },
                )
            }

            // Draw transactions (tab 0 = All, tab 1 = Recharge)
            if (selectedTransactionTab == 0 || selectedTransactionTab == 1) {
                items(wallet.drawTransactions, key = { "draw-${it.id}" }) { tx ->
                    TransactionRow(
                        date =
                            tx.createdAt
                                .toString()
                                .take(16)
                                .replace("T", " "),
                        type = tx.type.name,
                        description = tx.description ?: tx.type.name,
                        amount = "${if (tx.amount >= 0) "+" else ""}${tx.amount}",
                        status = "Completed",
                        isPositive = tx.amount >= 0,
                    )
                }
            }

            // Revenue transactions (tab 0 = All, tab 2 = Spend, tab 3 = Withdrawal)
            if (selectedTransactionTab == 0 || selectedTransactionTab == 2 || selectedTransactionTab == 3) {
                items(wallet.revenueTransactions, key = { "rev-${it.id}" }) { tx ->
                    TransactionRow(
                        date =
                            tx.createdAt
                                .toString()
                                .take(16)
                                .replace("T", " "),
                        type = tx.type.name,
                        description = tx.description ?: tx.type.name,
                        amount = "${if (tx.amount >= 0) "+" else ""}${tx.amount}",
                        status = "Completed",
                        isPositive = tx.amount >= 0,
                    )
                }
            }

            // Bottom spacer
            item { Spacer(modifier = Modifier.height(16.dp)) }
        }
    }
}

@Composable
private fun QuickRechargeSection(
    customAmount: String,
    onCustomAmountChange: (String) -> Unit,
    onRecharge: () -> Unit,
) {
    Column {
        SectionHeader(
            title = S("wallet.quickRecharge"),
            actionText = S("wallet.viewAllPackages"),
            onAction = {},
        )

        // Package cards row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            RECHARGE_PACKAGES.forEach { pkg ->
                RechargePackageCard(
                    pkg = pkg,
                    modifier = Modifier.weight(1f),
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Custom recharge input row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedTextField(
                value = customAmount,
                onValueChange = onCustomAmountChange,
                modifier = Modifier.weight(1f),
                placeholder = { Text(S("wallet.enterAmount")) },
                label = { Text(S("wallet.customRecharge")) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                shape = MaterialTheme.shapes.medium,
            )
            PrimaryButton(
                text = S("wallet.rechargeNow"),
                onClick = onRecharge,
            )
        }
    }
}

@Composable
private fun RechargePackageCard(
    pkg: RechargePackage,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier) {
        PrizeDrawCard(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = pkg.label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = "${pkg.pts} pts",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(top = 4.dp),
            )
            if (pkg.bonusPts > 0) {
                Text(
                    text = "+${pkg.bonusPts} bonus pts",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
            Text(
                text = pkg.price,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(top = 8.dp),
            )
        }

        if (pkg.isPopular) {
            Badge(
                modifier =
                    Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = (-4).dp),
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ) {
                Text(
                    text = "POPULAR",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 6.dp),
                )
            }
        }
    }
}

@Composable
private fun ProfitWithdrawalCard(
    amount: String,
    onAmountChange: (String) -> Unit,
    onWithdraw: () -> Unit,
) {
    PrizeDrawCard(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = S("wallet.profitWithdrawal"),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
        )

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = amount,
            onValueChange = onAmountChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text(S("wallet.withdrawalAmount")) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            shape = MaterialTheme.shapes.medium,
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Breakdown rows
        WithdrawalBreakdownRow(
            label = S("wallet.conversion"),
            value = "\$0.01/pt",
        )
        WithdrawalBreakdownRow(
            label = S("wallet.serviceFee"),
            value = "-\$0.40",
        )

        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp)
                    .background(
                        color = MaterialTheme.colorScheme.surfaceContainerHigh,
                        shape = RoundedCornerShape(8.dp),
                    ).padding(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = S("wallet.totalPayout"),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = "\$—",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        PrimaryButton(
            text = S("wallet.withdrawToBank"),
            onClick = onWithdraw,
            fullWidth = true,
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = S("wallet.withdrawalNote"),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun WithdrawalBreakdownRow(
    label: String,
    value: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurface,
        )
    }
}
