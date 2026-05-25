import { prisma } from '../db/client';
import { groqService } from './groq.service';
import { reviewService } from './review.service';
import { logger } from '../utils/logger';

function parseInsight(ins: {
  id: string;
  restaurantId: string;
  category: string;
  insight: string;
  priority: string;
  overallSentiment: string;
  evidenceCount: number;
  keyThemes: string | null;
  suggestedAction: string | null;
  impactScore: number | null;
  reviewPeriod: string | null;
  generatedAt: Date;
}) {
  let keyThemes: string[] = [];
  let reviewPeriod: unknown = null;
  try { keyThemes = ins.keyThemes ? JSON.parse(ins.keyThemes) : []; } catch { keyThemes = []; }
  try { reviewPeriod = ins.reviewPeriod ? JSON.parse(ins.reviewPeriod) : null; } catch { reviewPeriod = null; }
  return { ...ins, keyThemes, reviewPeriod };
}

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

class InsightService {
  async generateForRestaurant(restaurantId: string): Promise<number> {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true },
    });

    if (!restaurant) throw new Error(`Restaurant ${restaurantId} not found`);

    const reviews = await reviewService.getForInsights(restaurantId);
    if (reviews.length < 1) {
      logger.warn(`No reviews for ${restaurantId}, skipping insights`);
      return 0;
    }

    const result = await groqService.generateInsights(restaurant.name, reviews);

    // Snapshot current insights before replacing them
    await this.snapshotCurrentInsights(restaurantId);

    await prisma.$transaction(async (tx) => {
      await tx.actionableInsight.deleteMany({ where: { restaurantId } });
      await tx.actionableInsight.createMany({
        data: result.insights.map((ins) => ({
          restaurantId,
          category: ins.category,
          insight: ins.insight,
          priority: ins.priority,
          overallSentiment: ins.overallSentiment,
          evidenceCount: ins.evidenceCount,
          keyThemes: JSON.stringify(ins.keyThemes),
          suggestedAction: ins.suggestedAction,
          impactScore: ins.impactScore,
          reviewPeriod: JSON.stringify(result.reviewPeriod),
        })),
      });
    });

    logger.info(`Generated ${result.insights.length} insights for ${restaurant.name}`);
    return result.insights.length;
  }

  private async snapshotCurrentInsights(restaurantId: string): Promise<void> {
    const current = await prisma.actionableInsight.findMany({ where: { restaurantId } });
    if (current.length === 0) return;

    const weekStart = getMondayOf(new Date());

    await prisma.$transaction(async (tx) => {
      await tx.insightSnapshot.deleteMany({ where: { restaurantId, weekStart } });
      await tx.insightSnapshot.createMany({
        data: current.map((ins) => ({
          restaurantId,
          weekStart,
          category: ins.category,
          impactScore: ins.impactScore ?? 0,
          priority: ins.priority,
        })),
      });
    });

    logger.info(`Snapshotted ${current.length} insights for ${restaurantId} (week ${weekStart.toISOString().split('T')[0]})`);
  }

  async getInsightDiff(restaurantId: string) {
    const current = await prisma.actionableInsight.findMany({
      where: { restaurantId },
      orderBy: { impactScore: 'desc' },
    });

    const thisWeek = getMondayOf(new Date());
    const lastWeek = new Date(thisWeek);
    lastWeek.setUTCDate(lastWeek.getUTCDate() - 7);

    const prevSnapshots = await prisma.insightSnapshot.findMany({
      where: { restaurantId, weekStart: lastWeek },
    });

    const prevByCategory = new Map(prevSnapshots.map((s) => [s.category, s]));

    const diffed = current.map((ins) => {
      const parsed = parseInsight(ins);
      const prev = prevByCategory.get(ins.category);

      if (!prev) {
        return { ...parsed, delta: null, trend: 'new' as const };
      }

      const delta = (ins.impactScore ?? 0) - prev.impactScore;
      const trend =
        delta > 0.05 ? ('improved' as const)
        : delta < -0.05 ? ('worsened' as const)
        : ('stable' as const);

      return { ...parsed, delta: parseFloat(delta.toFixed(3)), trend };
    });

    const currentCategories = new Set(current.map((i) => i.category));
    const resolved = prevSnapshots
      .filter((s) => !currentCategories.has(s.category))
      .map((s) => ({ category: s.category, impactScore: s.impactScore, trend: 'resolved' as const }));

    return { insights: diffed, resolved, hasBaseline: prevSnapshots.length > 0 };
  }

  async getByRestaurant(restaurantId: string, priority?: string) {
    const rows = await prisma.actionableInsight.findMany({
      where: {
        restaurantId,
        ...(priority && { priority }),
      },
      orderBy: { impactScore: 'desc' },
    });
    return rows.map(parseInsight);
  }

  async getAllInsightsSummary() {
    const restaurants = await prisma.restaurant.findMany({
      where: { isActive: true },
      include: {
        insights: {
          orderBy: { impactScore: 'desc' },
          take: 3,
        },
        _count: { select: { reviews: true } },
      },
    });

    return restaurants.map((r) => ({
      id: r.id,
      name: r.name,
      address: r.address,
      rating: r.rating,
      googleMapsUrl: r.googleMapsUrl,
      zomatoUrl: r.zomatoUrl,
      reviewCount: r._count.reviews,
      topInsights: r.insights.map(parseInsight),
      lastScraped: r.lastScraped,
    }));
  }

  async extractDishMentions(restaurantId: string): Promise<number> {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true },
    });
    if (!restaurant) throw new Error(`Restaurant ${restaurantId} not found`);

    const reviews = await reviewService.getForInsights(restaurantId);
    if (reviews.length < 1) return 0;

    const result = await groqService.extractDishMentions(restaurant.name, reviews);

    if (result.dishes.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.dishMention.deleteMany({ where: { restaurantId } });
        await tx.dishMention.createMany({
          data: result.dishes.map((d) => ({
            restaurantId,
            dish: d.dish,
            mentions: d.mentions,
            positiveMentions: d.positiveMentions,
            negativeMentions: d.negativeMentions,
          })),
        });
      });
    }

    logger.info(`Extracted ${result.dishes.length} dish mentions for ${restaurant.name}`);
    return result.dishes.length;
  }

  async getDishMentions(restaurantId: string) {
    return prisma.dishMention.findMany({
      where: { restaurantId },
      orderBy: { mentions: 'desc' },
    });
  }

  async extractStaffMentions(restaurantId: string): Promise<number> {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true },
    });
    if (!restaurant) throw new Error(`Restaurant ${restaurantId} not found`);

    const reviews = await reviewService.getForInsights(restaurantId);
    if (reviews.length < 1) return 0;

    const result = await groqService.extractStaffMentions(restaurant.name, reviews);

    if (result.staff.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.staffMention.deleteMany({ where: { restaurantId } });
        await tx.staffMention.createMany({
          data: result.staff.map((s) => ({
            restaurantId,
            staffName: s.name,
            mentions: s.mentions,
            positiveMentions: s.positiveMentions,
            negativeMentions: s.negativeMentions,
          })),
        });
      });
    }

    logger.info(`Extracted ${result.staff.length} staff mentions for ${restaurant.name}`);
    return result.staff.length;
  }

  async getStaffMentions(restaurantId: string) {
    return prisma.staffMention.findMany({
      where: { restaurantId },
      orderBy: { mentions: 'desc' },
    });
  }
}

export const insightService = new InsightService();
