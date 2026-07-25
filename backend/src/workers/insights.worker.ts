import { Worker, Job } from 'bullmq';
import { createRedis } from '../config/redis';
import { config } from '../config';
import { runInsightGraph } from '../services/insight.graph';
import { escalationService } from '../services/escalation.service';
import { healthScoreService } from '../services/healthScore.service';
import { telegramService } from '../services/telegram.service';
import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { attachRedisQuotaGuard } from '../utils/redisQuotaGuard';
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
        const { insightCount, errors, restaurantName } = await runInsightGraph(restaurantId);

        try {
          await escalationService.check(restaurantId);
        } catch (escErr) {
          logger.warn(`[insights-worker] Escalation check failed for ${restaurantId}: ${escErr instanceof Error ? escErr.message : String(escErr)}`);
        }

        let healthScore: number | null = null;
        try {
          healthScore = await healthScoreService.compute(restaurantId);
        } catch (hsErr) {
          logger.warn(`[insights-worker] Health score failed for ${restaurantId}: ${hsErr instanceof Error ? hsErr.message : String(hsErr)}`);
        }

        // Telegram summary after all processing completes
        try {
          const [insights, dishes, staff] = await Promise.all([
            prisma.actionableInsight.findMany({
              where: { restaurantId },
              orderBy: [{ priority: 'asc' }, { impactScore: 'desc' }],
              take: 3,
              select: { category: true, insight: true, priority: true },
            }),
            prisma.dishMention.count({ where: { restaurantId } }),
            prisma.staffMention.count({ where: { restaurantId } }),
          ]);

          await telegramService.sendInsightsSummary({
            restaurantName,
            insightCount,
            healthScore,
            topInsights: insights,
            dishCount: dishes,
            staffCount: staff,
            errors,
          });
        } catch (tgErr) {
          logger.warn(`[insights-worker] Telegram summary failed: ${tgErr instanceof Error ? tgErr.message : String(tgErr)}`);
        }

        const count = insightCount;

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
      drainDelay: 300,
      stalledInterval: 300_000,
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

  attachRedisQuotaGuard(worker, 'insights-worker');

  logger.info('[insights-worker] Ready');
  return worker;
}
