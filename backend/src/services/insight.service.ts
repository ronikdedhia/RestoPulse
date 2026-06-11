import { prisma } from '../db/client';

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

  async getDishMentions(restaurantId: string) {
    return prisma.dishMention.findMany({
      where: { restaurantId },
      orderBy: { mentions: 'desc' },
    });
  }

  async getStaffMentions(restaurantId: string) {
    return prisma.staffMention.findMany({
      where: { restaurantId },
      orderBy: { mentions: 'desc' },
    });
  }
}

export const insightService = new InsightService();
