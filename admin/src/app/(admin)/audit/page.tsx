"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/services/apiClient";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

interface AuditLog {
  id: string;
  actorType: "STAFF" | "SYSTEM";
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeValue?: Record<string, unknown>;
  afterValue?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

const ACTOR_TYPES = [
  { value: "", label: "全部操作者" },
  { value: "STAFF", label: "人員" },
  { value: "SYSTEM", label: "系統" },
];

const ENTITY_TYPES = [
  { value: "", label: "全部類型" },
  { value: "CAMPAIGN", label: "活動" },
  { value: "PLAYER", label: "玩家" },
  { value: "WITHDRAWAL", label: "提領" },
  { value: "SHIPPING", label: "出貨" },
  { value: "STAFF", label: "人員" },
  { value: "COUPON", label: "優惠券" },
  { value: "PRIZE", label: "賞品" },
  { value: "FEATURE_FLAG", label: "功能旗標" },
];

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [actorType, setActorType] = useState("");
  const [entityType, setEntityType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const fetchLogs = async () => {
    setIsLoading(true);
    let url = "/api/v1/admin/audit?limit=100";
    if (actorType) url += `&actorType=${actorType}`;
    if (entityType) url += `&entityType=${entityType}`;
    if (dateFrom) url += `&from=${dateFrom}`;
    if (dateTo) url += `&to=${dateTo}`;
    try {
      const data = await apiClient.get<AuditLog[]>(url);
      const filtered = actionFilter
        ? data.filter((l) => l.action.toLowerCase().includes(actionFilter.toLowerCase()))
        : data;
      setLogs(filtered);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [actorType, entityType, dateFrom, dateTo]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => prev === id ? null : id);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">稽核紀錄</h1>
        <p className="text-sm text-slate-500">追蹤所有後台操作歷程</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={actorType}
          onChange={(e) => setActorType(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        >
          {ACTOR_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        >
          {ENTITY_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input
          type="text"
          placeholder="搜尋操作..."
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none w-36"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <span className="flex items-center text-slate-400">~</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={fetchLogs}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          套用
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <LoadingSkeleton rows={6} columns={5} />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : logs.length === 0 ? (
        <EmptyState icon="📋" title="沒有稽核紀錄" description="調整篩選條件以查看更多紀錄" />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["時間", "操作者", "操作", "物件類型", "物件 ID", "IP", "詳情"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log, idx) => (
                <>
                  <tr
                    key={log.id}
                    className={`${idx % 2 === 1 ? "bg-slate-50/50" : "bg-white"} hover:bg-indigo-50/30 cursor-pointer transition-colors`}
                    onClick={() => toggleExpand(log.id)}
                  >
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("zh-TW")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-800 font-medium text-xs">{log.actorName}</div>
                      <div className="text-slate-400 text-xs">{log.actorType === "STAFF" ? "人員" : "系統"}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{log.action}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{log.entityType}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {log.entityId ? log.entityId.slice(0, 8) + "…" : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{log.ipAddress ?? "—"}</td>
                    <td className="px-4 py-3">
                      {(log.beforeValue ?? log.afterValue) && (
                        <button
                          type="button"
                          className="text-xs text-indigo-600 hover:underline"
                          onClick={(e) => { e.stopPropagation(); toggleExpand(log.id); }}
                        >
                          {expandedId === log.id ? "收起" : "展開"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === log.id && (log.beforeValue ?? log.afterValue) && (
                    <tr key={`${log.id}-expand`} className="bg-slate-50">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="grid grid-cols-2 gap-4">
                          {log.beforeValue && (
                            <div>
                              <p className="text-xs font-semibold text-red-600 mb-1">變更前</p>
                              <pre className="rounded bg-red-50 p-2 text-xs text-red-800 overflow-auto max-h-32">
                                {JSON.stringify(log.beforeValue, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.afterValue && (
                            <div>
                              <p className="text-xs font-semibold text-green-600 mb-1">變更後</p>
                              <pre className="rounded bg-green-50 p-2 text-xs text-green-800 overflow-auto max-h-32">
                                {JSON.stringify(log.afterValue, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
