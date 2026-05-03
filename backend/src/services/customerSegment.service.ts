import { prisma } from '../db/client';

const SEGMENTS = {
  families: {
    label: 'Families',
    keywords: ['family', 'kids', 'children', 'child', 'baby', 'toddler', 'nephew', 'niece', 'brought my kid', 'family outing'],
  },
  couples: {
    label: 'Couples',
    keywords: ['date night', 'anniversary', 'romantic', 'with my wife', 'with my husband', 'girlfriend', 'boyfriend', 'partner', 'better half', 'date with'],
  },
  office: {
    label: 'Office Crowd',
    keywords: ['office lunch', 'team lunch', 'colleagues', 'corporate', 'business lunch', 'office team', 'team outing', 'office party', 'with colleagues', 'work lunch'],
  },
  groups: {
    label: 'Groups & Celebrations',
    keywords: ['birthday', 'celebration', 'gang', 'reunion', 'bachelorette', 'group of friends', 'get-together', 'kitty party', 'farewell'],
  },
  solo: {
    label: 'Solo / Quick Bites',
    keywords: ['solo', 'alone', 'quick bite', 'quick lunch', 'by myself', 'grabbed a quick', 'quick stop', 'takeaway', 'take away', 'parcel'],
  },
} as const;

type SegmentKey = keyof typeof SEGMENTS;

function matchSegments(text: string): SegmentKey[] {
  const lower = text.toLowerCase();
  return (Object.keys(SEGMENTS) as SegmentKey[]).filter((key) =>
    SEGMENTS[key].keywords.some((kw) => lower.includes(kw))
  );
}

export interface SegmentResult {
  key: string;
  label: string;
  mentionCount: number;
  avgRating: number;
  positiveRate: number | null;
  positiveCount: number;
  negativeCount: number;
}

class CustomerSegmentService {
  async analyze(restaurantId: string): Promise<SegmentResult[]> {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const reviews = await prisma.review.findMany({
      where: { restaurantId, text: { not: null }, reviewDate: { gte: sixtyDaysAgo } },
      select: { rating: true, sentiment: true, text: true },
    });

    if (reviews.length === 0) return [];

    const acc: Record<string, { ratings: number[]; sentiments: string[] }> = {};

    for (const review of reviews) {
      for (const seg of matchSegments(review.text!)) {
        if (!acc[seg]) acc[seg] = { ratings: [], sentiments: [] };
        acc[seg].ratings.push(review.rating);
        if (review.sentiment) acc[seg].sentiments.push(review.sentiment);
      }
    }

    return (Object.keys(SEGMENTS) as SegmentKey[])
      .filter((key) => acc[key] && acc[key].ratings.length >= 2)
      .map((key) => {
        const { ratings, sentiments } = acc[key];
        const avgRating = ratings.reduce((s, r) => s + r, 0) / ratings.length;
        const positiveCount = sentiments.filter((s) => s === 'positive').length;
        const negativeCount = sentiments.filter((s) => s === 'negative').length;
        const positiveRate = sentiments.length > 0 ? Math.round((positiveCount / sentiments.length) * 100) : null;

        return {
          key,
          label: SEGMENTS[key].label,
          mentionCount: ratings.length,
          avgRating: Math.round(avgRating * 10) / 10,
          positiveRate,
          positiveCount,
          negativeCount,
        };
      })
      .sort((a, b) => b.mentionCount - a.mentionCount);
  }
}

export const customerSegmentService = new CustomerSegmentService();
