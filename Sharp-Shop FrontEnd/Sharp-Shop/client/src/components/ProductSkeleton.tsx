import { Skeleton } from "@/components/ui/skeleton";

export function ProductSkeleton() {
  return (
    <div
      data-testid="skeleton-product-card"
      className="h-full w-full snap-start snap-always relative flex flex-col justify-end overflow-hidden flex-shrink-0"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-800 via-neutral-700 to-neutral-900 animate-pulse" />
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      <div className="relative z-10 p-6 pb-8 space-y-4">
        <Skeleton className="h-8 w-3/4 bg-white/10" />
        
        <Skeleton className="h-10 w-1/2 bg-white/10" />
        
        <Skeleton className="h-6 w-24 rounded-full bg-white/10" />
        
        <div className="space-y-2">
          <Skeleton className="h-4 w-full bg-white/10" />
          <Skeleton className="h-4 w-5/6 bg-white/10" />
        </div>

        <div className="flex items-center gap-3 pt-4">
          <Skeleton className="h-12 flex-1 bg-white/10" />
          <Skeleton className="h-12 w-12 bg-white/10" />
          <Skeleton className="h-12 w-12 bg-white/10" />
        </div>
      </div>
    </div>
  );
}
