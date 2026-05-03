import { prisma } from '../db/client';

const RATING_THRESHOLD = 0.5;
const SENTIMENT_THRESHOLD = 0.20;

export interface SourceStats {
  avgRating: number;
  reviewCount: number;
  positiveRate: number;
}

export interface DivergenceResult {
  hasDivergence: boolean;
  google: SourceStats | null;
  zomato: SourceStats | null;
  ratingDiff: number;
  sentimentDiff: number;
  message: string | null;
}

function stats(reviews: { rating: number; sentiment: string | null }[]): SourceStats {
  const avgRating = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  const withSentiment = reviews.filter((r) => r.sentiment);
  const positive = withSentiment.filter((r) => r.sentiment === 'positive').length;
  const positiveRate = withSentiment.length > 0 ? positive / withSentiment.length : 0;
  return {
    avgRating: Math.round(avgRating * 10) / 10,
    reviewCount: reviews.length,
    positiveRate: Math.round(positiveRate * 100) / 100,
  };
}

class DivergenceService {
  async compute(restaurantId: string): Promise<DivergenceResult> {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const reviews = await prisma.review.findMany({
      where: { restaurantId, reviewDate: { gte: ninetyDaysAgo } },
      select: { rating: true, sentiment: true, source: true },
    });

    const googleReviews = reviews.filter((r) => r.source === 'google_maps' || r.source === 'google');
    const zomatoReviews = reviews.filter((r) => r.source === 'zomato');

    if (googleReviews.length < 3 || zomatoReviews.length < 3) {
      return { hasDivergence: false, google: null, zomato: null, ratingDiff: 0, sentimentDiff: 0, message: null };
    }

    const google = stats(googleReviews);
    const zomato = stats(zomatoReviews);

    const ratingDiff = Math.round(Math.abs(google.avgRating - zomato.avgRating) * 10) / 10;
    const sentimentDiff = Math.round(Math.abs(google.positiveRate - zomato.positiveRate) * 100);

    const hasDivergence = ratingDiff >= RATING_THRESHOLD || sentimentDiff >= SENTIMENT_THRESHOLD * 100;

    let message: string | null = null;
    if (hasDivergence) {
      const betterPlatform = google.avgRating >= zomato.avgRating ? 'Google Maps' : 'Zomato';
      const worserPlatform = betterPlatform === 'Google Maps' ? 'Zomato' : 'Google Maps';
      const betterRating = betterPlatform === 'Google Maps' ? google.avgRating : zomato.avgRating;
      const worseRating = betterPlatform === 'Google Maps' ? zomato.avgRating : google.avgRating;

      message = `${betterPlatform} rates ${betterRating}★ vs ${worserPlatform} at ${worseRating}★ — `;
      message += worserPlatform === 'Zomato'
        ? 'delivery/packaging experience lags behind dine-in.'
        : 'dine-in experience lags behind delivery.';
    }

    return { hasDivergence, google, zomato, ratingDiff, sentimentDiff, message };
  }
}

export const divergenceService = new DivergenceService();
