import express from 'express';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.get('/:userId', authenticate, async (_req, res) => {
  res.json({ message: 'Get user profile' });
});

router.post('/wishlist/add', authenticate, async (_req, res) => {
  res.json({ message: 'Add to wishlist' });
});

router.delete('/wishlist/remove/:productId', authenticate, async (_req, res) => {
  res.json({ message: 'Remove from wishlist' });
});

export default router;
