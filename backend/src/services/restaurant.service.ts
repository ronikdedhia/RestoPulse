import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { ApifyRestaurantMeta } from '../types';

class RestaurantService {
  async getAll() {
    return prisma.restaurant.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { reviews: true, insights: true } },
      },
    });
  }

  async getById(id: string) {
    return prisma.restaurant.findUnique({
      where: { id },
      include: {
        _count: { select: { reviews: true, insights: true } },
        insights: {
          orderBy: { impactScore: 'desc' },
          take: 10,
        },
      },
    });
  }

  async create(data: {
    name: string;
    address: string;
    googleMapsUrl?: string;
    zomatoUrl?: string;
    cuisine?: string;
    priceLevel?: string;
  }) {
    return prisma.restaurant.create({ data });
  }

  async upsertFromApify(restaurantId: string, meta: ApifyRestaurantMeta) {
    return prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        ...(meta.placeId && { placeId: meta.placeId }),
        ...(meta.rating !== undefined && { rating: meta.rating }),
        ...(meta.totalReviews !== undefined && { totalReviews: meta.totalReviews }),
        ...(meta.imageUrl && { imageUrl: meta.imageUrl }),
        ...(meta.cuisine && { cuisine: meta.cuisine }),
        ...(meta.priceLevel && { priceLevel: meta.priceLevel }),
        updatedAt: new Date(),
      },
    });
  }

  async updateLastScraped(id: string) {
    return prisma.restaurant.update({
      where: { id },
      data: { lastScraped: new Date() },
    });
  }


}

export const restaurantService = new RestaurantService();
