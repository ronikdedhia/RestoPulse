'use client';

interface SourceStats {
  avgRating: number;
  reviewCount: number;
  positiveRate: number;
}

interface DivergenceData {
  hasDivergence: boolean;
  google: SourceStats | null;
  zomato: SourceStats | null;
  ratingDiff: number;
  sentimentDiff: number;
  message: string | null;
}

function StatCol({ label, stats, highlight }: { label: string; stats: SourceStats; highlight: 'blue' | 'orange' }) {
  const color = highlight === 'blue' ? 'text-blue-400' : 'text-orange-400';
  const bg = highlight === 'blue' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-orange-500/10 border-orange-500/20';

  return (
    <div className={`flex-1 rounded-lg border p-3 space-y-2 ${bg}`}>
      <p className={`text-xs font-semibold ${color}`}>{label}</p>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-white/90">{stats.avgRating}★</span>
        <span className="text-xs text-white/40 mb-1">{stats.reviewCount} reviews</span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-white/40">
          <span>Positive sentiment</span>
          <span className="font-medium text-white/60">{Math.round(stats.positiveRate * 100)}%</span>
        </div>
        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className={highlight === 'blue' ? 'h-full bg-blue-500/60' : 'h-full bg-orange-500/60'}
            style={{ width: `${Math.round(stats.positiveRate * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function SourceDivergenceCard({ data }: { data: DivergenceData }) {
  if (!data.google || !data.zomato) return null;

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white/80">Google vs Zomato</p>
          <p className="text-xs text-white/40">Platform sentiment comparison · last 90 days</p>
        </div>
        {data.hasDivergence && (
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
            {data.ratingDiff}★ gap
          </span>
        )}
        {!data.hasDivergence && (
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            Consistent
          </span>
        )}
      </div>

      <div className="flex gap-3">
        <StatCol label="Google Maps" stats={data.google} highlight="blue" />
        <StatCol label="Zomato" stats={data.zomato} highlight="orange" />
      </div>

      {data.message && (
        <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 leading-relaxed">
          ⚠ {data.message}
        </p>
      )}
    </div>
  );
}
