'use client';

interface StaffMention {
  id: string;
  staffName: string;
  mentions: number;
  positiveMentions: number;
  negativeMentions: number;
}

export function StaffMentionTable({ staff }: { staff: StaffMention[] }) {
  if (staff.length === 0) return null;

  return (
    <div className="glass-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="text-left px-4 py-2.5 font-medium text-white/40 text-xs uppercase tracking-wide">Name</th>
            <th className="text-center px-4 py-2.5 font-medium text-white/40 text-xs uppercase tracking-wide">Mentions</th>
            <th className="text-center px-4 py-2.5 font-medium text-emerald-500/60 text-xs uppercase tracking-wide">Positive</th>
            <th className="text-center px-4 py-2.5 font-medium text-red-500/60 text-xs uppercase tracking-wide">Negative</th>
            <th className="text-left px-4 py-2.5 font-medium text-white/40 text-xs uppercase tracking-wide">Signal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {staff.map((s) => {
            const positiveRate = s.mentions > 0 ? s.positiveMentions / s.mentions : 0;
            const sentiment =
              positiveRate >= 0.75 ? 'Star performer'
              : positiveRate <= 0.3 ? 'Needs attention'
              : 'Mixed';
            const sentimentColor =
              positiveRate >= 0.75 ? 'text-emerald-400'
              : positiveRate <= 0.3 ? 'text-red-400'
              : 'text-amber-400';

            return (
              <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-2.5 font-medium text-white/80">{s.staffName}</td>
                <td className="px-4 py-2.5 text-center text-white/50">{s.mentions}</td>
                <td className="px-4 py-2.5 text-center text-emerald-400">+{s.positiveMentions}</td>
                <td className="px-4 py-2.5 text-center text-red-400">-{s.negativeMentions}</td>
                <td className={`px-4 py-2.5 text-xs font-medium ${sentimentColor}`}>{sentiment}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
