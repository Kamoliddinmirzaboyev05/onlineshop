/**
 * Shimmer skeletons. The base `Skeleton` is a shimmering block; the named
 * variants mirror each page's real layout so the cold-load → data swap has no
 * jump. Shown only when `useResource` reports a cold load (no cache).
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`af-skel rounded-lg ${className}`} aria-hidden />;
}

function CardSkeleton({ children }: { children: React.ReactNode }) {
  return <div className="card p-4">{children}</div>;
}

export function DashboardSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <CardSkeleton>
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-10" />
          </div>
        </div>
      </CardSkeleton>

      <div>
        <Skeleton className="h-3 w-16 mb-2" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i}>
              <div className="space-y-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-3 w-14" />
              </div>
            </CardSkeleton>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <CardSkeleton key={i}>
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-6 w-24 mb-1.5" />
            <Skeleton className="h-3 w-20" />
          </CardSkeleton>
        ))}
      </div>

      <CardSkeleton>
        <Skeleton className="h-3 w-24 mb-3" />
        <div className="flex items-end justify-between gap-1.5 h-28">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-t-md"
              // staggered heights so it reads as a chart
            />
          ))}
        </div>
      </CardSkeleton>
    </div>
  );
}

export function OrderCardSkeleton() {
  return (
    <CardSkeleton>
      <div className="flex justify-between items-start mb-3">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="space-y-2 mb-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="flex gap-1.5 mb-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-10 rounded-lg" />
        ))}
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1 rounded-xl" />
        <Skeleton className="h-9 flex-1 rounded-xl" />
      </div>
    </CardSkeleton>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <OrderCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function HistorySkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i}>
          <div className="flex justify-between items-start mb-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-3 w-24" />
        </CardSkeleton>
      ))}
    </div>
  );
}

export function EarningsSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <div className="card p-5 bg-brand/90">
        <Skeleton className="h-4 w-28 mb-2 !bg-white/30" />
        <Skeleton className="h-8 w-44 mb-2 !bg-white/30" />
        <Skeleton className="h-4 w-36 !bg-white/30" />
      </div>
      <div className="card divide-y divide-slate-100">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function OrderDetailSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 max-w-md mx-auto">
      <Skeleton className="h-4 w-20 mb-4" />
      <Skeleton className="h-7 w-48 mb-1.5" />
      <Skeleton className="h-4 w-32 mb-4" />
      <CardSkeleton>
        <div className="space-y-2.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-10 w-full rounded-xl mt-1" />
        </div>
      </CardSkeleton>
      <div className="h-3" />
      <CardSkeleton>
        <Skeleton className="h-4 w-28 mb-3" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </CardSkeleton>
    </div>
  );
}
