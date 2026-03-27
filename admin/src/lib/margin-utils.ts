export interface KujiPrizeInput {
  ticketCount: number;
  prizeValue: number;
}

export interface UnlimitedPrizeInput {
  probabilityBps: number;
  prizeValue: number;
}

export interface MarginResult {
  totalRevenuePerUnit: number;
  totalCostPerUnit: number;
  profitPerUnit: number;
  marginPct: number;
  belowThreshold: boolean;
  thresholdPct: number;
}

const PROBABILITY_TOTAL = 1_000_000;

export function calcKujiMargin(
  pricePerDraw: number,
  prizes: KujiPrizeInput[],
  boxCount: number,
  thresholdPct: number,
): MarginResult {
  const ticketsPerBox = prizes.reduce((sum, p) => sum + p.ticketCount, 0);
  const totalRevenue = ticketsPerBox * pricePerDraw * boxCount;
  const costPerBox = prizes.reduce((sum, p) => sum + p.ticketCount * p.prizeValue, 0);
  const totalCost = costPerBox * boxCount;
  const profit = totalRevenue - totalCost;
  const marginPct = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  return {
    totalRevenuePerUnit: totalRevenue,
    totalCostPerUnit: totalCost,
    profitPerUnit: profit,
    marginPct,
    belowThreshold: marginPct < thresholdPct,
    thresholdPct,
  };
}

export function calcUnlimitedMargin(
  pricePerDraw: number,
  prizes: UnlimitedPrizeInput[],
  thresholdPct: number,
): MarginResult {
  const expectedPayout = prizes.reduce(
    (sum, p) => sum + (p.probabilityBps / PROBABILITY_TOTAL) * p.prizeValue,
    0,
  );
  const profit = pricePerDraw - expectedPayout;
  const marginPct = pricePerDraw > 0 ? (profit / pricePerDraw) * 100 : 0;

  return {
    totalRevenuePerUnit: pricePerDraw,
    totalCostPerUnit: Math.round(expectedPayout),
    profitPerUnit: Math.round(profit),
    marginPct,
    belowThreshold: marginPct < thresholdPct,
    thresholdPct,
  };
}

export function pctToBps(pct: number): number {
  return Math.round(pct * 10_000);
}

export function bpsToPct(bps: number): number {
  return bps / 10_000;
}
