import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { telegramService } from './telegram.service';

const RED_FLAG_KEYWORDS = [
  'food poisoning', 'food poison', 'got sick', 'food sick', 'fell sick',
  'cockroach', 'cockroaches', 'roach',
  'hair in', 'hair found',
  'rude staff', 'very rude', 'extremely rude',
  'overcharged', 'double billing', 'double charged', 'charged twice',
  'refund', 'cheated', 'fraud',
  'rat', 'rats', 'mouse', 'mice',
  'stone in', 'pebble in', 'insects',
  'vomit', 'vomiting', 'threw up',
];

function matchKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  return RED_FLAG_KEYWORDS.filter((kw) => lower.includes(kw));
}

class RedFlagService {
  async scan(restaurantId: string): Promise<number> {
    const reviews = await prisma.review.findMany({
      where: { restaurantId, text: { not: null }, isRedFlag: false },
      select: { id: true, text: true, reviewerName: true, rating: true },
    });

    let flagged = 0;

    for (const review of reviews) {
      const matched = matchKeywords(review.text!);
      if (matched.length === 0) continue;

      await prisma.review.update({
        where: { id: review.id },
        data: { isRedFlag: true, redFlagWords: matched.join(', ') },
      });
      flagged++;
    }

    if (flagged > 0) {
      logger.info(`[red-flag] ${restaurantId} — flagged ${flagged} critical reviews`);
      await this.sendAlert(restaurantId, flagged);
    }

    return flagged;
  }

  async getRedFlags(restaurantId: string) {
    return prisma.review.findMany({
      where: { restaurantId, isRedFlag: true },
      select: {
        id: true,
        reviewerName: true,
        rating: true,
        text: true,
        redFlagWords: true,
        reviewDate: true,
        source: true,
      },
      orderBy: { reviewDate: 'desc' },
      take: 20,
    });
  }

  private async sendAlert(restaurantId: string, count: number): Promise<void> {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true },
    });
    if (!restaurant) return;

    const newFlags = await prisma.review.findMany({
      where: { restaurantId, isRedFlag: true },
      select: { redFlagWords: true, rating: true },
      orderBy: { scrapedAt: 'desc' },
      take: count,
    });

    const keywords = [...new Set(newFlags.flatMap((r) => (r.redFlagWords ?? '').split(', ')))].filter(Boolean);

    await telegramService.sendAlert(
      `🚨 <b>CRITICAL ACTION REQUIRED — ${restaurant.name}</b>\n` +
      `${count} review(s) flagged with critical issues:\n` +
      keywords.map((kw) => `• <i>${kw}</i>`).join('\n') +
      `\n\nImmediate attention needed.`
    );
  }
}

export const redFlagService = new RedFlagService();
