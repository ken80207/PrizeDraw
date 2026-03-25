"use client";

export type BadgeVariant =
  | "active"
  | "inactive"
  | "pending"
  | "completed"
  | "draft"
  | "suspended"
  | "rejected"
  | "failed"
  | "shipped"
  | "delivered"
  | "open"
  | "resolved"
  | "processing"
  | string;

const VARIANT_CLASSES: Record<string, string> = {
  active: "bg-green-100 text-green-800 border-green-200",
  open: "bg-green-100 text-green-800 border-green-200",
  paid: "bg-green-100 text-green-800 border-green-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  resolved: "bg-green-100 text-green-800 border-green-200",
  approved: "bg-green-100 text-green-800 border-green-200",
  ACTIVE: "bg-green-100 text-green-800 border-green-200",
  DELIVERED: "bg-green-100 text-green-800 border-green-200",
  PAID: "bg-green-100 text-green-800 border-green-200",

  suspended: "bg-red-100 text-red-800 border-red-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  inactive: "bg-red-100 text-red-800 border-red-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
  SUSPENDED: "bg-red-100 text-red-800 border-red-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
  FAILED: "bg-red-100 text-red-800 border-red-200",
  CANCELLED: "bg-red-100 text-red-800 border-red-200",

  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  processing: "bg-yellow-100 text-yellow-800 border-yellow-200",
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  PENDING_SHIPMENT: "bg-yellow-100 text-yellow-800 border-yellow-200",
  PENDING_REVIEW: "bg-yellow-100 text-yellow-800 border-yellow-200",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800 border-yellow-200",

  completed: "bg-blue-100 text-blue-800 border-blue-200",
  shipped: "bg-blue-100 text-blue-800 border-blue-200",
  transferred: "bg-blue-100 text-blue-800 border-blue-200",
  COMPLETED: "bg-blue-100 text-blue-800 border-blue-200",
  SHIPPED: "bg-blue-100 text-blue-800 border-blue-200",
  TRANSFERRED: "bg-blue-100 text-blue-800 border-blue-200",

  draft: "bg-slate-100 text-slate-700 border-slate-200",
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  CLOSED: "bg-slate-100 text-slate-700 border-slate-200",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "開放中",
  INACTIVE: "已停用",
  DRAFT: "草稿",
  PENDING_SHIPMENT: "待出貨",
  SHIPPED: "已出貨",
  DELIVERED: "已送達",
  CANCELLED: "已取消",
  PENDING_REVIEW: "待審核",
  APPROVED: "已核准",
  REJECTED: "已拒絕",
  TRANSFERRED: "已轉帳",
  PENDING: "待處理",
  IN_PROGRESS: "處理中",
  RESOLVED: "已解決",
  CLOSED: "已關閉",
  SUSPENDED: "已凍結",
  COMPLETED: "已完成",
  PAID: "已付款",
  FAILED: "失敗",
  UNLIMITED: "無限賞",
  KUJI: "一番賞",
};

interface StatusBadgeProps {
  status: string;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const classes =
    VARIANT_CLASSES[status] ?? "bg-slate-100 text-slate-600 border-slate-200";
  const displayLabel = label ?? STATUS_LABELS[status] ?? status.replace(/_/g, " ");

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${classes}`}
    >
      {displayLabel}
    </span>
  );
}
