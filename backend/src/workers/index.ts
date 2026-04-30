import { createScrapeWorker } from './scrape.worker';
import { createInsightsWorker } from './insights.worker';
import { logger } from '../utils/logger';

export function startWorkers() {
  const scrapeWorker = createScrapeWorker();
  const insightsWorker = createInsightsWorker();

  process.on('SIGTERM', async () => {
    logger.info('Shutting down workers...');
    await Promise.all([scrapeWorker.close(), insightsWorker.close()]);
  });

  logger.info('Workers started: scrape, insights');
}
