import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { telegramService } from './telegram.service';

const WEEKS_FOR_PERSISTENT = 3;

class EscalationService {
  async check(restaurantId: string): Promise<void> {
    // Get up to 4 most recent distinct weekStarts from snapshots
    const weekRows = await prisma.insightSnapshot.findMany({
      where: { restaurantId },
      select: { weekStart: true },
      distinct: ['weekStart'],
      orderBy: { weekStart: 'desc' },
      take: 4,
    });

    if (weekRows.length < WEEKS_FOR_PERSISTENT) return;

    const weekStartDates = weekRows.map((w) => w.weekStart);

    const snapshots = await prisma.insightSnapshot.findMany({
      where: { restaurantId, weekStart: { in: weekStartDates } },
    });

    // Tally appearances per category
    const categoryStats = new Map<string, { weeks: Set<string>; totalScore: number }>();
    for (const snap of snapshots) {
      const key = snap.weekStart.toISOString();
      if (!categoryStats.has(snap.category)) {
        categoryStats.set(snap.category, { weeks: new Set(), totalScore: 0 });
      }
      const entry = categoryStats.get(snap.category)!;
      entry.weeks.add(key);
      entry.totalScore += snap.impactScore;
    }

    const currentInsights = await prisma.actionableInsight.findMany({
      where: { restaurantId },
      select: { category: true },
    });
    const currentCategories = new Set(currentInsights.map((i) => i.category));

    const now = new Date();
    const persistentCategories = new Set<string>();

    for (const [category, stats] of categoryStats) {
      if (stats.weeks.size < WEEKS_FOR_PERSISTENT) continue;

      persistentCategories.add(category);
      const avgImpactScore = stats.totalScore / snapshots.filter((s) => s.category === category).length;
      const isActive = currentCategories.has(category);

      const existing = await prisma.persistentIssue.findUnique({
        where: { restaurantId_category: { restaurantId, category } },
        select: { weeksSeen: true },
      });

      await prisma.persistentIssue.upsert({
        where: { restaurantId_category: { restaurantId, category } },
        update: {
          weeksSeen: stats.weeks.size,
          lastSeenAt: now,
          avgImpactScore,
          isActive,
          resolvedAt: isActive ? null : now,
        },
        create: {
          restaurantId,
          category,
          weeksSeen: stats.weeks.size,
          avgImpactScore,
          isActive,
          firstSeenAt: now,
          lastSeenAt: now,
          resolvedAt: isActive ? null : now,
        },
      });

      // Fire Telegram alert when crossing week 6 threshold
      if (stats.weeks.size >= 6 && (existing?.weeksSeen ?? 0) < 6) {
        const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true } });
        await telegramService.sendAlert(
          `🔁 <b>${restaurant?.name ?? restaurantId}</b>\nPersistent issue: <b>${category.replace(/_/g, ' ')}</b> flagged for ${stats.weeks.size} consecutive weeks. Needs owner attention.`
        );
      }
    }

    // Resolve persistent issues for categories that are no longer persistent
    await prisma.persistentIssue.updateMany({
      where: {
        restaurantId,
        isActive: true,
        category: { notIn: [...persistentCategories] },
      },
      data: { isActive: false, resolvedAt: now },
    });

    if (persistentCategories.size > 0) {
      logger.info(`[escalation] ${restaurantId} — ${persistentCategories.size} persistent issues: ${[...persistentCategories].join(', ')}`);
    }
  }

  async getForRestaurant(restaurantId: string) {
    return prisma.persistentIssue.findMany({
      where: { restaurantId, isActive: true },
      orderBy: { weeksSeen: 'desc' },
    });
  }
}

export const escalationService = new EscalationService();
