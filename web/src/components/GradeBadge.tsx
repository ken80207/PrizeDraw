interface GradeBadgeProps {
  grade: string;
  className?: string;
  "data-testid"?: string;
}

const GRADE_STYLES: Record<string, string> = {
  A賞: "bg-gradient-to-r from-primary to-primary-container text-on-primary",
  B賞: "bg-gradient-to-r from-primary to-primary-container text-on-primary",
  C賞: "bg-gradient-to-r from-primary to-primary-container text-on-primary",
  D賞: "bg-gradient-to-r from-primary to-primary-container text-on-primary",
  E賞: "bg-gradient-to-r from-primary to-primary-container text-on-primary",
  F賞: "bg-gradient-to-r from-primary to-primary-container text-on-primary",
  Last賞: "bg-gradient-to-r from-primary to-primary-container text-on-primary",
  LAST賞: "bg-gradient-to-r from-primary to-primary-container text-on-primary",
};

const DEFAULT_GRADE_STYLE =
  "bg-gradient-to-r from-primary to-primary-container text-on-primary";

export function GradeBadge({ grade, className = "", "data-testid": testId }: GradeBadgeProps) {
  const style = GRADE_STYLES[grade] ?? DEFAULT_GRADE_STYLE;
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold font-label tracking-wide shadow-sm ${style} ${className}`}
    >
      {grade}
    </span>
  );
}
