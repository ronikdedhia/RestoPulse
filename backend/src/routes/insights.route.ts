import { Router, Request, Response } from 'express';
import { insightService } from '../services/insight.service';
import { velocityService } from '../services/velocity.service';
import { fakeReviewService } from '../services/fakeReview.service';
import { priceSensitivityService } from '../services/priceSensitivity.service';
import { escalationService } from '../services/escalation.service';
import { redFlagService } from '../services/redFlag.service';
import { divergenceService } from '../services/divergence.service';
import { customerSegmentService } from '../services/customerSegment.service';
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

router.get('/restaurant/:restaurantId/diff', async (req: Request, res: Response) => {
  try {
    const diff = await insightService.getInsightDiff(req.params.restaurantId as string);
    res.json({ success: true, data: diff });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch insight diff' });
  }
});

router.get('/restaurant/:restaurantId/dishes', async (req: Request, res: Response) => {
  try {
    const dishes = await insightService.getDishMentions(req.params.restaurantId as string);
    res.json({ success: true, data: dishes });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch dish mentions' });
  }
});

router.get('/restaurant/:restaurantId/staff', async (req: Request, res: Response) => {
  try {
    const staff = await insightService.getStaffMentions(req.params.restaurantId as string);
    res.json({ success: true, data: staff });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch staff mentions' });
  }
});

router.get('/restaurant/:restaurantId/velocity', async (req: Request, res: Response) => {
  try {
    const data = await velocityService.getVelocityData(req.params.restaurantId as string);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch velocity data' });
  }
});

router.get('/restaurant/:restaurantId/fake-reviews', async (req: Request, res: Response) => {
  try {
    const data = await fakeReviewService.getSuspiciousReviews(req.params.restaurantId as string);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch fake review scores' });
  }
});

router.get('/alerts', async (_req: Request, res: Response) => {
  try {
    const alerts = await velocityService.getActiveAlerts();
    res.json({ success: true, data: alerts });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
  }
});

router.get('/restaurant/:restaurantId/price-sensitivity', async (req: Request, res: Response) => {
  try {
    const data = await priceSensitivityService.getTimeSeries(req.params.restaurantId as string);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch price sensitivity' });
  }
});

router.get('/restaurant/:restaurantId/source-divergence', async (req: Request, res: Response) => {
  try {
    const data = await divergenceService.compute(req.params.restaurantId as string);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to compute source divergence' });
  }
});

router.get('/restaurant/:restaurantId/customer-segments', async (req: Request, res: Response) => {
  try {
    const segments = await customerSegmentService.analyze(req.params.restaurantId as string);
    res.json({ success: true, data: segments });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to analyze customer segments' });
  }
});

router.get('/restaurant/:restaurantId/red-flags', async (req: Request, res: Response) => {
  try {
    const reviews = await redFlagService.getRedFlags(req.params.restaurantId as string);
    res.json({ success: true, data: reviews });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch red flag reviews' });
  }
});

router.get('/restaurant/:restaurantId/persistent-issues', async (req: Request, res: Response) => {
  try {
    const issues = await escalationService.getForRestaurant(req.params.restaurantId as string);
    res.json({ success: true, data: issues });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch persistent issues' });
  }
});

router.get('/digest/unsubscribe/:token', async (req: Request, res: Response) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { unsubscribeToken: req.params.token as string },
      select: { id: true, name: true },
    });

    if (!restaurant) {
      return res.status(404).send('<h2>Invalid unsubscribe link.</h2>');
    }

    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { digestEnabled: false },
    });

    res.send(`<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:60px;">
      <h2>Unsubscribed</h2>
      <p>You've been unsubscribed from weekly digests for <strong>${restaurant.name}</strong>.</p>
    </body></html>`);
  } catch (err) {
    res.status(500).send('<h2>Something went wrong.</h2>');
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
