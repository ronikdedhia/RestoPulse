import { prisma } from '../db/client';
import { logger } from '../utils/logger';

function getMondayOf(d: Date): Date {
  const date = new Date(d);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

class HealthScoreService {
  async compute(restaurantId: string): Promise<number> {
    const weekStart = getMondayOf(new Date());

    const [restaurant, recentVelocity, persistentIssues, fakeScores, recentReviews] = await Promise.all([
      prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { rating: true },
      }),
      prisma.reviewVelocity.findMany({
        where: { restaurantId, date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
      prisma.persistentIssue.findMany({
        where: { restaurantId, isActive: true },
      }),
      prisma.fakeReviewScore.findMany({
        where: { restaurantId },
        select: { isSuspicious: true, authenticityScore: true },
      }),
      prisma.review.findMany({
        where: {
          restaurantId,
          reviewDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        select: { sentiment: true, rating: true },
      }),
    ]);

    // Rating component (0-100): scale 1-5 → 0-100
    const ratingComponent = Math.min(100, ((restaurant?.rating ?? 3) - 1) / 4 * 100);

    // Sentiment component (0-100): % positive reviews
    const totalWithSentiment = recentReviews.filter((r) => r.sentiment).length;
    const positiveCount = recentReviews.filter((r) => r.sentiment === 'positive').length;
    const sentimentComponent = totalWithSentiment > 0
      ? (positiveCount / totalWithSentiment) * 100
      : 50;

    // Velocity component (0-100): positive review rate in last 7d
    const totalVelocity = recentVelocity.reduce((s, v) => s + v.totalReviews, 0);
    const positiveVelocity = recentVelocity.reduce((s, v) => s + v.positiveCount, 0);
    const velocityComponent = totalVelocity > 0
      ? (positiveVelocity / totalVelocity) * 100
      : 50;

    // Persistent issue penalty: -8 per active persistent issue, max -40
    const persistentPenalty = Math.min(40, persistentIssues.length * 8);

    // Fake review penalty: % suspicious × 30
    const totalFake = fakeScores.length;
    const suspiciousCount = fakeScores.filter((f) => f.isSuspicious).length;
    const fakePenalty = totalFake > 0
      ? Math.min(30, (suspiciousCount / totalFake) * 30)
      : 0;

    // Weighted composite
    const raw =
      ratingComponent * 0.30 +
      sentimentComponent * 0.25 +
      velocityComponent * 0.20 -
      persistentPenalty * 0.15 -
      fakePenalty * 0.10;

    const score = Math.max(0, Math.min(100, raw));

    await prisma.healthScore.upsert({
      where: { restaurantId_weekStart: { restaurantId, weekStart } },
      update: {
        score,
        ratingComponent,
        sentimentComponent,
        velocityComponent,
        persistentPenalty,
        fakePenalty,
      },
      create: {
        restaurantId,
        weekStart,
        score,
        ratingComponent,
        sentimentComponent,
        velocityComponent,
        persistentPenalty,
        fakePenalty,
      },
    });

    logger.info(`[health-score] ${restaurantId} → ${score.toFixed(1)}/100`);
    return score;
  }

  async getLatest(restaurantId: string) {
    return prisma.healthScore.findFirst({
      where: { restaurantId },
      orderBy: { weekStart: 'desc' },
    });
  }

  async getHistory(restaurantId: string) {
    return prisma.healthScore.findMany({
      where: { restaurantId },
      orderBy: { weekStart: 'asc' },
      take: 12,
    });
  }
}

export const healthScoreService = new HealthScoreService();
