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

    // Keywords already known from previously flagged reviews — don't re-alert these
    const existing = await prisma.review.findMany({
      where: { restaurantId, isRedFlag: true },
      select: { redFlagWords: true },
    });
    const knownKeywords = new Set(
      existing.flatMap((r) => (r.redFlagWords ?? '').split(', ').map((k) => k.trim())).filter(Boolean)
    );

    let flagged = 0;
    const newKeywords = new Set<string>();

    for (const review of reviews) {
      const matched = matchKeywords(review.text!);
      if (matched.length === 0) continue;

      await prisma.review.update({
        where: { id: review.id },
        data: { isRedFlag: true, redFlagWords: matched.join(', ') },
      });
      flagged++;
      matched.forEach((kw) => { if (!knownKeywords.has(kw)) newKeywords.add(kw); });
    }

    if (flagged > 0) logger.info(`[red-flag] ${restaurantId} — flagged ${flagged} reviews`);

    // Only alert on keyword types not seen before for this restaurant
    if (newKeywords.size > 0) {
      logger.info(`[red-flag] ${restaurantId} — new keywords: ${[...newKeywords].join(', ')}`);
      await this.sendAlert(restaurantId, [...newKeywords]);
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

  private async sendAlert(restaurantId: string, newKeywords: string[]): Promise<void> {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true },
    });
    if (!restaurant) return;

    await telegramService.sendAlert(
      `🚨 <b>NEW CRITICAL ISSUE — ${restaurant.name}</b>\n` +
      `New red flag keyword(s) detected in reviews:\n` +
      newKeywords.map((kw) => `• <i>${kw}</i>`).join('\n') +
      `\n\nImmediate attention needed.`
    );
  }
}

export const redFlagService = new RedFlagService();
