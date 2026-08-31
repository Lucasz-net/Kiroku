export const AnimeDetailsSkeleton = () => (
  <div className="relative min-h-screen bg-[var(--kr-surface-sunken)] font-sans overflow-hidden">
    <div className="relative z-10 container mx-auto p-4 md:p-8 pt-32 md:pt-36 max-w-[1350px]">

      {/* Hero panel skeleton */}
      <div className="bg-[var(--kr-glass-1)] mb-12 flex flex-col md:flex-row border border-[#FF3B3B]/10 rounded-2xl overflow-hidden animate-pulse">
        {/* Poster */}
        <div className="w-full md:w-[360px] bg-[var(--kr-surface-sunken)] p-5 flex justify-center items-center shrink-0">
          <div className="w-full aspect-[2/3] rounded-xl bg-[var(--kr-surface-2)]" />
        </div>
        {/* Info */}
        <div className="p-8 md:p-10 flex-1 flex flex-col gap-6">
          <div className="h-10 bg-[var(--kr-surface-2)] rounded-xl w-3/4" />
          <div className="flex gap-2">
            {[1,2,3].map(i => <div key={i} className="h-6 w-20 bg-[var(--kr-surface-2)] rounded-lg" />)}
          </div>
          <div className="grid grid-cols-5 gap-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-[var(--kr-surface-2)] rounded-xl" />)}
          </div>
          <div className="flex flex-col gap-2 mt-auto">
            <div className="h-4 bg-[var(--kr-surface-2)] rounded w-full" />
            <div className="h-4 bg-[var(--kr-surface-2)] rounded w-5/6" />
            <div className="h-4 bg-[var(--kr-surface-2)] rounded w-4/6" />
          </div>
        </div>
      </div>

      {/* Characters skeleton */}
      <div className="mb-12">
        <div className="h-8 bg-[var(--kr-surface-2)] rounded-lg w-40 mb-6 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[3/4] bg-[var(--kr-surface-2)] rounded-xl" />
              <div className="h-3 bg-[var(--kr-surface-2)] rounded mt-2 w-3/4" />
            </div>
          ))}
        </div>
      </div>

      {/* Trailer skeleton */}
      <div className="mb-12 animate-pulse">
        <div className="h-8 bg-[var(--kr-surface-2)] rounded-lg w-36 mb-6" />
        <div className="aspect-video bg-[var(--kr-surface-2)] rounded-2xl" />
      </div>

    </div>
  </div>
);
