'use client';

interface RedFlagReview {
  id: string;
  reviewerName: string | null;
  rating: number;
  text: string | null;
  redFlagWords: string | null;
  reviewDate: string | null;
  source: string;
}

export function RedFlagPanel({ reviews }: { reviews: RedFlagReview[] }) {
  if (reviews.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-md">
          {reviews.length} Critical Issue{reviews.length !== 1 ? 's' : ''}
        </span>
        <p className="text-xs text-white/40">Reviews flagged with health, safety, or fraud keywords requiring immediate attention.</p>
      </div>

      <div className="grid gap-3">
        {reviews.map((review) => {
          const keywords = (review.redFlagWords ?? '').split(', ').filter(Boolean);
          return (
            <div key={review.id} className="glass-card border-l-4 border-l-red-500 rounded-l-none p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-red-400">
                    {review.reviewerName ?? 'Anonymous'}
                  </span>
                  <span className="text-xs text-white/30">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                  <span className="text-xs text-white/20 capitalize">{review.source}</span>
                </div>
                {review.reviewDate && (
                  <span className="text-xs text-white/30">
                    {new Date(review.reviewDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>

              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((kw) => (
                    <span key={kw} className="text-[10px] font-medium px-2 py-0.5 bg-red-500/15 text-red-400 border border-red-500/20 rounded-full">
                      {kw}
                    </span>
                  ))}
                </div>
              )}

              {review.text && (
                <p className="text-xs text-white/50 line-clamp-3 leading-relaxed">
                  {review.text}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
