"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/services/apiClient";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

interface Player {
  id: string;
  nickname: string;
  phoneNumber: string | null;
  drawPointsBalance: string | number;
  revenuePointsBalance: string | number;
  isActive: string | boolean;
  createdAt: string;
}

interface PlayerListResponse {
  players: Player[];
  total: number;
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchPlayers = async (q: string) => {
    setIsLoading(true);
    setError(null);
    const url = q
      ? `/api/v1/admin/players?search=${encodeURIComponent(q)}&limit=50`
      : "/api/v1/admin/players?limit=50";
    try {
      const data = await apiClient.get<PlayerListResponse | Player[]>(url);
      if (Array.isArray(data)) {
        setPlayers(data);
        setTotal(data.length);
      } else {
        setPlayers(data.players);
        setTotal(data.total);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers("");
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    fetchPlayers(searchInput);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">玩家管理</h1>
        <p className="text-sm text-slate-500">搜尋與管理玩家帳戶</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="搜尋暱稱、手機號碼或 ID..."
          className="flex-1 max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          搜尋
        </button>
        {search && (
          <button
            type="button"
            onClick={() => { setSearchInput(""); setSearch(""); fetchPlayers(""); }}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            清除
          </button>
        )}
      </form>

      {search && (
        <p className="text-sm text-slate-500">
          搜尋「{search}」，共 {total} 筆結果
        </p>
      )}

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <LoadingSkeleton rows={5} columns={6} />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : players.length === 0 ? (
        <EmptyState icon="👥" title="找不到玩家" description="嘗試不同的搜尋條件" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["ID", "暱稱", "手機", "消費點數", "收益點數", "狀態", "加入日期", "操作"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {players.map((player, idx) => (
                <tr
                  key={player.id}
                  className={`${idx % 2 === 1 ? "bg-slate-50/50" : "bg-white"} hover:bg-indigo-50/30 transition-colors`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{player.id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    <Link href={`/players/${player.id}`} className="hover:text-indigo-600 hover:underline">
                      {player.nickname}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{player.phoneNumber ?? "-"}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{Number(player.drawPointsBalance).toLocaleString()}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{Number(player.revenuePointsBalance).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={String(player.isActive) === "true" ? "啟用" : "停用"} />
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {player.createdAt ? new Date(player.createdAt).toLocaleDateString("zh-TW") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/players/${player.id}`}
                      className="rounded px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 border border-indigo-200"
                    >
                      詳情
                    </Link>
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
