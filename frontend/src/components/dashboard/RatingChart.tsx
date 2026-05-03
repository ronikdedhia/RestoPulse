'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface RatingChartProps {
  distribution: Array<{ rating: number; count: number }>;
}

const COLORS = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399'];

export function RatingChart({ distribution }: RatingChartProps) {
  const data = [1, 2, 3, 4, 5].map((r) => ({
    rating: `${r}★`,
    count: distribution.find((d) => d.rating === r)?.count ?? 0,
  }));

  return (
    <div className="glass-card p-4 space-y-2">
      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide">Rating Distribution</h3>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
          <XAxis dataKey="rating" />
          <YAxis />
          <Tooltip
            contentStyle={{ background: 'rgba(15,15,25,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
            itemStyle={{ color: 'rgba(255,255,255,0.7)' }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i]} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
