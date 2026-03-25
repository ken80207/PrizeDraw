interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; dot: string }
> = {
  OPEN: {
    label: "未回覆",
    className: "bg-red-100 text-red-700",
    dot: "bg-red-500",
  },
  IN_PROGRESS: {
    label: "處理中",
    className: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
  },
  RESOLVED: {
    label: "已解決",
    className: "bg-green-100 text-green-700",
    dot: "bg-green-500",
  },
  CLOSED: {
    label: "已關閉",
    className: "bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
  },
  PENDING: {
    label: "待處理",
    className: "bg-blue-100 text-blue-700",
    dot: "bg-blue-500",
  },
};

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: "bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
  };

  const padding = size === "md" ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${padding} ${config.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
