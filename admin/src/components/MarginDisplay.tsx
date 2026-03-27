"use client";

import type { MarginResult } from "@/lib/margin-utils";

interface MarginDisplayProps {
  result: MarginResult | null;
  label?: string;
}

export function MarginDisplay({ result, label = "風控分析" }: MarginDisplayProps) {
  if (!result) return null;

  const color =
    result.marginPct < 0
      ? "text-red-600 bg-red-50 border-red-200"
      : result.belowThreshold
        ? "text-orange-600 bg-orange-50 border-orange-200"
        : "text-green-600 bg-green-50 border-green-200";

  return (
    <div className={`rounded-lg border p-4 ${color}`}>
      <h4 className="font-medium mb-2">{label}</h4>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>每抽營收</div>
        <div className="text-right">{result.totalRevenuePerUnit.toLocaleString()} 點</div>
        <div>每抽成本/期望支出</div>
        <div className="text-right">{result.totalCostPerUnit.toLocaleString()} 點</div>
        <div>每抽利潤</div>
        <div className="text-right">{result.profitPerUnit.toLocaleString()} 點</div>
        <div className="font-medium">毛利率</div>
        <div className="text-right font-medium">{result.marginPct.toFixed(2)}%</div>
      </div>
      {result.belowThreshold && (
        <p className="mt-2 text-sm font-medium">
          {result.marginPct < 0
            ? "全部賣完仍虧損！賞品總成本超過總營收。"
            : `毛利率低於 ${result.thresholdPct}% 警戒線。`}
        </p>
      )}
    </div>
  );
}
