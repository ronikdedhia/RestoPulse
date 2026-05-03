'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface VelocityPoint {
  date: string;
  totalReviews: number;
  positiveCount: number;
  negativeCount: number;
  avgRating: number | null;
}

interface VelocityAlert {
  id: string;
  alertType: string;
  severity: string;
  message: string;
  reviewsPerDay: number;
  baseline: number;
}

const severityBorder: Record<string, string> = {
  high: 'border-l-red-500 bg-red-500/[0.06] text-red-300',
  medium: 'border-l-amber-500 bg-amber-500/[0.06] text-amber-300',
  low: 'border-l-blue-500 bg-blue-500/[0.06] text-blue-300',
};

const alertIcons: Record<string, string> = {
  negative_spike: '⚠️',
  positive_spike: '📈',
};

export function VelocityChart({ timeSeries, alerts }: { timeSeries: VelocityPoint[]; alerts: VelocityAlert[] }) {
  const chartData = timeSeries.map((p) => ({
    date: new Date(p.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    positive: p.positiveCount,
    negative: p.negativeCount,
    total: p.totalReviews,
  }));

  return (
    <div className="space-y-3">
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`border-l-4 rounded-r-lg px-4 py-3 text-sm ${severityBorder[alert.severity] ?? 'border-l-white/20 bg-white/[0.04] text-white/60'}`}
            >
              <span className="mr-2">{alertIcons[alert.alertType] ?? '🔔'}</span>
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {chartData.length > 0 && (
        <div className="glass-card p-4">
          <p className="text-xs font-medium mb-3 text-white/40 uppercase tracking-wide">Reviews per day (last 14 days)</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: 'rgba(15,15,25,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                itemStyle={{ color: 'rgba(255,255,255,0.6)' }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} />
              <Area type="monotone" dataKey="positive" stackId="1" stroke="#34d399" fill="rgba(52,211,153,0.15)" name="Positive" />
              <Area type="monotone" dataKey="negative" stackId="2" stroke="#f87171" fill="rgba(248,113,113,0.15)" name="Negative" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
