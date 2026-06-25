import { Router, Request, Response } from 'express';
import { restaurantService } from '../services/restaurant.service';
import { scrapeQueue } from '../queues';
import { prisma } from '../db/client';
import { config } from '../config';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const restaurants = await restaurantService.getAll();
    res.json({ success: true, data: restaurants });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch restaurants' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const restaurant = await restaurantService.getById(req.params.id as string);
    if (!restaurant) return res.status(404).json({ success: false, error: 'Restaurant not found' });
    res.json({ success: true, data: restaurant });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch restaurant' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, address, googleMapsUrl, zomatoUrl, cuisine, priceLevel } = req.body;
    if (!name || !address) {
      return res.status(400).json({ success: false, error: 'name and address are required' });
    }
    if (!googleMapsUrl && !zomatoUrl) {
      return res.status(400).json({ success: false, error: 'At least one of googleMapsUrl or zomatoUrl is required' });
    }
    const restaurant = await restaurantService.create({ name, address, googleMapsUrl, zomatoUrl, cuisine, priceLevel });

    if (restaurant.googleMapsUrl) {
      const jobRecord = await prisma.scrapeJob.create({
        data: { restaurantId: restaurant.id, status: 'pending', jobType: 'scrape' },
      });
      const bullJob = await scrapeQueue.add(
        'scrape',
        { restaurantId: restaurant.id, sourceUrl: restaurant.googleMapsUrl, source: 'google', maxReviews: config.workers.maxReviewsPerRestaurant, jobDbId: jobRecord.id },
        { jobId: `scrape-google-${restaurant.id}-${Date.now()}` }
      );
      await prisma.scrapeJob.update({ where: { id: jobRecord.id }, data: { bullJobId: bullJob.id } });
    }

    if (restaurant.zomatoUrl) {
      const jobRecord = await prisma.scrapeJob.create({
        data: { restaurantId: restaurant.id, status: 'pending', jobType: 'scrape' },
      });
      const bullJob = await scrapeQueue.add(
        'scrape',
        { restaurantId: restaurant.id, sourceUrl: restaurant.zomatoUrl, source: 'zomato', maxReviews: config.workers.maxZomatoReviewsPerRestaurant, jobDbId: jobRecord.id },
        { jobId: `scrape-zomato-${restaurant.id}-${Date.now()}` }
      );
      await prisma.scrapeJob.update({ where: { id: jobRecord.id }, data: { bullJobId: bullJob.id } });
    }

    res.status(201).json({ success: true, data: restaurant });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'A restaurant with this URL already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to create restaurant' });
  }
});

router.patch('/:id/digest', async (req: Request, res: Response) => {
  try {
    const { ownerEmail, digestEnabled } = req.body;
    const update: Record<string, unknown> = {};

    if (typeof ownerEmail === 'string') update.ownerEmail = ownerEmail || null;
    if (typeof digestEnabled === 'boolean') update.digestEnabled = digestEnabled;

    const restaurant = await prisma.restaurant.update({
      where: { id: req.params.id as string },
      data: update,
      select: { id: true, ownerEmail: true, digestEnabled: true },
    });

    res.json({ success: true, data: restaurant });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, error: 'Restaurant not found' });
    res.status(500).json({ success: false, error: 'Failed to update digest settings' });
  }
});

// Owner event log
router.get('/:id/events', async (req: Request, res: Response) => {
  try {
    const events = await prisma.ownerEvent.findMany({
      where: { restaurantId: req.params.id as string },
      orderBy: { eventDate: 'desc' },
    });
    res.json({ success: true, data: events });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch events' });
  }
});

router.post('/:id/events', async (req: Request, res: Response) => {
  try {
    const { description, eventDate } = req.body;
    if (!description) return res.status(400).json({ success: false, error: 'description is required' });
    const event = await prisma.ownerEvent.create({
      data: {
        restaurantId: req.params.id as string,
        description,
        eventDate: eventDate ? new Date(eventDate) : new Date(),
      },
    });
    res.status(201).json({ success: true, data: event });
  } catch (err: any) {
    if (err.code === 'P2003') return res.status(404).json({ success: false, error: 'Restaurant not found' });
    res.status(500).json({ success: false, error: 'Failed to create event' });
  }
});

router.delete('/:id/events/:eventId', async (req: Request, res: Response) => {
  try {
    await prisma.ownerEvent.delete({
      where: { id: req.params.eventId as string, restaurantId: req.params.id as string },
    });
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, error: 'Event not found' });
    res.status(500).json({ success: false, error: 'Failed to delete event' });
  }
});

// Health score
router.get('/:id/health-score', async (req: Request, res: Response) => {
  try {
    const { healthScoreService } = await import('../services/healthScore.service');
    const [latest, history] = await Promise.all([
      healthScoreService.getLatest(req.params.id as string),
      healthScoreService.getHistory(req.params.id as string),
    ]);
    res.json({ success: true, data: { latest, history } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch health score' });
  }
});

// Queue scrape jobs for all active sources on a restaurant
router.post('/:id/scrape', async (req: Request, res: Response) => {
  try {
    const restaurant = await restaurantService.getById(req.params.id as string);
    if (!restaurant) return res.status(404).json({ success: false, error: 'Restaurant not found' });

    const jobs = [];

    if (restaurant.googleMapsUrl) {
      const jobRecord = await prisma.scrapeJob.create({
        data: { restaurantId: restaurant.id, status: 'pending', jobType: 'scrape' },
      });
      const bullJob = await scrapeQueue.add(
        'scrape',
        { restaurantId: restaurant.id, sourceUrl: restaurant.googleMapsUrl, source: 'google', maxReviews: config.workers.maxReviewsPerRestaurant, jobDbId: jobRecord.id },
        { jobId: `scrape-google-${restaurant.id}-${Date.now()}` }
      );
      await prisma.scrapeJob.update({ where: { id: jobRecord.id }, data: { bullJobId: bullJob.id } });
      jobs.push({ source: 'google', jobId: jobRecord.id });
    }

    if (restaurant.zomatoUrl) {
      const jobRecord = await prisma.scrapeJob.create({
        data: { restaurantId: restaurant.id, status: 'pending', jobType: 'scrape' },
      });
      const bullJob = await scrapeQueue.add(
        'scrape',
        { restaurantId: restaurant.id, sourceUrl: restaurant.zomatoUrl, source: 'zomato', maxReviews: config.workers.maxZomatoReviewsPerRestaurant, jobDbId: jobRecord.id },
        { jobId: `scrape-zomato-${restaurant.id}-${Date.now()}` }
      );
      await prisma.scrapeJob.update({ where: { id: jobRecord.id }, data: { bullJobId: bullJob.id } });
      jobs.push({ source: 'zomato', jobId: jobRecord.id });
    }

    res.status(202).json({ success: true, data: { queued: jobs.length, jobs } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to queue scrape job' });
  }
});

export default router;
