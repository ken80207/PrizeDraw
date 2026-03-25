"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/services/apiClient";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

interface Campaign {
  id: string;
  title: string;
  type: "KUJI" | "UNLIMITED";
  pricePerDraw: number;
  status: string;
  createdAt: string;
}

type TabFilter = "ALL" | "KUJI" | "UNLIMITED";

const STATUS_OPTIONS = [
  { value: "", label: "全部狀態" },
  { value: "ACTIVE", label: "開放中" },
  { value: "DRAFT", label: "草稿" },
  { value: "INACTIVE", label: "已停售" },
  { value: "SOLD_OUT", label: "已售罄" },
];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tab, setTab] = useState<TabFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    apiClient
      .get<Campaign[]>("/api/v1/admin/campaigns?limit=100")
      .then((data) => {
        setCampaigns(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "載入失敗");
        setIsLoading(false);
      });
  }, []);

  const filtered = campaigns.filter((c) => {
    if (tab !== "ALL" && c.type !== tab) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleStatusToggle = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await apiClient.patch(`/api/v1/admin/campaigns/${id}/status`, { status: newStatus });
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失敗");
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">活動管理</h1>
          <p className="text-sm text-slate-500">管理所有一番賞與無限賞活動</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/campaigns/create?type=kuji"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            <span>+</span> 建立一番賞
          </Link>
          <Link
            href="/campaigns/create?type=unlimited"
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            <span>+</span> 建立無限賞
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {(["ALL", "KUJI", "UNLIMITED"] as TabFilter[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "ALL" ? "全部" : t === "KUJI" ? "一番賞" : "無限賞"}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="搜尋活動名稱..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <LoadingSkeleton rows={5} columns={6} />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="🎰" title="沒有符合條件的活動" description="嘗試調整篩選條件或建立新活動" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["ID", "名稱", "類型", "每抽價格", "狀態", "建立日期", "操作"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c, idx) => (
                <tr
                  key={c.id}
                  className={`${idx % 2 === 1 ? "bg-slate-50/50" : "bg-white"} hover:bg-indigo-50/30 transition-colors`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {c.id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    <Link href={`/campaigns/${c.id}`} className="hover:text-indigo-600 hover:underline">
                      {c.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={c.type}
                      label={c.type === "KUJI" ? "一番賞" : "無限賞"}
                    />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{c.pricePerDraw} 點</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString("zh-TW") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="rounded px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 border border-indigo-200 transition-colors"
                      >
                        編輯
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleStatusToggle(c.id, c.status)}
                        className={`rounded px-2.5 py-1 text-xs font-medium transition-colors border ${
                          c.status === "ACTIVE"
                            ? "border-red-200 text-red-600 hover:bg-red-50"
                            : "border-green-200 text-green-600 hover:bg-green-50"
                        }`}
                      >
                        {c.status === "ACTIVE" ? "停售" : "上架"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
