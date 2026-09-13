import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-brand-soft", className)}
    />
  );
}

/** Skeleton shaped like the complaint/task list cards used across the app. */
export function CardListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-surface p-4 shadow-card"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="w-full space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-5 w-20 shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}
