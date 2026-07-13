import express from 'express';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticate, async (_req, res) => {
  res.json({ message: 'Get cart items' });
});

router.post('/add', authenticate, async (_req, res) => {
  res.json({ message: 'Add to cart' });
});

router.delete('/remove/:productId', authenticate, async (_req, res) => {
  res.json({ message: 'Remove from cart' });
});

export default router;
