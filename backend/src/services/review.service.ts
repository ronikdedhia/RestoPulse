import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { ApifyReview, ZomatoReview } from '../types';
import { huggingFaceService } from './huggingFace.service';

class ReviewService {
  async batchUpsert(restaurantId: string, reviews: ApifyReview[]): Promise<number> {
    let saved = 0;

    for (const review of reviews) {
      try {
        const externalId = review.reviewId ?? `${restaurantId}-${review.name}-${review.publishedAtDate}`;

        await prisma.review.upsert({
          where: { externalId },
          update: {},
          create: {
            restaurantId,
            externalId,
            reviewerName: review.name,
            rating: review.stars,
            text: review.text,
            reviewDate: review.publishedAtDate ? new Date(review.publishedAtDate) : null,
            language: review.language,
          },
        });

        saved++;
      } catch (err) {
        logger.warn(`Failed to save review: ${err}`);
      }
    }

    logger.info(`Saved ${saved}/${reviews.length} reviews for ${restaurantId}`);
    await this.backfillSentiment(restaurantId);
    return saved;
  }

  async batchUpsertZomato(restaurantId: string, reviews: ZomatoReview[]): Promise<number> {
    let saved = 0;

    for (const review of reviews) {
      try {
        const id = review.reviewId ?? review.id;
        const text = review.review ?? review.text ?? review.reviewText;
        const rawRating = review.rating ?? review.stars;
        const rating = rawRating ? Math.round(rawRating) : null;
        const dateStr = review.timestamp ?? review.reviewDate ?? review.publishedAt;
        const reviewerName = review.reviewerName ?? review.name;

        if (!rating) { logger.warn('[review] Zomato review missing rating, skipping'); continue; }

        const externalId = id ? `zomato-${id}` : `zomato-${restaurantId}-${reviewerName}-${dateStr}`;

        await prisma.review.upsert({
          where: { externalId },
          update: {},
          create: {
            restaurantId,
            externalId,
            reviewerName,
            rating,
            text,
            reviewDate: dateStr ? new Date(dateStr) : null,
            source: 'zomato',
          },
        });
        saved++;
      } catch (err) {
        logger.warn(`[review] Failed to save Zomato review: ${err}`);
      }
    }

    logger.info(`[review] Saved ${saved}/${reviews.length} Zomato reviews for ${restaurantId}`);
    await this.backfillSentiment(restaurantId);
    return saved;
  }

  async backfillSentiment(restaurantId: string): Promise<void> {
    const unscored = await prisma.review.findMany({
      where: { restaurantId, sentiment: null, text: { not: null } },
      select: { id: true, text: true },
    });

    if (unscored.length === 0) return;

    logger.info(`[hf] Scoring sentiment for ${unscored.length} reviews (${restaurantId})`);

    const texts = unscored.map((r) => r.text!);
    const sentiments = await huggingFaceService.analyzeSentimentBatch(texts);

    for (let i = 0; i < unscored.length; i++) {
      const sentiment = sentiments[i];
      if (!sentiment) continue;
      await prisma.review.update({
        where: { id: unscored[i].id },
        data: { sentiment },
      });
    }

    logger.info(`[hf] Sentiment backfill done for ${restaurantId}`);
  }

  async getByRestaurant(
    restaurantId: string,
    opts: { page?: number; limit?: number; minRating?: number; maxRating?: number } = {}
  ) {
    const { page = 1, limit = 50, minRating, maxRating } = opts;

    return prisma.review.findMany({
      where: {
        restaurantId,
        ...(minRating !== undefined && { rating: { gte: minRating } }),
        ...(maxRating !== undefined && { rating: { lte: maxRating } }),
      },
      orderBy: { reviewDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async getForInsights(restaurantId: string, limit = 200) {
    return prisma.review.findMany({
      where: { restaurantId, text: { not: null } },
      orderBy: { reviewDate: 'desc' },
      take: limit,
      select: { rating: true, text: true, reviewDate: true },
    });
  }

  async getRatingDistribution(restaurantId: string) {
    const distribution = await prisma.review.groupBy({
      by: ['rating'],
      where: { restaurantId },
      _count: { rating: true },
      orderBy: { rating: 'asc' },
    });

    return distribution.map((d) => ({ rating: d.rating, count: d._count.rating }));
  }

  async getStats(restaurantId: string) {
    const [total, avgRating, distribution] = await Promise.all([
      prisma.review.count({ where: { restaurantId } }),
      prisma.review.aggregate({
        where: { restaurantId },
        _avg: { rating: true },
      }),
      this.getRatingDistribution(restaurantId),
    ]);

    return { total, avgRating: avgRating._avg.rating, distribution };
  }
}

export const reviewService = new ReviewService();
