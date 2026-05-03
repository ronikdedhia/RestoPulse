'use client';

interface HealthScore {
  score: number;
  ratingComponent: number;
  sentimentComponent: number;
  velocityComponent: number;
  persistentPenalty: number;
  fakePenalty: number;
  weekStart: string;
}

interface Props {
  latest: HealthScore | null;
}

function ScoreBar({ label, value, isNegative = false }: { label: string; value: number; isNegative?: boolean }) {
  const colour = isNegative
    ? 'bg-red-500/70'
    : value >= 70 ? 'bg-emerald-500/70'
    : value >= 40 ? 'bg-amber-500/70'
    : 'bg-red-500/70';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-white/50">{label}</span>
        <span className={isNegative ? 'text-red-400' : 'text-white/70'}>{isNegative ? `-${value.toFixed(0)}` : `${value.toFixed(0)}`}</span>
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colour}`}
          style={{ width: `${Math.min(100, isNegative ? value * 2.5 : value)}%` }}
        />
      </div>
    </div>
  );
}

function getScoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 35) return 'Needs Work';
  return 'Critical';
}

export function HealthScoreCard({ latest }: Props) {
  if (!latest) {
    return (
      <div className="glass-card p-5 text-center text-white/40 text-sm py-8">
        Health score will appear after insights are generated.
      </div>
    );
  }

  return (
    <div className="glass-card p-5 space-y-5">
      <div className="flex items-center gap-4">
        <div className={`text-5xl font-bold tabular-nums ${getScoreColor(latest.score)}`}>
          {latest.score.toFixed(0)}
        </div>
        <div>
          <div className={`text-sm font-semibold ${getScoreColor(latest.score)}`}>
            {getScoreLabel(latest.score)}
          </div>
          <div className="text-xs text-white/40 mt-0.5">
            Week of {new Date(latest.weekStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </div>
        </div>
        <div className="ml-auto">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
              <circle
                cx="32" cy="32" r="28"
                fill="none"
                stroke={latest.score >= 75 ? '#34d399' : latest.score >= 50 ? '#fbbf24' : '#f87171'}
                strokeWidth="6"
                strokeDasharray={`${(latest.score / 100) * 175.9} 175.9`}
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <ScoreBar label="Rating" value={latest.ratingComponent} />
        <ScoreBar label="Sentiment" value={latest.sentimentComponent} />
        <ScoreBar label="Velocity" value={latest.velocityComponent} />
        <ScoreBar label="Persistent Issues" value={latest.persistentPenalty} isNegative />
        <ScoreBar label="Fake Reviews" value={latest.fakePenalty} isNegative />
      </div>
    </div>
  );
}
