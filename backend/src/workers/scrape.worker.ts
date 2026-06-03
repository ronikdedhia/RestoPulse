import { Worker, Job } from 'bullmq';
import { createRedis } from '../config/redis';
import { config } from '../config';
import { apifyService } from '../services/apify.service';
import { restaurantService } from '../services/restaurant.service';
import { reviewService } from '../services/review.service';
import { velocityService } from '../services/velocity.service';
import { fakeReviewService } from '../services/fakeReview.service';
import { priceSensitivityService } from '../services/priceSensitivity.service';
import { redFlagService } from '../services/redFlag.service';
import { insightsQueue, scrapeQueue } from '../queues';
import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { ScrapeJobData } from '../types';
import { telegramService } from '../services/telegram.service';

async function handleDailyScrapeAll() {
  logger.info('[daily-cron] Triggered — queuing scrape jobs');

  const restaurants = await prisma.restaurant.findMany({
    where: { isActive: true },
    select: { id: true, googleMapsUrl: true, zomatoUrl: true },
  });

  let googleQueued = 0;
  let zomatoQueued = 0;

  for (const r of restaurants) {
    if (r.googleMapsUrl) {
      const jobRecord = await prisma.scrapeJob.create({
        data: { restaurantId: r.id, status: 'pending', jobType: 'scrape' },
      });
      await scrapeQueue.add(
        'scrape',
        { restaurantId: r.id, sourceUrl: r.googleMapsUrl, source: 'google', maxReviews: config.workers.maxReviewsPerRestaurant, jobDbId: jobRecord.id },
        { jobId: `scrape-google-${r.id}-${Date.now()}` }
      );
      googleQueued++;
    }

    if (r.zomatoUrl) {
      const jobRecord = await prisma.scrapeJob.create({
        data: { restaurantId: r.id, status: 'pending', jobType: 'scrape' },
      });
      await scrapeQueue.add(
        'scrape',
        { restaurantId: r.id, sourceUrl: r.zomatoUrl, source: 'zomato', maxReviews: config.workers.maxZomatoReviewsPerRestaurant, jobDbId: jobRecord.id },
        { jobId: `scrape-zomato-${r.id}-${Date.now()}` }
      );
      zomatoQueued++;
    }
  }

  logger.info(`[daily-cron] Queued ${googleQueued} Google + ${zomatoQueued} Zomato jobs across ${restaurants.length} restaurants`);

  const now = new Date();
  const dateIST = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
  await telegramService.sendDailyHeartbeat({ restaurants: restaurants.length, googleQueued, zomatoQueued, dateIST });

  return { google: googleQueued, zomato: zomatoQueued };
}

export function createScrapeWorker() {
  const worker = new Worker<ScrapeJobData>(
    'scrape',
    async (job: Job<ScrapeJobData>) => {
      logger.info(`[scrape-worker] Picked up job id=${job.id} name=${job.name}`);

      if (job.name === 'daily-scrape-all') {
        return handleDailyScrapeAll();
      }

      const { restaurantId, sourceUrl, source = 'google', maxReviews = config.workers.maxReviewsPerRestaurant, jobDbId } = job.data;

      logger.info(`[scrape] Processing restaurantId=${restaurantId} source=${source}`);

      if (jobDbId) {
        await prisma.scrapeJob.update({
          where: { id: jobDbId },
          data: { status: 'running', startedAt: new Date() },
        });
      }

      try {
        let saved = 0;

        if (source === 'zomato') {
          const reviews = await apifyService.scrapeZomatoRestaurant(sourceUrl, maxReviews ?? config.workers.maxZomatoReviewsPerRestaurant);
          saved = await reviewService.batchUpsertZomato(restaurantId, reviews);
        } else {
          const { reviews, meta } = await apifyService.scrapeRestaurant(sourceUrl, maxReviews);
          saved = await reviewService.batchUpsert(restaurantId, reviews);
          if (meta) await restaurantService.upsertFromApify(restaurantId, meta);
        }

        await restaurantService.updateLastScraped(restaurantId);

        // Velocity + fake review scoring — non-fatal
        try {
          await velocityService.compute(restaurantId);
        } catch (velErr) {
          logger.warn(`[scrape-worker] Velocity compute failed for ${restaurantId}: ${velErr instanceof Error ? velErr.message : String(velErr)}`);
        }

        try {
          await fakeReviewService.scoreReviews(restaurantId);
        } catch (fakeErr) {
          logger.warn(`[scrape-worker] Fake review scoring failed for ${restaurantId}: ${fakeErr instanceof Error ? fakeErr.message : String(fakeErr)}`);
        }

        try {
          await priceSensitivityService.compute(restaurantId);
        } catch (priceErr) {
          logger.warn(`[scrape-worker] Price sensitivity compute failed for ${restaurantId}: ${priceErr instanceof Error ? priceErr.message : String(priceErr)}`);
        }

        try {
          await redFlagService.scan(restaurantId);
        } catch (rfErr) {
          logger.warn(`[scrape-worker] Red flag scan failed for ${restaurantId}: ${rfErr instanceof Error ? rfErr.message : String(rfErr)}`);
        }

        if (jobDbId) {
          await prisma.scrapeJob.update({
            where: { id: jobDbId },
            data: { status: 'completed', completedAt: new Date(), reviewsFound: saved },
          });
        }

        await insightsQueue.add(
          'generate',
          { restaurantId },
          { jobId: `insights-${restaurantId}-${Date.now()}` }
        );

        return { saved };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);

        if (jobDbId) {
          await prisma.scrapeJob.update({
            where: { id: jobDbId },
            data: { status: 'failed', completedAt: new Date(), error: msg },
          });
        }

        throw error;
      }
    },
    {
      connection: createRedis(),
      concurrency: config.workers.scrapeConcurrency,
    }
  );

  worker.on('active', (job) => {
    logger.info(`[scrape-worker] Job active id=${job.id} name=${job.name}`);
  });

  worker.on('completed', (job, result) => {
    logger.info(`[scrape-worker] Job ${job.id} (${job.name}) completed — saved=${result?.saved ?? 0}`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`[scrape-worker] Job ${job?.id} (${job?.name}) failed: ${err.message}`);
  });

  worker.on('stalled', (jobId) => {
    logger.warn(`[scrape-worker] Job ${jobId} stalled`);
  });

  worker.on('error', (err) => {
    logger.error(`[scrape-worker] Worker error: ${err.message}`);
  });

  logger.info('[scrape-worker] Worker created and listening on queue "scrape"');
  return worker;
}
