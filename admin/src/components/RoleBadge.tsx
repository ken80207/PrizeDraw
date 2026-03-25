import { ROLE_LABELS, type StaffRole } from "@/lib/roles";

const ROLE_COLORS: Record<StaffRole, string> = {
  OWNER: "bg-purple-100 text-purple-800 ring-purple-300/60",
  ADMIN: "bg-red-100 text-red-800 ring-red-300/60",
  OPERATOR: "bg-blue-100 text-blue-800 ring-blue-300/60",
  CUSTOMER_SERVICE: "bg-slate-100 text-slate-700 ring-slate-300/60",
};

const ROLE_DOTS: Record<StaffRole, string> = {
  OWNER: "bg-purple-500",
  ADMIN: "bg-red-500",
  OPERATOR: "bg-blue-500",
  CUSTOMER_SERVICE: "bg-slate-400",
};

interface RoleBadgeProps {
  role: StaffRole;
  size?: "sm" | "md";
}

export function RoleBadge({ role, size = "md" }: RoleBadgeProps) {
  const label = ROLE_LABELS[role] ?? role;
  const colorCls = ROLE_COLORS[role] ?? "bg-slate-100 text-slate-700 ring-slate-300/60";
  const dotCls = ROLE_DOTS[role] ?? "bg-slate-400";

  const sizeCls = size === "sm"
    ? "px-1.5 py-0.5 text-xs gap-1"
    : "px-2.5 py-1 text-xs gap-1.5";

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ring-1 ring-inset ${colorCls} ${sizeCls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dotCls}`} />
      {label}
    </span>
  );
}
