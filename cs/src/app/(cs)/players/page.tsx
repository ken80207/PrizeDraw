"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { apiClient } from "@/services/apiClient";

interface PlayerSummary {
  id: string;
  nickname: string;
  phone?: string;
  email?: string;
  drawPoints: number;
  revenuePoints: number;
  accountStatus: string;
  registeredAt: string;
}

interface PlayerSearchResponse {
  players: PlayerSummary[];
  total: number;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "正常", className: "bg-green-100 text-green-700" },
  SUSPENDED: { label: "停權", className: "bg-red-100 text-red-700" },
  PENDING_VERIFICATION: {
    label: "待驗證",
    className: "bg-amber-100 text-amber-700",
  },
  BANNED: { label: "封禁", className: "bg-red-200 text-red-800" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function PlayersPage() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<"nickname" | "phone" | "id">(
    "nickname",
  );
  const [results, setResults] = useState<PlayerSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim()) return;

      setIsLoading(true);
      setError(null);
      setHasSearched(true);

      const params = new URLSearchParams({
        [searchType]: query.trim(),
        limit: "50",
      });

      try {
        // TODO: No CS player search endpoint in api-contracts.
        // Using /api/v1/admin/players/search until a dedicated endpoint is added.
        const data = await apiClient.get<PlayerSearchResponse>(
          `/api/v1/admin/players/search?${params.toString()}`,
        );
        setResults(data.players ?? []);
        setTotal(data.total ?? 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "搜尋失敗");
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [query, searchType],
  );

  return (
    <div className="p-5">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">玩家查詢</h1>
        <p className="text-sm text-slate-500">依暱稱、手機號碼或玩家 ID 搜尋</p>
      </div>

      {/* Search form */}
      <form
        onSubmit={handleSearch}
        className="mb-6 flex gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <select
          value={searchType}
          onChange={(e) =>
            setSearchType(e.target.value as "nickname" | "phone" | "id")
          }
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="nickname">暱稱</option>
          <option value="phone">手機號碼</option>
          <option value="id">玩家 ID</option>
        </select>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            searchType === "nickname"
              ? "輸入玩家暱稱..."
              : searchType === "phone"
                ? "輸入手機號碼..."
                : "輸入玩家 ID..."
          }
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
              搜尋中
            </>
          ) : (
            <>
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              搜尋
            </>
          )}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {hasSearched && !isLoading && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {results.length === 0
                ? "找不到符合的玩家"
                : `找到 ${total} 位玩家`}
            </p>
          </div>

          {results.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      玩家 ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      暱稱
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      手機號碼
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      消費點數
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      收益點數
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                      帳戶狀態
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      註冊日期
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((player) => {
                    const statusConfig =
                      STATUS_LABELS[player.accountStatus] ?? {
                        label: player.accountStatus,
                        className: "bg-slate-100 text-slate-600",
                      };
                    return (
                      <tr
                        key={player.id}
                        className="transition-colors hover:bg-slate-50"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                          {player.id.slice(0, 8)}...
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                              {player.nickname.charAt(0)}
                            </div>
                            <span className="text-sm font-medium text-slate-800">
                              {player.nickname}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {player.phone ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-slate-800">
                          {player.drawPoints.toLocaleString("zh-TW")}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-slate-800">
                          {player.revenuePoints.toLocaleString("zh-TW")}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.className}`}
                          >
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {formatDate(player.registeredAt)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Link
                            href={`/players/${player.id}`}
                            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100"
                          >
                            查看詳情
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Initial state */}
      {!hasSearched && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <span className="text-5xl">🔍</span>
          <p className="mt-4 text-base font-medium">搜尋玩家</p>
          <p className="mt-1 text-sm">輸入暱稱、手機號碼或玩家 ID 開始搜尋</p>
        </div>
      )}
    </div>
  );
}
