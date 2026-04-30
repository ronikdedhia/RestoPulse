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

const priorityColors: Record<string, string> = {
  high: 'border-l-red-500 bg-red-50',
  medium: 'border-l-yellow-500 bg-yellow-50',
  low: 'border-l-green-500 bg-green-50',
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
        'border-l-4 rounded-r-lg p-4 space-y-3',
        priorityColors[insight.priority] ?? 'border-l-border bg-card'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {categoryLabels[insight.category] ?? insight.category}
          </span>
          <span className="text-sm">{sentimentEmoji[insight.overallSentiment]}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{insight.evidenceCount} reviews</span>
          <span>Impact: {(insight.impactScore * 100).toFixed(0)}%</span>
        </div>
      </div>

      <p className="text-sm font-medium leading-relaxed">{insight.insight}</p>

      {insight.keyThemes?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {insight.keyThemes.map((theme) => (
            <span key={theme} className="text-xs px-2 py-0.5 bg-background border rounded-full">
              {theme}
            </span>
          ))}
        </div>
      )}

      {insight.suggestedAction && (
        <div className="text-xs text-muted-foreground bg-background rounded-md p-2 border">
          <span className="font-medium">Action: </span>
          {insight.suggestedAction}
        </div>
      )}
    </div>
  );
}
