'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Restaurant {
  id: string;
  name: string;
  address: string;
  rating: number | null;
  cuisine: string | null;
  googleMapsUrl?: string | null;
  zomatoUrl?: string | null;
  reviewCount: number;
  topInsights: Array<{
    id: string;
    category: string;
    insight: string;
    priority: string;
    overallSentiment: string;
  }>;
  lastScraped: string | null;
}

const priorityBadge: Record<string, string> = {
  high: 'bg-red-500/10 text-red-400 border-red-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

export function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  return (
    <Link href={`/dashboard/${restaurant.id}`}>
      <div className="glass-card p-5 hover:border-white/20 hover:shadow-lg hover:shadow-black/30 transition-all duration-200 cursor-pointer space-y-4 group">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-base leading-tight text-white/90 group-hover:text-white transition-colors">
              {restaurant.name}
            </h3>
            <p className="text-xs text-white/40 mt-0.5">{restaurant.address}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {restaurant.rating && (
              <span className="text-sm font-bold text-amber-400">
                {restaurant.rating.toFixed(1)} ★
              </span>
            )}
            <div className="flex gap-1">
              {restaurant.googleMapsUrl && (
                <span className="text-xs px-1.5 py-0.5 rounded border font-medium bg-blue-500/10 text-blue-400 border-blue-500/20">G</span>
              )}
              {restaurant.zomatoUrl && (
                <span className="text-xs px-1.5 py-0.5 rounded border font-medium bg-orange-500/10 text-orange-400 border-orange-500/20">Z</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-white/40">
          {restaurant.cuisine && <span>{restaurant.cuisine}</span>}
          <span>{restaurant.reviewCount} reviews</span>
          {restaurant.lastScraped && (
            <span>Scraped {new Date(restaurant.lastScraped).toLocaleDateString()}</span>
          )}
        </div>

        {restaurant.topInsights.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-white/[0.06]">
            {restaurant.topInsights.slice(0, 2).map((ins) => (
              <div key={ins.id} className="flex items-start gap-2">
                <span
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded border font-medium shrink-0',
                    priorityBadge[ins.priority] ?? 'bg-white/5 text-white/50 border-white/10'
                  )}
                >
                  {ins.priority}
                </span>
                <p className="text-xs text-white/50 line-clamp-2">{ins.insight}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
