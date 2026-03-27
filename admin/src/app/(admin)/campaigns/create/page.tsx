"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/services/apiClient";
import { ImageUpload } from "@/components/ImageUpload";
import { calcUnlimitedMargin, pctToBps } from "@/lib/margin-utils";
import { MarginDisplay } from "@/components/MarginDisplay";

type CampaignType = "kuji" | "unlimited";

interface ProbabilityRow {
  id: string;
  grade: string;
  name: string;
  probability: number;
  prizeValue: number;
  photoUrl: string;
}

interface KujiPrize {
  id: string;
  grade: string;
  name: string;
  quantity: number;
  prizeValue: number;
  photoUrl: string;
}

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

function CampaignCreateInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType = (searchParams.get("type") ?? "kuji") as CampaignType;

  const [type, setType] = useState<CampaignType>(initialType);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(100);
  const [sessionMinutes, setSessionMinutes] = useState(5);
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kuji state — prizes defined once, boxCount controls how many identical boxes
  const [boxCount, setBoxCount] = useState(1);
  const [kujiPrizes, setKujiPrizes] = useState<KujiPrize[]>([]);

  // Unlimited state
  const [probRows, setProbRows] = useState<ProbabilityRow[]>([
    { id: genId(), grade: "A賞", name: "", probability: 0.5, prizeValue: 0, photoUrl: "" },
    { id: genId(), grade: "B賞", name: "", probability: 2.0, prizeValue: 0, photoUrl: "" },
    { id: genId(), grade: "C賞", name: "", probability: 10, prizeValue: 0, photoUrl: "" },
    { id: genId(), grade: "D賞", name: "", probability: 87.5, prizeValue: 0, photoUrl: "" },
  ]);

  const totalProb = probRows.reduce((s, r) => s + r.probability, 0);
  const probValid = Math.abs(totalProb - 100) < 0.01;

  const unlimitedMargin =
    type === "unlimited" && probRows.length > 0
      ? calcUnlimitedMargin(
          price,
          probRows.map((r) => ({ probabilityBps: pctToBps(r.probability), prizeValue: r.prizeValue })),
          20,
        )
      : null;

  // Kuji computed values
  const ticketsPerBox = kujiPrizes.reduce((s, p) => s + p.quantity, 0);
  const totalTickets = ticketsPerBox * boxCount;
  const costPerBox = kujiPrizes.reduce((s, p) => s + p.quantity * p.prizeValue, 0);
  const revenuePerBox = ticketsPerBox * price;
  const totalRevenue = revenuePerBox * boxCount;
  const totalCost = costPerBox * boxCount;
  const totalProfit = totalRevenue - totalCost;
  const marginPct = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Fat finger warnings
  const kujiWarnings: string[] = [];
  if (type === "kuji" && kujiPrizes.length > 0) {
    if (price > 0 && price < 10) {
      kujiWarnings.push(`每抽價格僅 ${price} 點，是否少打了零？`);
    }
    if (totalRevenue > 0 && marginPct < 0) {
      kujiWarnings.push("全部賣完仍虧損！賞品總成本超過總營收。");
    } else if (totalRevenue > 0 && marginPct < 20) {
      kujiWarnings.push(`毛利率僅 ${marginPct.toFixed(1)}%，低於 20% 警戒線。`);
    }
    for (const p of kujiPrizes) {
      if (p.prizeValue > 0 && p.prizeValue > price * 10) {
        kujiWarnings.push(`「${p.grade || "未命名"}」單個賞品價值 ${p.prizeValue} 點，是每抽價格的 ${(p.prizeValue / price).toFixed(0)} 倍，請確認。`);
      }
      if (p.quantity > 0 && p.prizeValue === 0 && p.grade) {
        kujiWarnings.push(`「${p.grade}」尚未設定賞品價值。`);
      }
    }
    if (ticketsPerBox > 0 && kujiPrizes.some((p) => p.quantity <= 0)) {
      kujiWarnings.push("有賞品數量為 0，請確認。");
    }
  }

  const addKujiPrize = () => {
    setKujiPrizes((prev) => [
      ...prev,
      { id: genId(), grade: "", name: "", quantity: 1, prizeValue: 0, photoUrl: "" },
    ]);
  };

  const updateKujiPrize = (id: string, field: keyof KujiPrize, value: unknown) => {
    setKujiPrizes((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const removeKujiPrize = (id: string) => {
    setKujiPrizes((prev) => prev.filter((p) => p.id !== id));
  };

  const updateProbRow = (id: string, field: keyof ProbabilityRow, value: unknown) => {
    setProbRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addProbRow = () => {
    setProbRows((prev) => [
      ...prev,
      { id: genId(), grade: "", name: "", probability: 0, prizeValue: 0, photoUrl: "" },
    ]);
  };

  const removeProbRow = (id: string) => {
    setProbRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSubmit = async (publish: boolean) => {
    setIsSubmitting(true);
    setError(null);
    try {
      if (type === "kuji") {
        // Generate identical boxes from the prize template
        const boxLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let rangeStart = 1;
        const ticketRanges = kujiPrizes.map((p) => {
          const range = {
            grade: p.grade,
            prizeName: p.name,
            rangeStart,
            rangeEnd: rangeStart + p.quantity - 1,
            prizeValue: p.prizeValue,
            photoUrl: p.photoUrl || undefined,
          };
          rangeStart += p.quantity;
          return range;
        });

        const boxes = Array.from({ length: boxCount }, (_, i) => ({
          name: `籤盒 ${boxLabels[i] ?? i + 1}`,
          totalTickets: ticketsPerBox,
          ticketRanges,
        }));

        const body = {
          title: name,
          description,
          coverImageUrl: coverImageUrl || undefined,
          pricePerDraw: price,
          drawSessionSeconds: sessionMinutes * 60,
          boxes,
        };
        await apiClient.post("/api/v1/admin/campaigns/kuji", body);
      } else {
        const body = {
          title: name,
          description,
          coverImageUrl: coverImageUrl || undefined,
          pricePerDraw: price,
          prizeTable: probRows.map((r) => ({
            grade: r.grade,
            name: r.name,
            probabilityBps: pctToBps(r.probability),
            prizeValue: r.prizeValue,
            photoUrl: r.photoUrl || undefined,
            displayOrder: probRows.indexOf(r),
          })),
        };
        await apiClient.post("/api/v1/admin/campaigns/unlimited", body);
      }
      router.push("/campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "建立失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  const GRADE_OPTIONS = [
    "SP賞", "SSR賞", "SR賞",
    "A賞", "B賞", "C賞", "D賞", "E賞", "F賞", "G賞", "H賞",
    "Last賞", "W賞",
  ];

  const usedGrades = new Set(kujiPrizes.map((p) => p.grade));

  const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";
  const labelCls = "mb-1 block text-sm font-medium text-slate-700";

  return (
    <div className="flex gap-8 items-start">
    {/* Left: Form */}
    <div className="space-y-6 max-w-3xl flex-1 min-w-0">
      <div>
        <h1 className="text-xl font-bold text-slate-900">建立活動</h1>
        <p className="text-sm text-slate-500">填寫活動資訊後選擇儲存或上架</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Type selector */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-5">
        <h2 className="text-sm font-semibold text-slate-800">活動類型</h2>
        <div className="flex gap-3">
          {(["kuji", "unlimited"] as CampaignType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 rounded-lg border-2 py-3 text-sm font-semibold transition-colors ${
                type === t
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {t === "kuji" ? "🎰 一番賞" : "🎲 無限賞"}
            </button>
          ))}
        </div>
      </div>

      {/* Basic info */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">基本資訊</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>活動名稱 *</label>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：春季限定 一番賞"
              required
            />
          </div>

          <div>
            <label className={labelCls}>每抽價格（點）*</label>
            <input
              type="number"
              className={inputCls}
              value={price || ""}
              onChange={(e) => setPrice(e.target.value === "" ? 0 : Number(e.target.value))}
              onFocus={(e) => e.target.select()}
              min={1}
            />
          </div>

          {type === "kuji" && (
            <div>
              <label className={labelCls}>抽籤時間（分鐘）</label>
              <input
                type="number"
                className={inputCls}
                value={sessionMinutes}
                onChange={(e) => setSessionMinutes(Number(e.target.value))}
                min={1}
                max={60}
              />
            </div>
          )}

          <div className="sm:col-span-2">
            <ImageUpload
              label="封面圖片"
              currentUrl={coverImageUrl || undefined}
              onUpload={(url) => setCoverImageUrl(url)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>活動描述</label>
            <textarea
              className={inputCls}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="活動說明..."
            />
          </div>
        </div>
      </div>

      {/* Kuji: Box setup (parent) with prizes (children) */}
      {type === "kuji" && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-800">籤盒設定</h2>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">數量</label>
              <input
                type="number"
                className="w-20 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                value={boxCount}
                onChange={(e) => setBoxCount(Math.max(1, Number(e.target.value)))}
                min={1}
              />
              <span className="text-sm text-slate-400">盒</span>
            </div>
            <p className="text-xs text-slate-400">
              {Array.from({ length: Math.min(boxCount, 8) }, (_, i) => `${("ABCDEFGHIJKLMNOPQRSTUVWXYZ")[i]}`).join("、")}
              {boxCount > 8 ? `…共 ${boxCount} 盒` : ""}
            </p>
          </div>

          {/* Prizes nested inside box */}
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-4 w-1 rounded-full bg-indigo-400" />
                <h3 className="text-sm font-medium text-slate-700">每盒賞品內容</h3>
                {ticketsPerBox > 0 && (
                  <span className="text-xs text-slate-400">（每盒 {ticketsPerBox} 抽）</span>
                )}
              </div>
              <button
                type="button"
                onClick={addKujiPrize}
                className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
              >
                + 新增賞品
              </button>
            </div>

            {kujiPrizes.length === 0 && (
              <p className="text-xs text-slate-400 py-3 text-center">尚未新增賞品，點擊上方按鈕開始設定</p>
            )}

            <div className="space-y-2">
              {kujiPrizes.map((prize) => (
                <div key={prize.id} className="rounded-lg border border-white bg-white p-3 space-y-2 shadow-sm">
                  <div className="flex items-center gap-2 text-sm">
                    <select
                      className="w-24 rounded border border-slate-300 px-2 py-1 text-xs bg-white"
                      value={prize.grade}
                      onChange={(e) => updateKujiPrize(prize.id, "grade", e.target.value)}
                    >
                      <option value="">選擇等級</option>
                      {GRADE_OPTIONS.map((g) => (
                        <option key={g} value={g} disabled={usedGrades.has(g) && prize.grade !== g}>
                          {g}
                        </option>
                      ))}
                    </select>
                    <input
                      className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                      placeholder="賞品名稱"
                      value={prize.name}
                      onChange={(e) => updateKujiPrize(prize.id, "name", e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removeKujiPrize(prize.id)}
                      className="text-slate-400 hover:text-red-500 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">數量</span>
                      <input
                        type="number"
                        className="w-16 rounded border border-slate-300 px-2 py-1 text-xs"
                        value={prize.quantity || ""}
                        onChange={(e) => updateKujiPrize(prize.id, "quantity", e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))}
                        onFocus={(e) => e.target.select()}
                        min={0}
                      />
                      <span className="text-slate-400">個</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">價值</span>
                      <input
                        type="number"
                        className="w-24 rounded border border-slate-300 px-2 py-1 text-xs"
                        value={prize.prizeValue || ""}
                        onChange={(e) => updateKujiPrize(prize.id, "prizeValue", e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))}
                        onFocus={(e) => e.target.select()}
                        min={0}
                      />
                      <span className="text-slate-400">點</span>
                    </div>
                    <ImageUpload
                      compact
                      currentUrl={prize.photoUrl || undefined}
                      onUpload={(url) => updateKujiPrize(prize.id, "photoUrl", url)}
                    />
                  </div>
                  {prize.quantity > 0 && prize.prizeValue > 0 && (
                    <p className="text-xs text-slate-400">
                      小計: {(prize.quantity * prize.prizeValue).toLocaleString()} 點 / 盒
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {kujiPrizes.length > 0 && ticketsPerBox > 0 && (
            <p className="text-xs text-slate-500">
              每盒 {ticketsPerBox} 抽 x {boxCount} 盒 = 共 <span className="font-medium text-slate-700">{totalTickets} 抽</span>
            </p>
          )}
        </div>
      )}

      {/* Kuji: Profit analysis & warnings */}
      {type === "kuji" && kujiPrizes.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-800">營收分析</h2>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-xs text-blue-600">總營收（全部賣出）</p>
              <p className="text-lg font-bold text-blue-700">{totalRevenue.toLocaleString()} 點</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-xs text-amber-600">賞品總成本</p>
              <p className="text-lg font-bold text-amber-700">{totalCost.toLocaleString()} 點</p>
            </div>
            <div className={`rounded-lg p-3 ${totalProfit >= 0 ? "bg-green-50" : "bg-red-50"}`}>
              <p className={`text-xs ${totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>毛利</p>
              <p className={`text-lg font-bold ${totalProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                {totalProfit.toLocaleString()} 點
              </p>
            </div>
            <div className={`rounded-lg p-3 ${marginPct >= 20 ? "bg-green-50" : marginPct >= 0 ? "bg-amber-50" : "bg-red-50"}`}>
              <p className={`text-xs ${marginPct >= 20 ? "text-green-600" : marginPct >= 0 ? "text-amber-600" : "text-red-600"}`}>毛利率</p>
              <p className={`text-lg font-bold ${marginPct >= 20 ? "text-green-700" : marginPct >= 0 ? "text-amber-700" : "text-red-700"}`}>
                {marginPct.toFixed(1)}%
              </p>
            </div>
          </div>

          {boxCount > 1 && (
            <p className="text-xs text-slate-500">
              單盒: 營收 {revenuePerBox.toLocaleString()} 點 / 成本 {costPerBox.toLocaleString()} 點 / 毛利 {(revenuePerBox - costPerBox).toLocaleString()} 點
            </p>
          )}

          {kujiWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-1">
              <p className="text-xs font-semibold text-amber-800">⚠ 注意事項</p>
              {kujiWarnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700">• {w}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Unlimited: Probability table */}
      {type === "unlimited" && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">賞品與機率設定</h2>
            <button
              type="button"
              onClick={addProbRow}
              className="rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
            >
              + 新增等級
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="pb-2 text-left text-xs font-medium text-slate-500 pr-3">等級</th>
                  <th className="pb-2 text-left text-xs font-medium text-slate-500 pr-3">賞品名稱</th>
                  <th className="pb-2 text-left text-xs font-medium text-slate-500 pr-3">機率 %</th>
                  <th className="pb-2 text-left text-xs font-medium text-slate-500 pr-3">市場價值</th>
                  <th className="pb-2 text-left text-xs font-medium text-slate-500 pr-3">圖片</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {probRows.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2 pr-3">
                      <input
                        className="w-16 rounded border border-slate-300 px-2 py-1 text-xs"
                        value={row.grade}
                        onChange={(e) => updateProbRow(row.id, "grade", e.target.value)}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        className="w-36 rounded border border-slate-300 px-2 py-1 text-xs"
                        value={row.name}
                        onChange={(e) => updateProbRow(row.id, "name", e.target.value)}
                        placeholder="賞品名稱"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        className="w-20 rounded border border-slate-300 px-2 py-1 text-xs"
                        value={row.probability}
                        onChange={(e) => updateProbRow(row.id, "probability", parseFloat(e.target.value) || 0)}
                        step="0.01"
                        min={0}
                        max={100}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          className="w-24 rounded border border-slate-300 px-2 py-1 text-xs"
                          value={row.prizeValue || ""}
                          onChange={(e) => updateProbRow(row.id, "prizeValue", e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))}
                          onFocus={(e) => e.target.select()}
                          min={0}
                          placeholder="0"
                        />
                        <span className="text-xs text-slate-400">點</span>
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      <ImageUpload
                        compact
                        currentUrl={row.photoUrl || undefined}
                        onUpload={(url) => updateProbRow(row.id, "photoUrl", url)}
                      />
                    </td>
                    <td className="py-2">
                      {probRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeProbRow(row.id)}
                          className="text-slate-400 hover:text-red-500 text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={`flex items-center gap-2 text-sm font-medium ${probValid ? "text-green-600" : "text-red-600"}`}>
            <span>機率總和: {totalProb.toFixed(2)}%</span>
            <span>{probValid ? "✓" : "⚠ 必須等於 100%"}</span>
          </div>

          <MarginDisplay result={unlimitedMargin} />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/campaigns")}
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          取消
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={isSubmitting}
          className="rounded-lg border border-indigo-300 px-5 py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
        >
          儲存草稿
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={isSubmitting || (type === "unlimited" && !probValid) || (type === "kuji" && kujiPrizes.length === 0) || !name}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSubmitting ? "儲存中..." : "儲存並上架"}
        </button>
      </div>
    </div>

    {/* Right: Live Preview (xl+ only) */}
    <div className="hidden xl:block w-[375px] shrink-0 sticky top-6">
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="bg-slate-800 px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-slate-400">玩家端預覽</span>
          <div className="flex gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
          </div>
        </div>
        <KujiPreview
          title={name}
          description={description}
          coverImageUrl={coverImageUrl}
          pricePerDraw={price}
          boxCount={boxCount}
          sessionMinutes={sessionMinutes}
          prizes={kujiPrizes}
          ticketsPerBox={ticketsPerBox}
        />
      </div>
    </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Player-facing preview (mirrors web/src/app/campaigns/[id]/page.tsx layout)
// ─────────────────────────────────────────────────────────────────────────────

const GRADE_EMOJI: Record<string, string> = {
  "SP賞": "👑", "SSR賞": "💎", "SR賞": "💎",
  "A賞": "🥇", "B賞": "🥈", "C賞": "🥉",
  "Last賞": "🌟", "W賞": "🎯",
};

const GRADE_COLORS: Record<string, string> = {
  "SP賞": "from-amber-400 to-yellow-500",
  "SSR賞": "from-purple-500 to-pink-500",
  "SR賞": "from-blue-500 to-indigo-500",
  "A賞": "from-amber-500 to-orange-500",
  "B賞": "from-blue-400 to-cyan-500",
  "C賞": "from-emerald-400 to-green-500",
  "D賞": "from-purple-400 to-violet-500",
  "E賞": "from-pink-400 to-rose-500",
  "F賞": "from-teal-400 to-cyan-500",
  "Last賞": "from-amber-500 to-red-500",
};

function KujiPreview({
  title,
  description,
  coverImageUrl,
  pricePerDraw,
  boxCount,
  sessionMinutes,
  prizes,
  ticketsPerBox,
}: {
  title: string;
  description: string;
  coverImageUrl: string;
  pricePerDraw: number;
  boxCount: number;
  sessionMinutes: number;
  prizes: KujiPrize[];
  ticketsPerBox: number;
}) {
  const boxLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  return (
    <div className="bg-[#1a1a2e] text-white max-h-[calc(100vh-8rem)] overflow-y-auto text-xs">
      {/* Cover image */}
      {coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverImageUrl} alt="" className="w-full h-28 object-cover" />
      ) : (
        <div className="w-full h-28 bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
          <span className="text-3xl opacity-30">🎰</span>
        </div>
      )}

      {/* Campaign info */}
      <div className="px-3 py-3 space-y-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
            一番賞
          </span>
          <span className="text-[10px] text-slate-400">{pricePerDraw} 點/抽</span>
          <span className="text-[10px] text-slate-400">{sessionMinutes} 分鐘</span>
          <span className="text-[10px] text-slate-400">{boxCount} 盒</span>
        </div>
        <h3 className="font-bold text-sm leading-tight text-white/90">
          {title || "活動名稱"}
        </h3>
        {description && (
          <p className="text-[10px] leading-relaxed text-slate-400 line-clamp-2">{description}</p>
        )}
      </div>

      {/* Prize gallery */}
      {prizes.length > 0 && (
        <div className="px-3 pb-3">
          <div className="rounded-xl bg-white/5 p-2.5">
            <p className="text-[10px] font-bold text-slate-300 mb-2">賞品一覽</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {prizes.map((p) => (
                <div key={p.id} className="w-16 shrink-0">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/10 flex items-center justify-center">
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-br ${GRADE_COLORS[p.grade] ?? "from-slate-500 to-slate-600"} opacity-80`}>
                        <span className="text-lg">{GRADE_EMOJI[p.grade] ?? "🎁"}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-1">
                    {p.grade && (
                      <span className="inline-block px-1.5 py-0 rounded-full text-[8px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                        {p.grade}
                      </span>
                    )}
                    <p className="text-[9px] text-slate-300 line-clamp-1 mt-0.5 leading-tight">
                      {p.name || "未命名"}
                    </p>
                    <p className="text-[8px] text-slate-500">{p.quantity} 枚</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Box tabs */}
      {boxCount > 0 && ticketsPerBox > 0 && (
        <div className="px-3 pb-2">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {Array.from({ length: Math.min(boxCount, 6) }, (_, i) => (
              <button
                key={i}
                type="button"
                className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-all ${
                  i === 0
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm"
                    : "bg-white/5 text-slate-400"
                }`}
              >
                <span>籤盒 {boxLabels[i]}</span>
                <span className={`block text-[8px] mt-0.5 ${i === 0 ? "text-white/70" : "text-slate-500"}`}>
                  0/{ticketsPerBox} (0%)
                </span>
              </button>
            ))}
            {boxCount > 6 && (
              <span className="self-center text-[10px] text-slate-500 px-1">+{boxCount - 6}</span>
            )}
          </div>
        </div>
      )}

      {/* Ticket board preview */}
      {ticketsPerBox > 0 && (
        <div className="px-3 pb-3">
          <div className="rounded-xl bg-white/5 p-2.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-300">抽籤區</span>
              <span className="text-[8px] text-slate-500">{ticketsPerBox}/{ticketsPerBox} 張可抽</span>
            </div>
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${Math.min(10, Math.ceil(Math.sqrt(ticketsPerBox * 1.2)))}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: Math.min(ticketsPerBox, 80) }, (_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded bg-amber-500/15 flex items-center justify-center"
                >
                  <span className="text-[7px] text-amber-400/60 tabular-nums">{i + 1}</span>
                </div>
              ))}
              {ticketsPerBox > 80 && (
                <div className="col-span-full text-center text-[8px] text-slate-500 py-1">
                  +{ticketsPerBox - 80} 張...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom action bar */}
      <div className="sticky bottom-0 bg-[#1a1a2e]/95 backdrop-blur border-t border-white/5 px-3 py-2.5 flex items-center justify-between">
        <div>
          <p className="text-[8px] text-slate-500">持有點數</p>
          <p className="text-xs font-bold text-white">10,000 點</p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1.5 text-[10px] font-bold text-white shadow-md"
        >
          加入排隊
        </button>
      </div>
    </div>
  );
}

export default function CampaignCreatePage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500">載入中...</div>}>
      <CampaignCreateInner />
    </Suspense>
  );
}
