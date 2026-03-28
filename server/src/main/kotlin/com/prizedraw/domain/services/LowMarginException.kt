package com.prizedraw.domain.services

/**
 * Thrown when a campaign activation is rejected due to low margin.
 * The route handler maps this to HTTP 422 with the [marginResult] in the response body.
 */
public class LowMarginException(
    public val marginResult: MarginResult,
) : RuntimeException(
        "Campaign margin ${marginResult.marginPct}% is below threshold ${marginResult.thresholdPct}%",
    )
