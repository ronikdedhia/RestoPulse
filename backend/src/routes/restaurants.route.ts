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
    res.status(201).json({ success: true, data: restaurant });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'A restaurant with this URL already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to create restaurant' });
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
