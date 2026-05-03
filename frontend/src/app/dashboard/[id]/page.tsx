'use client';

import { useQuery } from '@tanstack/react-query';
import {
  fetchRestaurant,
  fetchInsightDiff,
  fetchReviewStats,
  fetchDishMentions,
  fetchVelocityData,
  fetchStaffMentions,
  fetchFakeReviews,
  fetchPriceSensitivity,
  fetchPersistentIssues,
  fetchHealthScore,
  fetchOwnerEvents,
  fetchRedFlags,
  fetchSourceDivergence,
  fetchCustomerSegments,
  triggerInsights,
} from '@/lib/api';
import { InsightPanel } from '@/components/dashboard/InsightPanel';
import { DishMentionCard } from '@/components/dashboard/DishMentionCard';
import { VelocityChart } from '@/components/dashboard/VelocityChart';
import { StaffMentionTable } from '@/components/dashboard/StaffMentionTable';
import { FakeReviewPanel } from '@/components/dashboard/FakeReviewPanel';
import { PriceSensitivityChart } from '@/components/dashboard/PriceSensitivityChart';
import { PersistentIssuesPanel } from '@/components/dashboard/PersistentIssuesPanel';
import { DigestConfig } from '@/components/dashboard/DigestConfig';
import { RatingChart } from '@/components/dashboard/RatingChart';
import { HealthScoreCard } from '@/components/dashboard/HealthScoreCard';
import { OwnerEventLog } from '@/components/dashboard/OwnerEventLog';
import { RedFlagPanel } from '@/components/dashboard/RedFlagPanel';
import { SourceDivergenceCard } from '@/components/dashboard/SourceDivergenceCard';
import { CustomerSegmentCard } from '@/components/dashboard/CustomerSegmentCard';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export default function RestaurantPage({ params }: { params: { id: string } }) {
  const { data: restaurant } = useQuery({
    queryKey: ['restaurant', params.id],
    queryFn: () => fetchRestaurant(params.id),
  });

  const { data: diff, refetch: refetchDiff } = useQuery({
    queryKey: ['insight-diff', params.id],
    queryFn: () => fetchInsightDiff(params.id),
  });

  const { data: stats } = useQuery({
    queryKey: ['review-stats', params.id],
    queryFn: () => fetchReviewStats(params.id),
  });

  const { data: dishes, refetch: refetchDishes } = useQuery({
    queryKey: ['dish-mentions', params.id],
    queryFn: () => fetchDishMentions(params.id),
  });

  const { data: velocity } = useQuery({
    queryKey: ['velocity', params.id],
    queryFn: () => fetchVelocityData(params.id),
  });

  const { data: staff, refetch: refetchStaff } = useQuery({
    queryKey: ['staff-mentions', params.id],
    queryFn: () => fetchStaffMentions(params.id),
  });

  const { data: fakeData, refetch: refetchFake } = useQuery({
    queryKey: ['fake-reviews', params.id],
    queryFn: () => fetchFakeReviews(params.id),
  });

  const { data: priceData } = useQuery({
    queryKey: ['price-sensitivity', params.id],
    queryFn: () => fetchPriceSensitivity(params.id),
  });

  const { data: persistentIssues, refetch: refetchPersistent } = useQuery({
    queryKey: ['persistent-issues', params.id],
    queryFn: () => fetchPersistentIssues(params.id),
  });

  const { data: healthData, refetch: refetchHealth } = useQuery({
    queryKey: ['health-score', params.id],
    queryFn: () => fetchHealthScore(params.id),
  });

  const { data: events, refetch: refetchEvents } = useQuery({
    queryKey: ['owner-events', params.id],
    queryFn: () => fetchOwnerEvents(params.id),
  });

  const { data: redFlags } = useQuery({
    queryKey: ['red-flags', params.id],
    queryFn: () => fetchRedFlags(params.id),
  });

  const { data: divergence } = useQuery({
    queryKey: ['source-divergence', params.id],
    queryFn: () => fetchSourceDivergence(params.id),
  });

  const { data: segments } = useQuery({
    queryKey: ['customer-segments', params.id],
    queryFn: () => fetchCustomerSegments(params.id),
  });

  const handleInsights = async () => {
    await triggerInsights(params.id);
    setTimeout(() => {
      refetchDiff();
      refetchDishes();
      refetchStaff();
      refetchFake();
      refetchPersistent();
      refetchHealth();
    }, 3000);
  };

  const insights = diff?.insights ?? [];
  const resolved = diff?.resolved ?? [];
  const hasBaseline = diff?.hasBaseline ?? false;

  return (
    <div className="min-h-screen">
      <header className="glass-header sticky top-0 z-10 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-white/40 hover:text-white/80 transition-colors">
          ← Dashboard
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white/90">{restaurant?.name ?? 'Loading...'}</h1>
          <p className="text-xs text-white/40">{restaurant?.address}</p>
        </div>
        <button
          onClick={handleInsights}
          className="glass-button px-3 py-1.5 rounded-lg text-sm font-medium"
        >
          Generate Insights
        </button>
        <UserButton />
      </header>

      <main className="px-6 py-8 space-y-8 max-w-6xl mx-auto">
        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-card p-4">
            <div className="text-3xl font-bold text-amber-400">{restaurant?.rating?.toFixed(1) ?? '—'}</div>
            <div className="text-xs text-white/40 mt-1">Avg. Rating</div>
          </div>
          <div className="glass-card p-4">
            <div className="text-3xl font-bold text-white/90">{stats?.total ?? 0}</div>
            <div className="text-xs text-white/40 mt-1">Reviews Scraped</div>
          </div>
          <div className="glass-card p-4">
            <div className="text-3xl font-bold text-blue-400">{insights.length}</div>
            <div className="text-xs text-white/40 mt-1">Active Insights</div>
          </div>
          <div className="glass-card p-4">
            <div className={`text-3xl font-bold ${
              (healthData?.latest?.score ?? 0) >= 75 ? 'text-emerald-400'
              : (healthData?.latest?.score ?? 0) >= 50 ? 'text-amber-400'
              : 'text-red-400'
            }`}>
              {healthData?.latest?.score?.toFixed(0) ?? '—'}
            </div>
            <div className="text-xs text-white/40 mt-1">Health Score</div>
          </div>
        </div>

        {/* Health score breakdown */}
        {healthData?.latest && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-white/70">Restaurant Health</h2>
            <HealthScoreCard latest={healthData.latest} />
          </div>
        )}

        {/* Velocity alerts + chart */}
        {velocity && (velocity.alerts?.length > 0 || velocity.timeSeries?.length > 0) && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-white/70">Review Velocity</h2>
            <VelocityChart timeSeries={velocity.timeSeries ?? []} alerts={velocity.alerts ?? []} />
          </div>
        )}

        {/* Red flag reviews */}
        {redFlags && redFlags.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-red-400">Critical Action Required</h2>
            <RedFlagPanel reviews={redFlags} />
          </div>
        )}

        {/* Persistent issues */}
        {persistentIssues && persistentIssues.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-orange-400">Persistent Issues</h2>
            <PersistentIssuesPanel issues={persistentIssues} />
          </div>
        )}

        {stats?.distribution && <RatingChart distribution={stats.distribution} />}

        {/* Actionable insights */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-white/70">Actionable Insights</h2>
            {hasBaseline && (
              <span className="text-xs text-white/30 border border-white/10 rounded-full px-2 py-0.5">
                vs last week
              </span>
            )}
          </div>

          {insights.length === 0 ? (
            <p className="text-white/30 text-sm">No insights yet. Reviews are collected daily via cron.</p>
          ) : (
            <div className="grid gap-4">
              {insights.map((insight: any) => (
                <InsightPanel key={insight.id} insight={insight} />
              ))}
            </div>
          )}

          {resolved.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs text-white/30 font-medium uppercase tracking-wide">Resolved this week</p>
              {resolved.map((r: any) => (
                <div key={r.category} className="text-xs glass rounded-md p-2 text-white/30 line-through">
                  {r.category.replace(/_/g, ' ')} — was {(r.impactScore * 100).toFixed(0)}% impact
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Source divergence */}
        {divergence && (divergence.google || divergence.zomato) && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-white/70">Platform Comparison</h2>
            <SourceDivergenceCard data={divergence} />
          </div>
        )}

        {/* Price sensitivity */}
        {priceData && priceData.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-white/70">Price Sensitivity</h2>
            <PriceSensitivityChart data={priceData} />
          </div>
        )}

        {/* Dish mentions */}
        {dishes && dishes.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-white/70">Dish Mentions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {dishes.map((dish: any) => (
                <DishMentionCard key={dish.id} dish={dish} />
              ))}
            </div>
          </div>
        )}

        {/* Staff tracking */}
        {staff && staff.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-white/70">Staff Mentions</h2>
            <StaffMentionTable staff={staff} />
          </div>
        )}

        {/* Customer segments */}
        {segments && segments.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-white/70">Customer Segments</h2>
            <CustomerSegmentCard segments={segments} />
          </div>
        )}

        {/* Fake review detection */}
        {fakeData && fakeData.summary?.total > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-white/70">Review Authenticity</h2>
            <FakeReviewPanel suspicious={fakeData.suspicious ?? []} summary={fakeData.summary} />
          </div>
        )}

        {/* Owner event log */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-white/70">Owner Event Log</h2>
          <p className="text-xs text-white/30">Log operational changes to correlate with review trends.</p>
          <OwnerEventLog restaurantId={params.id} events={events ?? []} />
        </div>

        {/* Digest config */}
        {restaurant && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-white/70">Notifications</h2>
            <DigestConfig
              restaurantId={params.id}
              initialEmail={restaurant.ownerEmail}
              initialEnabled={restaurant.digestEnabled ?? true}
            />
          </div>
        )}
      </main>
    </div>
  );
}
