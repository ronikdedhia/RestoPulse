import { Router, Request, Response } from 'express';
import { reviewService } from '../services/review.service';

const router = Router();

router.get('/restaurant/:restaurantId', async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50', minRating, maxRating } = req.query;

    const reviews = await reviewService.getByRestaurant(req.params.restaurantId as string, {
      page: parseInt(page as string),
      limit: Math.min(parseInt(limit as string), 100),
      minRating: minRating ? parseInt(minRating as string) : undefined,
      maxRating: maxRating ? parseInt(maxRating as string) : undefined,
    });

    res.json({ success: true, data: reviews });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch reviews' });
  }
});

router.get('/restaurant/:restaurantId/stats', async (req: Request, res: Response) => {
  try {
    const stats = await reviewService.getStats(req.params.restaurantId as string);
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch review stats' });
  }
});

export default router;
