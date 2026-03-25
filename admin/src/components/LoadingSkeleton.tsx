"use client";

interface LoadingSkeletonProps {
  rows?: number;
  columns?: number;
}

export function LoadingSkeleton({ rows = 5, columns = 4 }: LoadingSkeletonProps) {
  return (
    <div className="animate-pulse">
      <div className="mb-4 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-4 flex-1 rounded bg-slate-200" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="mb-3 flex gap-4">
          {Array.from({ length: columns }).map((_, j) => (
            <div
              key={j}
              className="h-4 flex-1 rounded bg-slate-100"
              style={{ opacity: 1 - i * 0.15 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-2 h-4 w-24 rounded bg-slate-200" />
      <div className="h-8 w-32 rounded bg-slate-200" />
      <div className="mt-2 h-3 w-16 rounded bg-slate-100" />
    </div>
  );
}
