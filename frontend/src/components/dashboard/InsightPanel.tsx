'use client';

import { cn } from '@/lib/utils';

interface Insight {
  id: string;
  category: string;
  insight: string;
  priority: string;
  overallSentiment: string;
  evidenceCount: number;
  keyThemes: string[];
  suggestedAction: string;
  impactScore: number;
  delta?: number | null;
  trend?: 'improved' | 'worsened' | 'stable' | 'new' | null;
}

const categoryLabels: Record<string, string> = {
  food_quality: 'Food Quality',
  service: 'Service',
  ambiance: 'Ambiance',
  pricing: 'Pricing',
  hygiene: 'Hygiene',
  staff: 'Staff',
  wait_time: 'Wait Time',
  overall: 'Overall',
};

const priorityBorder: Record<string, string> = {
  high: 'border-l-red-500',
  medium: 'border-l-amber-500',
  low: 'border-l-emerald-500',
};

const sentimentEmoji: Record<string, string> = {
  positive: '😊',
  negative: '😟',
  mixed: '😐',
  neutral: '😶',
};

export function InsightPanel({ insight }: { insight: Insight }) {
  return (
    <div
      className={cn(
        'border-l-4 glass-card rounded-l-none p-4 space-y-3',
        priorityBorder[insight.priority] ?? 'border-l-white/20'
      )}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
            {categoryLabels[insight.category] ?? insight.category}
          </span>
          <span className="text-sm">{sentimentEmoji[insight.overallSentiment]}</span>
          {insight.trend === 'new' && (
            <span className="text-xs px-1.5 py-0.5 bg-blue-500/15 text-blue-400 border border-blue-500/20 rounded font-medium">NEW</span>
          )}
          {insight.trend === 'improved' && (
            <span className="text-xs px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded font-medium">
              ↑ +{((insight.delta ?? 0) * 100).toFixed(0)}%
            </span>
          )}
          {insight.trend === 'worsened' && (
            <span className="text-xs px-1.5 py-0.5 bg-red-500/15 text-red-400 border border-red-500/20 rounded font-medium">
              ↓ {((insight.delta ?? 0) * 100).toFixed(0)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-white/40">
          <span>{insight.evidenceCount} reviews</span>
          <span>Impact: {(insight.impactScore * 100).toFixed(0)}%</span>
        </div>
      </div>

      <p className="text-sm font-medium leading-relaxed text-white/80">{insight.insight}</p>

      {insight.keyThemes?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {insight.keyThemes.map((theme) => (
            <span key={theme} className="text-xs px-2 py-0.5 bg-white/[0.06] border border-white/10 rounded-full text-white/60">
              {theme}
            </span>
          ))}
        </div>
      )}

      {insight.suggestedAction && (
        <div className="text-xs text-white/50 bg-white/[0.04] rounded-md p-2.5 border border-white/[0.08]">
          <span className="font-semibold text-white/70">Action: </span>
          {insight.suggestedAction}
        </div>
      )}
    </div>
  );
}
