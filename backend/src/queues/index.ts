import { Queue } from 'bullmq';
import { createRedis } from '../config/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { ScrapeJobData, InsightsJobData } from '../types';

// NEWSLETTER_SEND_TIME is HH:MM UTC (default 07:30 = Monday 1pm IST)
function buildDigestCron(): string {
  const [hh, mm] = config.brevo.newsletterSendTime.split(':').map(Number);
  if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    logger.warn(`[cron] Invalid NEWSLETTER_SEND_TIME "${config.brevo.newsletterSendTime}", falling back to 07:30 UTC`);
    return '30 7 * * 1';
  }
  return `${mm} ${hh} * * 1`;
}

const WEEKLY_DIGEST_CRON = buildDigestCron();

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

export const digestQueue = new Queue('digest', {
  connection: createRedis(),
  defaultJobOptions: { attempts: 2, removeOnComplete: 10, removeOnFail: 20 },
});

export async function initQueues() {
  await Promise.all([scrapeQueue.waitUntilReady(), insightsQueue.waitUntilReady(), digestQueue.waitUntilReady()]);
  logger.info('BullMQ queues ready');
}

export async function scheduleWeeklyDigest() {
  const existing = await digestQueue.getRepeatableJobs();

  for (const job of existing) {
    if (job.name === 'weekly-digest-all') {
      if (job.pattern === WEEKLY_DIGEST_CRON) {
        logger.info(`[cron] weekly-digest-all already registered, next run: ${job.next ? new Date(job.next).toISOString() : 'unknown'}`);
        return;
      }
      await digestQueue.removeRepeatableByKey(job.key);
    }
  }

  await digestQueue.add('weekly-digest-all', {}, { repeat: { pattern: WEEKLY_DIGEST_CRON } });
  logger.info(`[cron] weekly-digest-all registered — pattern: "${WEEKLY_DIGEST_CRON}"`);
}

const CRON_PATTERN = '30 6 * * *'; // 12:00 PM IST (UTC+5:30)

export async function scheduleDailyCron() {
  const existing = await scrapeQueue.getRepeatableJobs();
  logger.info(`[cron] Existing repeatable jobs: ${JSON.stringify(existing.map(j => ({ name: j.name, pattern: j.pattern, next: j.next })))}`);

  // Remove stale registrations so pattern changes take effect
  for (const job of existing) {
    if (job.name === 'daily-scrape-all') {
      if (job.pattern === CRON_PATTERN) {
        logger.info(`[cron] daily-scrape-all already registered with correct pattern "${CRON_PATTERN}", next run: ${job.next ? new Date(job.next).toISOString() : 'unknown'}`);
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
