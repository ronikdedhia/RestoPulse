'use client';

const ICONS: Record<string, string> = {
  families: '👨‍👩‍👧',
  couples: '💑',
  office: '💼',
  groups: '🎉',
  solo: '🏃',
};

interface Segment {
  key: string;
  label: string;
  mentionCount: number;
  avgRating: number;
  positiveRate: number | null;
  positiveCount: number;
  negativeCount: number;
}

function ratingColor(r: number) {
  return r >= 4 ? 'text-emerald-400' : r >= 3 ? 'text-amber-400' : 'text-red-400';
}

export function CustomerSegmentCard({ segments }: { segments: Segment[] }) {
  if (segments.length === 0) return null;

  return (
    <div className="glass-card p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-white/80">Customer Segments</p>
        <p className="text-xs text-white/40">Identified from review text · last 60 days</p>
      </div>

      <div className="space-y-3">
        {segments.map((seg) => (
          <div key={seg.key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{ICONS[seg.key] ?? '👤'}</span>
                <span className="text-sm font-medium text-white/70">{seg.label}</span>
                <span className="text-xs text-white/30">{seg.mentionCount} mentions</span>
              </div>
              <div className="flex items-center gap-2">
                {seg.positiveRate !== null && (
                  <span className="text-xs text-white/40">{seg.positiveRate}% positive</span>
                )}
                <span className={`text-sm font-bold ${ratingColor(seg.avgRating)}`}>
                  {seg.avgRating}★
                </span>
              </div>
            </div>

            {seg.positiveRate !== null && (
              <div className="flex h-1.5 rounded-full overflow-hidden bg-white/10 gap-px">
                <div className="bg-emerald-500/60" style={{ width: `${seg.positiveRate}%` }} />
                {seg.negativeCount > 0 && (
                  <div
                    className="bg-red-500/60"
                    style={{ width: `${Math.round((seg.negativeCount / (seg.positiveCount + seg.negativeCount)) * (100 - seg.positiveRate))}%` }}
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
