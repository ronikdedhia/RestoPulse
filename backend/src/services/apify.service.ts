import axios from 'axios';
import axiosRetry from 'axios-retry';
import { config } from '../config';
import { logger } from '../utils/logger';
import { ApifyReview, ApifyReviewSchema, ApifyRestaurantMeta, ZomatoReview, ZomatoReviewSchema } from '../types';

const client = axios.create({
  baseURL: 'https://api.apify.com/v2',
  headers: { Authorization: `Bearer ${config.apify.token}` },
  timeout: 300_000,
});

axiosRetry(client, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (err) => axiosRetry.isNetworkOrIdempotentRequestError(err) || err.response?.status === 429,
});

export interface ScrapeResult {
  reviews: ApifyReview[];
  meta: ApifyRestaurantMeta | null;
}

class ApifyService {
  async scrapeRestaurant(googleMapsUrl: string, maxReviews: number, startDate?: string): Promise<ScrapeResult> {
    logger.info(`Starting Apify scrape: ${googleMapsUrl}${startDate ? ` from ${startDate}` : ' (all reviews)'}`);

    const body: Record<string, unknown> = {
      startUrls: [{ url: googleMapsUrl }],
      maxReviews,
      reviewsSort: 'newest',
      language: 'en',
      personalData: true,
    };
    if (startDate) body.reviewsStartDate = startDate;

    const runRes = await client.post(`/acts/${config.apify.actorId}/runs`, body);
    logger.info(`[apify] Scraping max ${maxReviews} reviews${startDate ? ` from ${startDate}` : ''}`);

    const runId: string = runRes.data.data.id;
    logger.debug(`Apify run started: ${runId}`);

    await this.waitForRun(runId);

    const datasetId: string = runRes.data.data.defaultDatasetId;
    const items = await this.fetchDataset(datasetId);

    return this.parseResult(items);
  }

  private async waitForRun(runId: string, pollMs = 5000, maxWaitMs = 240_000): Promise<void> {
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      const res = await client.get(`/actor-runs/${runId}`);
      const status: string = res.data.data.status;

      if (status === 'SUCCEEDED') return;
      if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
        throw new Error(`Apify run ${runId} ended with status: ${status}`);
      }

      await new Promise((r) => setTimeout(r, pollMs));
    }

    throw new Error(`Apify run ${runId} timed out after ${maxWaitMs}ms`);
  }

  private async fetchDataset(datasetId: string): Promise<unknown[]> {
    const res = await client.get(`/datasets/${datasetId}/items`, {
      params: { clean: true, format: 'json' },
    });
    if (!Array.isArray(res.data)) {
      throw new Error(`Apify dataset returned non-array: ${JSON.stringify(res.data).slice(0, 120)}`);
    }
    return res.data;
  }

  private parseResult(items: unknown[]): ScrapeResult {
    const reviews: ApifyReview[] = [];
    let meta: ApifyRestaurantMeta | null = null;

    for (const item of items) {
      const parsed = ApifyReviewSchema.safeParse(item);
      if (!parsed.success) {
        logger.warn(`Skipping malformed review: ${parsed.error.message}`);
        continue;
      }

      reviews.push(parsed.data);

      // Extract restaurant metadata from the first valid item
      if (!meta && parsed.data.placeId) {
        meta = {
          placeId: parsed.data.placeId,
          rating: parsed.data.totalScore,
          totalReviews: parsed.data.reviewsCount,
          imageUrl: parsed.data.imageUrl,
          cuisine: parsed.data.categoryName,
          priceLevel: parsed.data.price,
        };
      }
    }

    return { reviews, meta };
  }

  async scrapeZomatoRestaurant(zomatoUrl: string, maxItems: number): Promise<ZomatoReview[]> {
    logger.info(`[apify-zomato] Starting scrape: ${zomatoUrl} (max ${maxItems})`);

    const runRes = await client.post(`/acts/${config.apify.zomatoActorId}/runs`, {
      restaurantUrls: [zomatoUrl],
      maxItems,
      proxyConfiguration: { useApifyProxy: true },
    });

    const runId: string = runRes.data.data.id;
    await this.waitForRun(runId);

    const datasetId: string = runRes.data.data.defaultDatasetId;
    const items = await this.fetchDataset(datasetId);

    const reviews: ZomatoReview[] = [];
    for (const item of items) {
      const parsed = ZomatoReviewSchema.safeParse(item);
      if (parsed.success) reviews.push(parsed.data);
      else logger.warn(`[apify-zomato] Skipping malformed item: ${parsed.error.message}`);
    }

    logger.info(`[apify-zomato] Got ${reviews.length} reviews from Zomato`);
    return reviews;
  }
}

export const apifyService = new ApifyService();
