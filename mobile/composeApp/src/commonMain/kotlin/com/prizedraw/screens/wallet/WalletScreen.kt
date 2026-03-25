package com.prizedraw.screens.wallet

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prizedraw.contracts.dto.player.DrawPointTransactionDto
import com.prizedraw.contracts.dto.player.RevenuePointTransactionDto
import com.prizedraw.contracts.dto.player.WalletDto

/**
 * Wallet screen displaying dual point balances and paginated transaction history.
 *
 * Layout:
 * - Two balance cards at the top: draw points (消費點數) and revenue points (收益點數).
 * - A tab row toggling between draw-point and revenue-point transaction lists.
 * - A top-up button that opens the payment WebView flow.
 *
 * TODO(T096): Load wallet data from a WalletViewModel connected to the player profile
 *   and transaction history endpoints.
 */
@Composable
public fun WalletScreen(
    wallet: WalletDto,
    onTopUp: () -> Unit,
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf("Draw Points", "Revenue Points")

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
    ) {
        // Balance cards
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            BalanceCard(
                modifier = Modifier.weight(1f),
                label = "Draw Points",
                balance = wallet.drawPointsBalance,
            )
            BalanceCard(
                modifier = Modifier.weight(1f),
                label = "Revenue Points",
                balance = wallet.revenuePointsBalance,
            )
        }

        Spacer(Modifier.height(16.dp))

        // Top-up button
        Button(
            modifier = Modifier.fillMaxWidth(),
            onClick = onTopUp,
        ) {
            Text("Top Up Draw Points")
        }

        Spacer(Modifier.height(16.dp))

        // Transaction history tabs
        TabRow(selectedTabIndex = selectedTab) {
            tabs.forEachIndexed { index, title ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = { Text(title) },
                )
            }
        }

        Spacer(Modifier.height(8.dp))

        when (selectedTab) {
            0 -> DrawTransactionList(transactions = wallet.drawTransactions)
            1 -> RevenueTransactionList(transactions = wallet.revenueTransactions)
        }
    }
}

@Composable
private fun BalanceCard(
    modifier: Modifier = Modifier,
    label: String,
    balance: Int,
) {
    Card(modifier = modifier) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(text = label, style = MaterialTheme.typography.labelMedium)
            Spacer(Modifier.height(8.dp))
            Text(
                text = balance.toString(),
                style = MaterialTheme.typography.headlineMedium,
            )
        }
    }
}

@Composable
private fun DrawTransactionList(transactions: List<DrawPointTransactionDto>) {
    if (transactions.isEmpty()) {
        Text(
            modifier = Modifier.padding(16.dp),
            text = "No draw point transactions yet.",
            style = MaterialTheme.typography.bodyMedium,
        )
        return
    }
    LazyColumn {
        items(transactions, key = { it.id }) { tx ->
            Column(modifier = Modifier.padding(vertical = 8.dp, horizontal = 4.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(text = tx.type.name, style = MaterialTheme.typography.bodyMedium)
                    Text(
                        text = "${if (tx.amount >= 0) "+" else ""}${tx.amount} pts",
                        style = MaterialTheme.typography.bodyMedium,
                        color =
                            if (tx.amount >= 0) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.error
                            },
                    )
                }
                tx.description?.let { desc ->
                    Text(text = desc, style = MaterialTheme.typography.bodySmall)
                }
                Text(
                    text = tx.createdAt.toString(),
                    style = MaterialTheme.typography.labelSmall,
                )
            }
            HorizontalDivider()
        }
    }
}

@Composable
private fun RevenueTransactionList(transactions: List<RevenuePointTransactionDto>) {
    if (transactions.isEmpty()) {
        Text(
            modifier = Modifier.padding(16.dp),
            text = "No revenue point transactions yet.",
            style = MaterialTheme.typography.bodyMedium,
        )
        return
    }
    LazyColumn {
        items(transactions, key = { it.id }) { tx ->
            Column(modifier = Modifier.padding(vertical = 8.dp, horizontal = 4.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(text = tx.type.name, style = MaterialTheme.typography.bodyMedium)
                    Text(
                        text = "${if (tx.amount >= 0) "+" else ""}${tx.amount} pts",
                        style = MaterialTheme.typography.bodyMedium,
                        color =
                            if (tx.amount >= 0) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.error
                            },
                    )
                }
                tx.description?.let { desc ->
                    Text(text = desc, style = MaterialTheme.typography.bodySmall)
                }
                Text(
                    text = tx.createdAt.toString(),
                    style = MaterialTheme.typography.labelSmall,
                )
            }
            HorizontalDivider()
        }
    }
}
