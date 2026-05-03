'use client';

interface PersistentIssue {
  id: string;
  category: string;
  weeksSeen: number;
  avgImpactScore: number;
  firstSeenAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  food_quality: 'Food Quality', service: 'Service', ambiance: 'Ambiance',
  pricing: 'Pricing', hygiene: 'Hygiene', staff: 'Staff', wait_time: 'Wait Time', overall: 'Overall',
};

const severityBorder = (weeks: number) =>
  weeks >= 6 ? 'border-l-red-500'
  : weeks >= 4 ? 'border-l-orange-400'
  : 'border-l-amber-400';

export function PersistentIssuesPanel({ issues }: { issues: PersistentIssue[] }) {
  if (issues.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/40">
        These categories have appeared for 3+ consecutive weeks — a structural problem, not a one-off incident.
      </p>
      <div className="grid gap-3">
        {issues.map((issue) => (
          <div key={issue.id} className={`glass-card border-l-4 rounded-l-none p-4 ${severityBorder(issue.weeksSeen)}`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white/80">
                  {CATEGORY_LABELS[issue.category] ?? issue.category}
                </span>
                <span className="text-xs px-2 py-0.5 bg-white/[0.08] border border-white/10 rounded-full font-medium text-white/60">
                  {issue.weeksSeen} weeks
                </span>
              </div>
              <span className="text-xs text-white/40">
                Impact avg: {(issue.avgImpactScore * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-white/40 mt-1.5">
              First flagged {new Date(issue.firstSeenAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — requires process change, not a quick fix.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
