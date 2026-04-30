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
  return {
    ...ins,
    keyThemes: ins.keyThemes ? JSON.parse(ins.keyThemes) : [],
    reviewPeriod: ins.reviewPeriod ? JSON.parse(ins.reviewPeriod) : null,
  };
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

    await prisma.actionableInsight.deleteMany({ where: { restaurantId } });

    await prisma.actionableInsight.createMany({
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

    logger.info(`Generated ${result.insights.length} insights for ${restaurant.name}`);
    return result.insights.length;
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
}

export const insightService = new InsightService();
