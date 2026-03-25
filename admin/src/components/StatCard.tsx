"use client";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: string; positive: boolean };
  icon?: string;
  color?: "indigo" | "green" | "yellow" | "red" | "blue";
}

const COLOR_CLASSES = {
  indigo: "bg-indigo-50 text-indigo-600",
  green: "bg-green-50 text-green-600",
  yellow: "bg-yellow-50 text-yellow-600",
  red: "bg-red-50 text-red-600",
  blue: "bg-blue-50 text-blue-600",
};

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  color = "indigo",
}: StatCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-500 truncate">{title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          )}
          {trend && (
            <p
              className={`mt-1 text-xs font-medium ${
                trend.positive ? "text-green-600" : "text-red-600"
              }`}
            >
              {trend.positive ? "↑" : "↓"} {trend.value}
            </p>
          )}
        </div>
        {icon && (
          <div
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-xl ${COLOR_CLASSES[color]}`}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
