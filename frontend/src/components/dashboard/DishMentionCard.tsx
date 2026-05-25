'use client';

interface DishMention {
  id: string;
  dish: string;
  mentions: number;
  positiveMentions: number;
  negativeMentions: number;
}

export function DishMentionCard({ dish }: { dish: DishMention }) {
  const neutral = Math.max(0, dish.mentions - dish.positiveMentions - dish.negativeMentions);
  const positiveWidth = dish.mentions > 0 ? Math.round((dish.positiveMentions / dish.mentions) * 100) : 0;
  const negativeWidth = dish.mentions > 0 ? Math.round((dish.negativeMentions / dish.mentions) * 100) : 0;
  const neutralWidth = Math.max(0, 100 - positiveWidth - negativeWidth);

  const sentimentColor =
    dish.positiveMentions > dish.negativeMentions * 2
      ? 'text-emerald-400'
      : dish.negativeMentions > dish.positiveMentions
        ? 'text-red-400'
        : 'text-amber-400';

  return (
    <div className="glass-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className={`font-medium text-sm capitalize ${sentimentColor}`}>{dish.dish}</span>
        <span className="text-xs text-white/40">{dish.mentions} mentions</span>
      </div>

      <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
        {positiveWidth > 0 && <div className="bg-emerald-500/70" style={{ width: `${positiveWidth}%` }} />}
        {neutralWidth > 0 && <div className="bg-white/20" style={{ width: `${neutralWidth}%` }} />}
        {negativeWidth > 0 && <div className="bg-red-500/70" style={{ width: `${negativeWidth}%` }} />}
      </div>

      <div className="flex gap-3 text-xs text-white/40">
        <span className="text-emerald-400">+{dish.positiveMentions}</span>
        {neutral > 0 && <span>{neutral} neutral</span>}
        <span className="text-red-400">-{dish.negativeMentions}</span>
      </div>
    </div>
  );
}
