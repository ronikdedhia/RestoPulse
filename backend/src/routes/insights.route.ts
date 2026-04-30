import { Router, Request, Response } from 'express';
import { insightService } from '../services/insight.service';
import { insightsQueue } from '../queues';
import { prisma } from '../db/client';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const summary = await insightService.getAllInsightsSummary();
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch insights' });
  }
});

router.get('/restaurant/:restaurantId', async (req: Request, res: Response) => {
  try {
    const { priority } = req.query;
    const insights = await insightService.getByRestaurant(
      req.params.restaurantId as string,
      priority as string | undefined
    );
    res.json({ success: true, data: insights });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch insights' });
  }
});

router.post('/restaurant/:restaurantId/generate', async (req: Request, res: Response) => {
  try {
    const jobRecord = await prisma.scrapeJob.create({
      data: {
        restaurantId: req.params.restaurantId as string,
        status: 'pending',
        jobType: 'insights',
      },
    });

    const bullJob = await insightsQueue.add(
      'generate',
      { restaurantId: req.params.restaurantId as string, jobDbId: jobRecord.id },
      { jobId: `insights-${req.params.restaurantId as string}-${Date.now()}` }
    );

    await prisma.scrapeJob.update({
      where: { id: jobRecord.id },
      data: { bullJobId: bullJob.id },
    });

    res.status(202).json({ success: true, data: { jobId: jobRecord.id } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to queue insights job' });
  }
});

export default router;
