import { Router, Request, Response } from 'express';
import { prisma } from '../db/client';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Sync Clerk user to local DB after sign-in
router.post('/sync', requireAuth, async (req: Request, res: Response) => {
  try {
    const { email, firstName, lastName, imageUrl } = req.body;
    const userId = req.userId!;

    const user = await prisma.user.upsert({
      where: { id: userId },
      update: { email, firstName, lastName, imageUrl },
      create: { id: userId, email, firstName, lastName, imageUrl },
    });

    res.json({ success: true, data: user });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Email already in use by another account' });
    }
    res.status(500).json({ success: false, error: 'Failed to sync user' });
  }
});

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      include: {
        ownedRestaurants: {
          include: { restaurant: { select: { id: true, name: true, address: true } } },
        },
      },
    });

    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: user });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

// Claim ownership of a restaurant
router.post('/restaurants/:restaurantId/claim', requireAuth, async (req: Request, res: Response) => {
  try {
    const restaurantId = req.params['restaurantId'] as string;
    const ownership = await prisma.restaurantOwnership.upsert({
      where: {
        userId_restaurantId: { userId: req.userId!, restaurantId },
      },
      update: {},
      create: { userId: req.userId!, restaurantId, role: 'owner' },
    });
    res.json({ success: true, data: ownership });
  } catch (err: any) {
    if (err.code === 'P2003') return res.status(404).json({ success: false, error: 'Restaurant not found' });
    res.status(500).json({ success: false, error: 'Failed to claim restaurant' });
  }
});

export default router;
