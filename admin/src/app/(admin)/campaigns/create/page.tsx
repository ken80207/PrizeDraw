"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/services/apiClient";
import { ImageUpload } from "@/components/ImageUpload";

type CampaignType = "kuji" | "unlimited";

interface ProbabilityRow {
  id: string;
  grade: string;
  name: string;
  probability: number;
  photoUrl: string;
}

interface TicketRange {
  id: string;
  grade: string;
  prizeName: string;
  rangeStart: number;
  rangeEnd: number;
}

interface TicketBox {
  id: string;
  label: string;
  ticketCount: number;
  ranges: TicketRange[];
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

  // Kuji state
  const [boxes, setBoxes] = useState<TicketBox[]>([
    { id: genId(), label: "籤盒 A", ticketCount: 80, ranges: [] },
  ]);

  // Unlimited state
  const [probRows, setProbRows] = useState<ProbabilityRow[]>([
    { id: genId(), grade: "A賞", name: "", probability: 0.5, photoUrl: "" },
    { id: genId(), grade: "B賞", name: "", probability: 2.0, photoUrl: "" },
    { id: genId(), grade: "C賞", name: "", probability: 10, photoUrl: "" },
    { id: genId(), grade: "D賞", name: "", probability: 87.5, photoUrl: "" },
  ]);

  const totalProb = probRows.reduce((s, r) => s + r.probability, 0);
  const probValid = Math.abs(totalProb - 100) < 0.01;

  const addBox = () => {
    const labels = ["A", "B", "C", "D", "E", "F"];
    const idx = boxes.length;
    setBoxes((prev) => [
      ...prev,
      { id: genId(), label: `籤盒 ${labels[idx] ?? idx + 1}`, ticketCount: 80, ranges: [] },
    ]);
  };

  const removeBox = (boxId: string) => {
    setBoxes((prev) => prev.filter((b) => b.id !== boxId));
  };

  const updateBox = (boxId: string, field: keyof TicketBox, value: unknown) => {
    setBoxes((prev) =>
      prev.map((b) => (b.id === boxId ? { ...b, [field]: value } : b)),
    );
  };

  const addRange = (boxId: string) => {
    const newRange: TicketRange = {
      id: genId(),
      grade: "",
      prizeName: "",
      rangeStart: 1,
      rangeEnd: 10,
    };
    setBoxes((prev) =>
      prev.map((b) =>
        b.id === boxId ? { ...b, ranges: [...b.ranges, newRange] } : b,
      ),
    );
  };

  const updateRange = (boxId: string, rangeId: string, field: keyof TicketRange, value: unknown) => {
    setBoxes((prev) =>
      prev.map((b) =>
        b.id === boxId
          ? {
              ...b,
              ranges: b.ranges.map((r) =>
                r.id === rangeId ? { ...r, [field]: value } : r,
              ),
            }
          : b,
      ),
    );
  };

  const removeRange = (boxId: string, rangeId: string) => {
    setBoxes((prev) =>
      prev.map((b) =>
        b.id === boxId
          ? { ...b, ranges: b.ranges.filter((r) => r.id !== rangeId) }
          : b,
      ),
    );
  };

  const updateProbRow = (id: string, field: keyof ProbabilityRow, value: unknown) => {
    setProbRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addProbRow = () => {
    setProbRows((prev) => [
      ...prev,
      { id: genId(), grade: `${String.fromCharCode(65 + prev.length)}賞`, name: "", probability: 0, photoUrl: "" },
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
        const body = {
          title: name,
          description,
          coverImageUrl: coverImageUrl || undefined,
          pricePerDraw: price,
          drawSessionSeconds: sessionMinutes * 60,
          boxes: boxes.map((b) => ({
            name: b.label,
            totalTickets: b.ticketCount,
            ticketRanges: b.ranges.map((r) => ({
              grade: r.grade,
              prizeName: r.prizeName,
              rangeStart: r.rangeStart,
              rangeEnd: r.rangeEnd,
            })),
          })),
        };
        await apiClient.post("/api/v1/admin/campaigns/kuji", body);
      } else {
        const body = {
          title: name,
          description,
          coverImageUrl: coverImageUrl || undefined,
          pricePerDraw: price,
          prizePool: probRows.map((r) => ({
            grade: r.grade,
            name: r.name,
            probability: r.probability / 100,
            photoUrl: r.photoUrl || undefined,
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

  const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";
  const labelCls = "mb-1 block text-sm font-medium text-slate-700";

  return (
    <div className="space-y-6 max-w-3xl">
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
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
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

      {/* Kuji: Ticket boxes */}
      {type === "kuji" && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">籤盒管理</h2>
            <button
              type="button"
              onClick={addBox}
              className="rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
            >
              + 新增籤盒
            </button>
          </div>

          <div className="space-y-4">
            {boxes.map((box) => (
              <div key={box.id} className="rounded-lg border border-slate-200 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                    value={box.label}
                    onChange={(e) => updateBox(box.id, "label", e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">籤數:</label>
                    <input
                      type="number"
                      className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                      value={box.ticketCount}
                      onChange={(e) => updateBox(box.id, "ticketCount", Number(e.target.value))}
                      min={1}
                    />
                  </div>
                  {boxes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBox(box.id)}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Ranges */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500">賞品範圍</p>
                  {box.ranges.map((range) => (
                    <div key={range.id} className="flex items-center gap-2 text-sm">
                      <span className="text-slate-400 text-xs">#</span>
                      <input
                        type="number"
                        className="w-16 rounded border border-slate-300 px-2 py-1 text-xs"
                        value={range.rangeStart}
                        onChange={(e) => updateRange(box.id, range.id, "rangeStart", Number(e.target.value))}
                        min={1}
                      />
                      <span className="text-slate-400">—</span>
                      <input
                        type="number"
                        className="w-16 rounded border border-slate-300 px-2 py-1 text-xs"
                        value={range.rangeEnd}
                        onChange={(e) => updateRange(box.id, range.id, "rangeEnd", Number(e.target.value))}
                        min={1}
                      />
                      <input
                        className="w-16 rounded border border-slate-300 px-2 py-1 text-xs"
                        placeholder="等級"
                        value={range.grade}
                        onChange={(e) => updateRange(box.id, range.id, "grade", e.target.value)}
                      />
                      <input
                        className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                        placeholder="賞品名稱"
                        value={range.prizeName}
                        onChange={(e) => updateRange(box.id, range.id, "prizeName", e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeRange(box.id, range.id)}
                        className="text-slate-400 hover:text-red-500 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addRange(box.id)}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    + 新增範圍
                  </button>
                </div>
              </div>
            ))}
          </div>
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
          disabled={isSubmitting || (type === "unlimited" && !probValid) || !name}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSubmitting ? "儲存中..." : "儲存並上架"}
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
