'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchInsights, fetchQueueStats } from '@/lib/api';
import { RestaurantCard } from '@/components/dashboard/RestaurantCard';
import { QueueStats } from '@/components/dashboard/QueueStats';
import { UserButton } from '@clerk/nextjs';
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
    <div className="min-h-screen">
      <header className="glass-header sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gradient-blue">RestoPulse</h1>
          <p className="text-xs text-white/40 mt-0.5">Restaurant Intelligence Platform</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/add"
            className="glass-button px-4 py-1.5 rounded-lg text-sm font-medium"
          >
            + Add Restaurant
          </Link>
          <UserButton />
        </div>
      </header>

      <main className="px-6 py-8 space-y-8 max-w-7xl mx-auto">
        {queueStats && <QueueStats stats={queueStats} />}

        {isLoading ? (
          <div className="text-center text-white/40 py-16">Loading restaurants...</div>
        ) : restaurants?.length === 0 ? (
          <div className="text-center text-white/40 py-16 space-y-3">
            <p>No restaurants yet.</p>
            <Link href="/dashboard/add" className="text-sm text-blue-400 underline underline-offset-2">
              Add your first restaurant
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {restaurants?.map((r: any) => (
              <RestaurantCard key={r.id} restaurant={r} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
