'use client';

interface QueueCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

interface QueueStatsProps {
  stats: { scrape: QueueCounts; insights: QueueCounts };
}

function QueueBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`px-3 py-1.5 rounded-md text-xs font-medium ${color}`}>
      <span className="opacity-60">{label}: </span>
      <span className="font-bold">{count}</span>
    </div>
  );
}

export function QueueStats({ stats }: QueueStatsProps) {
  const hasActivity =
    stats.scrape.active > 0 || stats.scrape.waiting > 0 ||
    stats.insights.active > 0 || stats.insights.waiting > 0;

  if (!hasActivity) return null;

  return (
    <div className="glass-card p-4 space-y-3">
      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide">Queue Activity</h3>
      <div className="flex flex-wrap gap-6">
        <div className="space-y-1.5">
          <p className="text-xs text-white/40 font-medium">Scrape Queue</p>
          <div className="flex gap-2">
            <QueueBadge label="waiting" count={stats.scrape.waiting} color="bg-blue-500/10 text-blue-400" />
            <QueueBadge label="active" count={stats.scrape.active} color="bg-amber-500/10 text-amber-400" />
            <QueueBadge label="failed" count={stats.scrape.failed} color="bg-red-500/10 text-red-400" />
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs text-white/40 font-medium">Insights Queue</p>
          <div className="flex gap-2">
            <QueueBadge label="waiting" count={stats.insights.waiting} color="bg-blue-500/10 text-blue-400" />
            <QueueBadge label="active" count={stats.insights.active} color="bg-amber-500/10 text-amber-400" />
            <QueueBadge label="failed" count={stats.insights.failed} color="bg-red-500/10 text-red-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
