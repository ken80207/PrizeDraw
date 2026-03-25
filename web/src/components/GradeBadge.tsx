interface GradeBadgeProps {
  grade: string;
  className?: string;
}

const GRADE_STYLES: Record<string, string> = {
  A賞: "bg-red-500 text-white",
  B賞: "bg-orange-500 text-white",
  C賞: "bg-blue-500 text-white",
  D賞: "bg-green-500 text-white",
  E賞: "bg-purple-500 text-white",
  F賞: "bg-pink-500 text-white",
  Last賞: "bg-gradient-to-r from-amber-400 to-yellow-500 text-white",
  LAST賞: "bg-gradient-to-r from-amber-400 to-yellow-500 text-white",
};

const DEFAULT_GRADE_STYLE = "bg-gray-500 text-white";

export function GradeBadge({ grade, className = "" }: GradeBadgeProps) {
  const style = GRADE_STYLES[grade] ?? DEFAULT_GRADE_STYLE;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold tracking-wide ${style} ${className}`}
    >
      {grade}
    </span>
  );
}
