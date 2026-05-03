'use client';

import { useState } from 'react';

interface FlaggedReview {
  id: string;
  authenticityScore: number;
  flags: string[];
  review: {
    rating: number;
    text: string | null;
    reviewDate: string | null;
    reviewerName: string | null;
    source: string;
  };
}

interface Summary {
  total: number;
  suspiciousCount: number;
  suspiciousRate: number;
}

const FLAG_LABELS: Record<string, string> = {
  no_text: 'No text',
  very_short_text: 'Very short',
  short_text: 'Short text',
  rating_text_mismatch_high: '5★ but negative text',
  rating_text_mismatch_low: '1★ but positive text',
  generic_positive: 'Generic praise',
  no_reviewer_name: 'Anonymous',
  burst_timing: 'Burst timing',
};

export function FakeReviewPanel({ suspicious, summary }: { suspicious: FlaggedReview[]; summary: Summary }) {
  const [expanded, setExpanded] = useState(false);

  if (summary.total === 0) return null;

  const rate = (summary.suspiciousRate * 100).toFixed(1);
  const severity =
    summary.suspiciousRate >= 0.3 ? 'text-red-400'
    : summary.suspiciousRate >= 0.15 ? 'text-amber-400'
    : 'text-emerald-400';

  return (
    <div className="space-y-3">
      <div className="glass-card flex items-center gap-6 p-4">
        <div>
          <div className={`text-2xl font-bold ${severity}`}>{summary.suspiciousCount}</div>
          <div className="text-xs text-white/40">Suspicious reviews</div>
        </div>
        <div>
          <div className={`text-2xl font-bold ${severity}`}>{rate}%</div>
          <div className="text-xs text-white/40">of {summary.total} scored</div>
        </div>
        {suspicious.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-auto text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {expanded ? 'Hide' : 'Show'} flagged reviews
          </button>
        )}
      </div>

      {expanded && suspicious.length > 0 && (
        <div className="space-y-2">
          {suspicious.map((s) => (
            <div key={s.id} className="glass-card p-3 space-y-2 border-l-2 border-l-red-500/50">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-white/80">{s.review.reviewerName ?? 'Anonymous'}</span>
                  <span className="text-xs text-white/40">{s.review.rating}★</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded text-[10px] font-medium ${s.review.source === 'google_maps' || s.review.source === 'google' ? 'bg-blue-500/15 text-blue-400' : 'bg-orange-500/15 text-orange-400'}`}>
                    {s.review.source === 'google_maps' ? 'Google' : s.review.source === 'zomato' ? 'Zomato' : s.review.source}
                  </span>
                  {s.review.reviewDate && (
                    <span className="text-xs text-white/30">
                      {new Date(s.review.reviewDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
                <span className="text-xs text-red-400 font-medium">
                  Auth: {(s.authenticityScore * 100).toFixed(0)}%
                </span>
              </div>

              {s.review.text && (
                <p className="text-xs text-white/50 line-clamp-2">{s.review.text}</p>
              )}

              <div className="flex flex-wrap gap-1">
                {s.flags.map((flag) => (
                  <span key={flag} className="text-xs px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded">
                    {FLAG_LABELS[flag] ?? flag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
