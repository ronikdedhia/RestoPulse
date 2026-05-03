import { createScrapeWorker } from './scrape.worker';
import { createInsightsWorker } from './insights.worker';
import { createDigestWorker } from './digest.worker';
import { logger } from '../utils/logger';

export function startWorkers() {
  const scrapeWorker = createScrapeWorker();
  const insightsWorker = createInsightsWorker();
  const digestWorker = createDigestWorker();

  process.on('SIGTERM', async () => {
    logger.info('Shutting down workers...');
    await Promise.all([scrapeWorker.close(), insightsWorker.close(), digestWorker.close()]);
  });

  logger.info('Workers started: scrape, insights, digest');
}
