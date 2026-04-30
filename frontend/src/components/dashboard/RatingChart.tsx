'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface RatingChartProps {
  distribution: Array<{ rating: number; count: number }>;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

export function RatingChart({ distribution }: RatingChartProps) {
  const data = [1, 2, 3, 4, 5].map((r) => ({
    rating: `${r}★`,
    count: distribution.find((d) => d.rating === r)?.count ?? 0,
  }));

  return (
    <div className="border rounded-lg p-4 space-y-2">
      <h3 className="text-sm font-semibold">Rating Distribution</h3>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
          <XAxis dataKey="rating" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
