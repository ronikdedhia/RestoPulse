import { Router, Request, Response } from 'express';
import { prisma } from '../db/client';
import { scrapeQueue, insightsQueue } from '../queues';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { restaurantId, status } = req.query;
    const jobs = await prisma.scrapeJob.findMany({
      where: {
        ...(restaurantId && { restaurantId: restaurantId as string }),
        ...(status && { status: status as string }),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { restaurant: { select: { name: true } } },
    });
    res.json({ success: true, data: jobs });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch jobs' });
  }
});

router.get('/queue-stats', async (req: Request, res: Response) => {
  try {
    const [scrapeCounts, insightsCounts] = await Promise.all([
      scrapeQueue.getJobCounts(),
      insightsQueue.getJobCounts(),
    ]);

    res.json({
      success: true,
      data: {
        scrape: scrapeCounts,
        insights: insightsCounts,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch queue stats' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const job = await prisma.scrapeJob.findUnique({
      where: { id: req.params.id as string },
      include: { restaurant: { select: { name: true } } },
    });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    res.json({ success: true, data: job });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch job' });
  }
});

export default router;
