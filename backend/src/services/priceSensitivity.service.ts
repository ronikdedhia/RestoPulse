import { prisma } from '../db/client';
import { logger } from '../utils/logger';

const POSITIVE_SIGNALS = [
  'worth it', 'worth every', 'value for money', 'affordable', 'reasonable price',
  'good value', 'pocket friendly', 'budget friendly', 'great deal', 'cheap',
  'inexpensive', 'paisa vasool', 'great price', 'well priced', 'well-priced',
];

const NEGATIVE_SIGNALS = [
  'overpriced', 'too expensive', 'very expensive', 'not worth', 'costly',
  'too costly', 'highway robbery', 'rip off', 'ripoff', 'waste of money',
  'price is high', 'exorbitant', 'steep price', 'bahut costly', 'too much for',
];

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

class PriceSensitivityService {
  async compute(restaurantId: string): Promise<void> {
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setUTCDate(twelveWeeksAgo.getUTCDate() - 84);

    const reviews = await prisma.review.findMany({
      where: {
        restaurantId,
        text: { not: null },
        reviewDate: { gte: twelveWeeksAgo },
      },
      select: { text: true, reviewDate: true },
    });

    if (reviews.length === 0) return;

    const byWeek = new Map<string, { pos: number; neg: number; total: number }>();

    for (const r of reviews) {
      const weekStart = getMondayOf(r.reviewDate ?? new Date());
      const key = weekStart.toISOString();
      if (!byWeek.has(key)) byWeek.set(key, { pos: 0, neg: 0, total: 0 });

      const text = r.text!.toLowerCase();
      const hasPos = POSITIVE_SIGNALS.some((kw) => text.includes(kw));
      const hasNeg = NEGATIVE_SIGNALS.some((kw) => text.includes(kw));

      if (hasPos || hasNeg) {
        const entry = byWeek.get(key)!;
        entry.total++;
        if (hasPos) entry.pos++;
        if (hasNeg) entry.neg++;
      }
    }

    for (const [isoWeek, counts] of byWeek) {
      if (counts.total === 0) continue;
      const weekStart = new Date(isoWeek);
      const valueScore = counts.pos / counts.total;

      await prisma.priceSensitivity.upsert({
        where: { restaurantId_weekStart: { restaurantId, weekStart } },
        update: {
          valueScore,
          mentionCount: counts.total,
          positiveMentions: counts.pos,
          negativeMentions: counts.neg,
        },
        create: {
          restaurantId,
          weekStart,
          valueScore,
          mentionCount: counts.total,
          positiveMentions: counts.pos,
          negativeMentions: counts.neg,
        },
      });
    }

    logger.info(`[price] Computed sensitivity for ${restaurantId} — ${byWeek.size} weeks`);
  }

  async getTimeSeries(restaurantId: string) {
    return prisma.priceSensitivity.findMany({
      where: { restaurantId },
      orderBy: { weekStart: 'asc' },
      take: 12,
    });
  }
}

export const priceSensitivityService = new PriceSensitivityService();
