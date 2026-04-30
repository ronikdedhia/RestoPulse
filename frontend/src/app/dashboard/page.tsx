'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchInsights, fetchQueueStats } from '@/lib/api';
import { RestaurantCard } from '@/components/dashboard/RestaurantCard';
import { QueueStats } from '@/components/dashboard/QueueStats';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: restaurants, isLoading } = useQuery({
    queryKey: ['insights-summary'],
    queryFn: fetchInsights,
    refetchInterval: 30_000,
  });

  const { data: queueStats } = useQuery({
    queryKey: ['queue-stats'],
    queryFn: fetchQueueStats,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">RestoPulse</h1>
          <p className="text-sm text-muted-foreground">Mumbai Restaurant Review Intelligence</p>
        </div>
        <Link
          href="/dashboard/add"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Add Restaurant
        </Link>
      </header>

      <main className="px-6 py-8 space-y-8">
        {queueStats && <QueueStats stats={queueStats} />}

        {isLoading ? (
          <div className="text-center text-muted-foreground py-16">Loading restaurants...</div>
        ) : restaurants?.length === 0 ? (
          <div className="text-center text-muted-foreground py-16 space-y-3">
            <p>No restaurants yet.</p>
            <Link href="/dashboard/add" className="text-sm text-primary underline underline-offset-2">
              Add your first restaurant
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {restaurants?.map((r: any) => (
              <RestaurantCard key={r.id} restaurant={r} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
