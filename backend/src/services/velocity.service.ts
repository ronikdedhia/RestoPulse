import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { telegramService } from './telegram.service';

const NEGATIVE_THRESHOLD = 2;  // rating <= 2 → negative
const POSITIVE_THRESHOLD = 4;  // rating >= 4 → positive
const SPIKE_MULTIPLIER = 2.0;  // 2x baseline = spike
const MIN_ABSOLUTE_NEGATIVE = 2; // must have at least 2/day to alert
const MIN_ABSOLUTE_POSITIVE = 3;

function toDateOnly(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

function avgPerDay(counts: number[]): number {
  if (counts.length === 0) return 0;
  return counts.reduce((a, b) => a + b, 0) / counts.length;
}

class VelocityService {
  async compute(restaurantId: string): Promise<void> {
    const now = new Date();
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 14);

    const reviews = await prisma.review.findMany({
      where: {
        restaurantId,
        reviewDate: { gte: fourteenDaysAgo },
      },
      select: { rating: true, reviewDate: true },
    });

    // Group by day
    const byDay = new Map<string, { total: number; pos: number; neg: number; ratings: number[] }>();

    for (const r of reviews) {
      const d = toDateOnly(r.reviewDate ?? now);
      const key = d.toISOString();
      if (!byDay.has(key)) byDay.set(key, { total: 0, pos: 0, neg: 0, ratings: [] });
      const entry = byDay.get(key)!;
      entry.total++;
      entry.ratings.push(r.rating);
      if (r.rating >= POSITIVE_THRESHOLD) entry.pos++;
      if (r.rating <= NEGATIVE_THRESHOLD) entry.neg++;
    }

    // Upsert ReviewVelocity for each day
    for (const [isoDate, counts] of byDay) {
      const date = new Date(isoDate);
      const avgRating = counts.ratings.length > 0 ? counts.ratings.reduce((a, b) => a + b, 0) / counts.ratings.length : null;

      await prisma.reviewVelocity.upsert({
        where: { restaurantId_date: { restaurantId, date } },
        update: {
          totalReviews: counts.total,
          positiveCount: counts.pos,
          negativeCount: counts.neg,
          avgRating,
        },
        create: {
          restaurantId,
          date,
          totalReviews: counts.total,
          positiveCount: counts.pos,
          negativeCount: counts.neg,
          avgRating,
        },
      });
    }

    // Remember which alert types were already active so we don't re-notify for ongoing surges
    const previouslyActiveTypes = new Set(
      (await prisma.velocityAlert.findMany({
        where: { restaurantId, isActive: true },
        select: { alertType: true },
      })).map(a => a.alertType)
    );

    // Resolve all active alerts before re-evaluating
    await prisma.velocityAlert.updateMany({
      where: { restaurantId, isActive: true },
      data: { isActive: false, resolvedAt: now },
    });

    // Window comparison
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

    const currentWindow: number[] = [];
    const currentNeg: number[] = [];
    const currentPos: number[] = [];
    const baselineNeg: number[] = [];
    const baselinePos: number[] = [];

    for (const [isoDate, counts] of byDay) {
      const d = new Date(isoDate);
      if (d >= sevenDaysAgo) {
        currentWindow.push(counts.total);
        currentNeg.push(counts.neg);
        currentPos.push(counts.pos);
      } else {
        baselineNeg.push(counts.neg);
        baselinePos.push(counts.pos);
      }
    }

    const avgNegCurrent = avgPerDay(currentNeg);
    const avgPosCurrent = avgPerDay(currentPos);
    const avgNegBaseline = avgPerDay(baselineNeg);
    const avgPosBaseline = avgPerDay(baselinePos);

    // Negative spike
    if (
      avgNegCurrent >= MIN_ABSOLUTE_NEGATIVE &&
      (avgNegBaseline === 0 || avgNegCurrent >= avgNegBaseline * SPIKE_MULTIPLIER)
    ) {
      const severity =
        avgNegCurrent >= avgNegBaseline * 4 || avgNegBaseline === 0 ? 'high'
        : avgNegCurrent >= avgNegBaseline * 3 ? 'medium'
        : 'low';

      const msg = `Negative review spike: ${avgNegCurrent.toFixed(1)}/day this week vs ${avgNegBaseline.toFixed(1)}/day baseline. Possible viral complaint or service issue.`;

      await prisma.velocityAlert.create({
        data: { restaurantId, alertType: 'negative_spike', severity, message: msg, reviewsPerDay: avgNegCurrent, baseline: avgNegBaseline },
      });

      if (!previouslyActiveTypes.has('negative_spike')) {
        const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true } });
        await telegramService.sendAlert(`🚨 <b>${restaurant?.name ?? restaurantId}</b>\n${msg}`);
      }
    }

    // Positive spike
    if (
      avgPosCurrent >= MIN_ABSOLUTE_POSITIVE &&
      (avgPosBaseline === 0 || avgPosCurrent >= avgPosBaseline * SPIKE_MULTIPLIER)
    ) {
      const severity =
        avgPosCurrent >= avgPosBaseline * 4 || avgPosBaseline === 0 ? 'high'
        : avgPosCurrent >= avgPosBaseline * 3 ? 'medium'
        : 'low';

      const msg = `Positive review surge: ${avgPosCurrent.toFixed(1)}/day this week vs ${avgPosBaseline.toFixed(1)}/day baseline. Possible influencer visit or campaign.`;

      await prisma.velocityAlert.create({
        data: { restaurantId, alertType: 'positive_spike', severity, message: msg, reviewsPerDay: avgPosCurrent, baseline: avgPosBaseline },
      });

      if (!previouslyActiveTypes.has('positive_spike')) {
        const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true } });
        await telegramService.sendAlert(`📈 <b>${restaurant?.name ?? restaurantId}</b>\n${msg}`);
      }
    }

    logger.info(`[velocity] Computed for ${restaurantId}: neg=${avgNegCurrent.toFixed(2)}/d pos=${avgPosCurrent.toFixed(2)}/d`);
  }

  async getVelocityData(restaurantId: string) {
    const [timeSeries, alerts] = await Promise.all([
      prisma.reviewVelocity.findMany({
        where: { restaurantId },
        orderBy: { date: 'asc' },
        take: 30,
      }),
      prisma.velocityAlert.findMany({
        where: { restaurantId, isActive: true },
        orderBy: { triggeredAt: 'desc' },
      }),
    ]);

    return { timeSeries, alerts };
  }

  async getActiveAlerts() {
    return prisma.velocityAlert.findMany({
      where: { isActive: true },
      include: { restaurant: { select: { id: true, name: true } } },
      orderBy: { triggeredAt: 'desc' },
    });
  }
}

export const velocityService = new VelocityService();
