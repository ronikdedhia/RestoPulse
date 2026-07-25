import { Worker, Job } from 'bullmq';
import { createRedis } from '../config/redis';
import { emailService } from '../services/email.service';
import { logger } from '../utils/logger';
import { attachRedisQuotaGuard } from '../utils/redisQuotaGuard';

export function createDigestWorker() {
  const worker = new Worker(
    'digest',
    async (job: Job) => {
      if (job.name === 'weekly-digest-all') {
        logger.info('[digest-worker] Sending weekly digests to all restaurants');
        const result = await emailService.sendDigestToAll();
        logger.info(`[digest-worker] Done — sent=${result.sent} skipped=${result.skipped} failed=${result.failed}`);
        return result;
      }
    },
    { connection: createRedis(), concurrency: 1, drainDelay: 300, stalledInterval: 300_000 }
  );

  worker.on('completed', (job, result) => {
    logger.info(`[digest-worker] Job ${job.id} completed — ${JSON.stringify(result)}`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`[digest-worker] Job ${job?.id} failed: ${err.message}`);
  });

  attachRedisQuotaGuard(worker, 'digest-worker');

  logger.info('[digest-worker] Ready');
  return worker;
}
