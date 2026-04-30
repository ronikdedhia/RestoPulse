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

const priorityColors: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200',
};

export function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  return (
    <Link href={`/dashboard/${restaurant.id}`}>
      <div className="border rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer space-y-4 bg-card">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-base leading-tight">{restaurant.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{restaurant.address}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {restaurant.rating && (
              <span className="text-sm font-bold text-amber-500">
                {restaurant.rating.toFixed(1)} ★
              </span>
            )}
            <div className="flex gap-1">
              {restaurant.googleMapsUrl && (
                <span className="text-xs px-1.5 py-0.5 rounded border font-medium bg-blue-100 text-blue-700 border-blue-200">G</span>
              )}
              {restaurant.zomatoUrl && (
                <span className="text-xs px-1.5 py-0.5 rounded border font-medium bg-orange-100 text-orange-700 border-orange-200">Z</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {restaurant.cuisine && <span>{restaurant.cuisine}</span>}
          <span>{restaurant.reviewCount} reviews</span>
          {restaurant.lastScraped && (
            <span>Scraped {new Date(restaurant.lastScraped).toLocaleDateString()}</span>
          )}
        </div>

        {restaurant.topInsights.length > 0 && (
          <div className="space-y-2">
            {restaurant.topInsights.slice(0, 2).map((ins) => (
              <div key={ins.id} className="flex items-start gap-2">
                <span
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded border font-medium shrink-0',
                    priorityColors[ins.priority] ?? 'bg-muted text-muted-foreground border-border'
                  )}
                >
                  {ins.priority}
                </span>
                <p className="text-xs text-muted-foreground line-clamp-2">{ins.insight}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
