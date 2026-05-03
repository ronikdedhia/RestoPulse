'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface PricePoint {
  weekStart: string;
  valueScore: number;
  mentionCount: number;
  positiveMentions: number;
  negativeMentions: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as PricePoint;
  return (
    <div className="bg-[rgba(15,15,25,0.95)] border border-white/10 rounded-lg p-3 text-xs space-y-1">
      <p className="font-medium text-white/80">{label}</p>
      <p className="text-emerald-400">+{d.positiveMentions} positive</p>
      <p className="text-red-400">-{d.negativeMentions} negative</p>
      <p className="text-white/40">{d.mentionCount} total mentions</p>
    </div>
  );
}

export function PriceSensitivityChart({ data }: { data: PricePoint[] }) {
  if (data.length === 0) return null;

  const chartData = data.map((p) => ({
    ...p,
    week: new Date(p.weekStart).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    score: parseFloat((p.valueScore * 100).toFixed(1)),
  }));

  const latest = chartData[chartData.length - 1]!;
  const scoreColor = latest.score >= 60 ? '#34d399' : latest.score >= 40 ? '#fbbf24' : '#f87171';
  const label = latest.score >= 60 ? 'Good value perception' : latest.score >= 40 ? 'Mixed value signals' : 'Pricing concerns flagged';

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white/80">Value Perception Score</p>
          <p className="text-xs text-white/40">Based on price signal keywords in reviews</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold" style={{ color: scoreColor }}>{latest.score}%</div>
          <div className="text-xs" style={{ color: scoreColor }}>{label}</div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <XAxis dataKey="week" />
          <YAxis domain={[0, 100]} unit="%" />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={50} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="score"
            stroke={scoreColor}
            strokeWidth={2}
            dot={{ r: 3, fill: scoreColor }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
