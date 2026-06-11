import { Worker, Job } from 'bullmq';
import { createRedis } from '../config/redis';
import { config } from '../config';
import { runInsightGraph } from '../services/insight.graph';
import { escalationService } from '../services/escalation.service';
import { healthScoreService } from '../services/healthScore.service';
import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { InsightsJobData } from '../types';

export function createInsightsWorker() {
  const worker = new Worker<InsightsJobData>(
    'insights',
    async (job: Job<InsightsJobData>) => {
      const { restaurantId, jobDbId } = job.data;

      logger.info(`[insights] Generating for ${restaurantId}`);

      if (jobDbId) {
        await prisma.scrapeJob.update({
          where: { id: jobDbId },
          data: { status: 'running', startedAt: new Date() },
        });
      }

      try {
        // LangGraph pipeline: loadData → [generateInsights || extractDishes || extractStaff] → persistAll
        const count = await runInsightGraph(restaurantId);

        try {
          await escalationService.check(restaurantId);
        } catch (escErr) {
          logger.warn(`[insights-worker] Escalation check failed for ${restaurantId}: ${escErr instanceof Error ? escErr.message : String(escErr)}`);
        }

        try {
          await healthScoreService.compute(restaurantId);
        } catch (hsErr) {
          logger.warn(`[insights-worker] Health score failed for ${restaurantId}: ${hsErr instanceof Error ? hsErr.message : String(hsErr)}`);
        }

        if (jobDbId) {
          await prisma.scrapeJob.update({
            where: { id: jobDbId },
            data: { status: 'completed', completedAt: new Date(), reviewsFound: count },
          });
        }

        return { insightsGenerated: count };
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
      concurrency: config.workers.insightsConcurrency,
    }
  );

  worker.on('active', (job) => {
    logger.info(`[insights-worker] Job active id=${job.id} name=${job.name}`);
  });

  worker.on('completed', (job, result) => {
    logger.info(`[insights-worker] Job ${job.id} done — ${result.insightsGenerated} insights generated`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`[insights-worker] Job ${job?.id} failed: ${err.message}`);
  });

  worker.on('stalled', (jobId) => {
    logger.warn(`[insights-worker] Job ${jobId} stalled`);
  });

  worker.on('error', (err) => {
    logger.error(`[insights-worker] Worker error: ${err.message}`);
  });

  logger.info('[insights-worker] Worker created and listening on queue "insights"');
  return worker;
}
