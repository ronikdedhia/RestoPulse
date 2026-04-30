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
      <span className="opacity-70">{label}: </span>
      <span className="font-bold">{count}</span>
    </div>
  );
}

export function QueueStats({ stats }: QueueStatsProps) {
  const hasActivity =
    stats.scrape.active > 0 ||
    stats.scrape.waiting > 0 ||
    stats.insights.active > 0 ||
    stats.insights.waiting > 0;

  if (!hasActivity) return null;

  return (
    <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
      <h3 className="text-sm font-semibold">Queue Activity</h3>
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Scrape Queue</p>
          <div className="flex gap-2">
            <QueueBadge label="waiting" count={stats.scrape.waiting} color="bg-blue-100 text-blue-700" />
            <QueueBadge label="active" count={stats.scrape.active} color="bg-orange-100 text-orange-700" />
            <QueueBadge label="failed" count={stats.scrape.failed} color="bg-red-100 text-red-700" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Insights Queue</p>
          <div className="flex gap-2">
            <QueueBadge label="waiting" count={stats.insights.waiting} color="bg-blue-100 text-blue-700" />
            <QueueBadge label="active" count={stats.insights.active} color="bg-orange-100 text-orange-700" />
            <QueueBadge label="failed" count={stats.insights.failed} color="bg-red-100 text-red-700" />
          </div>
        </div>
      </div>
    </div>
  );
}
