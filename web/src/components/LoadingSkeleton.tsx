interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-surface-container-high ${className}`}
    />
  );
}

export function CampaignCardSkeleton() {
  return (
    <div className="rounded-lg overflow-hidden bg-surface-container">
      <Skeleton className="w-full h-64 rounded-none" />
      <div className="p-6 space-y-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-7 w-1/3" />
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/6" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function PrizeCardSkeleton() {
  return (
    <div className="rounded-lg overflow-hidden bg-surface-container">
      <Skeleton className="w-full h-40 rounded-none" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-1/3 rounded-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function ListItemSkeleton() {
  return (
    <div className="rounded-lg bg-surface-container p-4 space-y-2">
      <div className="flex justify-between items-center">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-1/4" />
    </div>
  );
}
