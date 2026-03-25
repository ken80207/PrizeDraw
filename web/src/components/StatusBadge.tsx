interface StatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_STYLES: Record<string, string> = {
  // Campaign statuses
  開放中: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  已停售: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  已售罄: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
  草稿: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  // Prize statuses
  持有中: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400",
  交易中: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  寄送中: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  已寄送: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400",
  // Support ticket / Exchange statuses (shared)
  待回應: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  處理中: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  已解決: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  已關閉: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  已接受: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  已拒絕: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
  已取消: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  反提案: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  // Campaign types
  一番賞: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400",
  無限賞: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
};

const DEFAULT_STYLE =
  "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? DEFAULT_STYLE;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style} ${className}`}
    >
      {status}
    </span>
  );
}
