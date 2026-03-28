"use client";

interface GradeBadgeProps {
  name: string;
  colorCode: string;
  bgColorCode: string;
  size?: "sm" | "md";
}

export function GradeBadge({ name, colorCode, bgColorCode, size = "md" }: GradeBadgeProps) {
  const sizeClasses = size === "sm" ? "text-xs px-1.5 py-0.5" : "text-sm px-2 py-1";
  return (
    <span
      className={`inline-block rounded ${sizeClasses} font-semibold`}
      style={{ color: colorCode, backgroundColor: bgColorCode }}
    >
      {name}
    </span>
  );
}
