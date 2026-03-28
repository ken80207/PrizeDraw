package com.prizedraw.api.mappers

import com.prizedraw.contracts.dto.admin.MarginResultDto
import com.prizedraw.domain.services.MarginResult

/** Maps domain [MarginResult] to API [MarginResultDto]. */
public fun MarginResult.toDto(): MarginResultDto =
    MarginResultDto(
        totalRevenuePerUnit = totalRevenuePerUnit,
        totalCostPerUnit = totalCostPerUnit,
        profitPerUnit = profitPerUnit,
        marginPct = marginPct.toDouble(),
        belowThreshold = belowThreshold,
        thresholdPct = thresholdPct.toDouble(),
    )
