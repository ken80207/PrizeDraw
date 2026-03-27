interface StatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_STYLES: Record<string, string> = {
  // Campaign statuses
  開放中: "bg-primary/15 text-primary",
  已停售: "bg-surface-container-highest text-on-surface-variant",
  已售罄: "bg-error/15 text-error",
  草稿: "bg-tertiary/15 text-tertiary",
  // Prize statuses
  持有中: "bg-primary/15 text-primary",
  交易中: "bg-secondary/15 text-secondary",
  寄送中: "bg-tertiary/15 text-tertiary",
  已寄送: "bg-primary/15 text-primary",
  // Support ticket / Exchange statuses (shared)
  待回應: "bg-tertiary/15 text-tertiary",
  處理中: "bg-secondary/15 text-secondary",
  已解決: "bg-primary/15 text-primary",
  已關閉: "bg-surface-container-highest text-on-surface-variant",
  已接受: "bg-primary/15 text-primary",
  已拒絕: "bg-error/15 text-error",
  已取消: "bg-surface-container-highest text-on-surface-variant",
  反提案: "bg-secondary/15 text-secondary",
  // Campaign types
  一番賞: "bg-secondary/15 text-secondary",
  無限賞: "bg-primary/15 text-primary",
  // Shipping statuses
  待寄送: "bg-tertiary/15 text-tertiary",
  已寄出: "bg-secondary/15 text-secondary",
  已送達: "bg-primary/15 text-primary",
};

const DEFAULT_STYLE = "bg-surface-container-highest text-on-surface-variant";

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? DEFAULT_STYLE;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-label ${style} ${className}`}
    >
      {status}
    </span>
  );
}
