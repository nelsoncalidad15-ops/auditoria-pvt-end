import { cn } from "../../lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "box" | "circle" | "text";
}

export function Skeleton({ className, variant = "box" }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-slate-200 dark:bg-white/10",
        variant === "circle" ? "rounded-full" : "rounded-2xl",
        className
      )}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="premium-card p-8 bg-white dark:bg-white/5 border-white/5 space-y-4">
      <Skeleton className="h-10 w-10" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-32" />
      </div>
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="premium-card p-5 bg-white dark:bg-white/5 border-white/5 flex items-center gap-4">
          <Skeleton className="h-14 w-14 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
