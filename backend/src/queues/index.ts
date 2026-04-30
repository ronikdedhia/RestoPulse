import { Queue } from 'bullmq';
import { createRedis } from '../config/redis';
import { logger } from '../utils/logger';
import { ScrapeJobData, InsightsJobData } from '../types';

export const scrapeQueue = new Queue<ScrapeJobData>('scrape', {
  connection: createRedis(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export const insightsQueue = new Queue<InsightsJobData>('insights', {
  connection: createRedis(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export async function initQueues() {
  await Promise.all([scrapeQueue.waitUntilReady(), insightsQueue.waitUntilReady()]);
  logger.info('BullMQ queues ready');
}

const CRON_PATTERN = '04 12 * * *';

export async function scheduleDailyCron() {
  const existing = await scrapeQueue.getRepeatableJobs();
  logger.info(`[cron] Existing repeatable jobs: ${JSON.stringify(existing.map(j => ({ name: j.name, pattern: j.pattern, next: j.next })))}`);

  // Remove stale registrations so pattern changes take effect
  for (const job of existing) {
    if (job.name === 'daily-scrape-all') {
      if (job.pattern === CRON_PATTERN) {
        logger.info(`[cron] daily-scrape-all already registered with correct pattern "${CRON_PATTERN}", next run: ${new Date(job.next).toISOString()}`);
        return;
      }
      logger.warn(`[cron] Removing stale daily-scrape-all with pattern "${job.pattern}"`);
      await scrapeQueue.removeRepeatableByKey(job.key);
    }
  }

  const added = await scrapeQueue.add(
    'daily-scrape-all',
    {} as ScrapeJobData,
    { repeat: { pattern: CRON_PATTERN } }
  );
  logger.info(`[cron] daily-scrape-all registered — pattern: "${CRON_PATTERN}", jobId: ${added.id}`);
}
