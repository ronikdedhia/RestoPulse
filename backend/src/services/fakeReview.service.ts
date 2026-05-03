import { prisma } from '../db/client';
import { logger } from '../utils/logger';

const NEGATIVE_KEYWORDS = ['terrible', 'awful', 'horrible', 'worst', 'disgusting', 'pathetic', 'dirty', 'rude', 'cold food', 'raw', 'cockroach', 'food poisoning', 'never again', 'waste of money'];
const POSITIVE_KEYWORDS = ['amazing', 'excellent', 'outstanding', 'fantastic', 'wonderful', 'best ever', 'love this', 'highly recommend', 'perfect', 'brilliant'];

function containsAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function scoreReview(review: {
  rating: number;
  text: string | null;
  reviewDate: Date | null;
  reviewerName: string | null;
}): { score: number; flags: string[] } {
  let score = 1.0;
  const flags: string[] = [];

  // No text
  if (!review.text || review.text.trim().length === 0) {
    score -= 0.2;
    flags.push('no_text');
  } else {
    const len = review.text.trim().length;

    // Very short text
    if (len < 20) {
      score -= 0.25;
      flags.push('very_short_text');
    } else if (len < 50) {
      score -= 0.1;
      flags.push('short_text');
    }

    // Rating vs text sentiment mismatch
    if (review.rating === 5 && containsAny(review.text, NEGATIVE_KEYWORDS)) {
      score -= 0.35;
      flags.push('rating_text_mismatch_high');
    }
    if (review.rating === 1 && containsAny(review.text, POSITIVE_KEYWORDS)) {
      score -= 0.35;
      flags.push('rating_text_mismatch_low');
    }

    // Extremely generic text (very short + only common words)
    const words = review.text.trim().split(/\s+/);
    if (words.length <= 5 && review.rating === 5) {
      score -= 0.15;
      flags.push('generic_positive');
    }
  }

  // No reviewer name
  if (!review.reviewerName || review.reviewerName.trim().length === 0) {
    score -= 0.1;
    flags.push('no_reviewer_name');
  }

  return { score: Math.max(0, Math.min(1, score)), flags };
}

class FakeReviewService {
  async scoreReviews(restaurantId: string): Promise<number> {
    const reviews = await prisma.review.findMany({
      where: { restaurantId },
      select: { id: true, rating: true, text: true, reviewDate: true, reviewerName: true },
    });

    if (reviews.length === 0) return 0;

    // Burst detection: days with unusually many reviews
    const countByDate = new Map<string, number>();
    for (const r of reviews) {
      if (!r.reviewDate) continue;
      const key = r.reviewDate.toISOString().split('T')[0];
      countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
    }
    const avgPerDay = [...countByDate.values()].reduce((a, b) => a + b, 0) / (countByDate.size || 1);
    const burstThreshold = Math.max(5, avgPerDay * 3);
    const burstDates = new Set([...countByDate.entries()].filter(([, c]) => c >= burstThreshold).map(([d]) => d));

    let flagged = 0;

    for (const review of reviews) {
      const { score, flags } = scoreReview(review);

      // Burst flag
      if (review.reviewDate) {
        const key = review.reviewDate.toISOString().split('T')[0];
        if (burstDates.has(key)) {
          flags.push('burst_timing');
        }
      }

      const burstPenalty = flags.includes('burst_timing') ? 0.2 : 0;
      const finalScore = Math.max(0, score - burstPenalty);
      const isSuspicious = finalScore < 0.5;
      if (isSuspicious) flagged++;

      await prisma.fakeReviewScore.upsert({
        where: { reviewId: review.id },
        update: {
          authenticityScore: finalScore,
          flags: JSON.stringify(flags),
          isSuspicious,
          scoredAt: new Date(),
        },
        create: {
          reviewId: review.id,
          restaurantId,
          authenticityScore: finalScore,
          flags: JSON.stringify(flags),
          isSuspicious,
        },
      });
    }

    logger.info(`[fake-review] Scored ${reviews.length} reviews for ${restaurantId} — ${flagged} suspicious`);
    return flagged;
  }

  async getSuspiciousReviews(restaurantId: string) {
    const [scores, total] = await Promise.all([
      prisma.fakeReviewScore.findMany({
        where: { restaurantId, isSuspicious: true },
        include: {
          review: {
            select: { rating: true, text: true, reviewDate: true, reviewerName: true, source: true },
          },
        },
        orderBy: { authenticityScore: 'asc' },
      }),
      prisma.fakeReviewScore.count({ where: { restaurantId } }),
    ]);

    return {
      suspicious: scores.map((s) => ({
        ...s,
        flags: s.flags ? JSON.parse(s.flags) : [],
      })),
      summary: {
        total,
        suspiciousCount: scores.length,
        suspiciousRate: total > 0 ? scores.length / total : 0,
      },
    };
  }
}

export const fakeReviewService = new FakeReviewService();
