'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchRestaurant, fetchRestaurantInsights, fetchReviewStats, triggerInsights } from '@/lib/api';
import { InsightPanel } from '@/components/dashboard/InsightPanel';
import { RatingChart } from '@/components/dashboard/RatingChart';
import Link from 'next/link';

export default function RestaurantPage({ params }: { params: { id: string } }) {
  const { data: restaurant } = useQuery({
    queryKey: ['restaurant', params.id],
    queryFn: () => fetchRestaurant(params.id),
  });

  const { data: insights, refetch: refetchInsights } = useQuery({
    queryKey: ['insights', params.id],
    queryFn: () => fetchRestaurantInsights(params.id),
  });

  const { data: stats } = useQuery({
    queryKey: ['review-stats', params.id],
    queryFn: () => fetchReviewStats(params.id),
  });

  const handleInsights = async () => {
    await triggerInsights(params.id);
    setTimeout(() => refetchInsights(), 3000);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          ← Dashboard
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{restaurant?.name ?? 'Loading...'}</h1>
          <p className="text-sm text-muted-foreground">{restaurant?.address}</p>
        </div>
        <button
          onClick={handleInsights}
          className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90 transition-opacity"
        >
          Generate Insights
        </button>
      </header>

      <main className="px-6 py-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="text-2xl font-bold">{restaurant?.rating?.toFixed(1) ?? '—'}</div>
            <div className="text-sm text-muted-foreground">Avg. Rating</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-2xl font-bold">{stats?.total ?? 0}</div>
            <div className="text-sm text-muted-foreground">Reviews Scraped</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-2xl font-bold">{insights?.length ?? 0}</div>
            <div className="text-sm text-muted-foreground">Active Insights</div>
          </div>
        </div>

        {stats?.distribution && <RatingChart distribution={stats.distribution} />}

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Actionable Insights</h2>
          {insights?.length === 0 ? (
            <p className="text-muted-foreground text-sm">No insights yet. Reviews are collected daily via cron.</p>
          ) : (
            <div className="grid gap-4">
              {insights?.map((insight: any) => (
                <InsightPanel key={insight.id} insight={insight} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
