import express from 'express';
import { AuthRequest, optionalAuthenticate } from '../middleware/auth';
import Cart from '../models/Cart';
import User from '../models/User';

const router = express.Router();
const validSessionId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{16,100}$/.test(value);
type TrackedCartItem = { productId: string; name: string; price: number; quantity: number; image?: string; sku?: string };

router.put('/', optionalAuthenticate, async (req: AuthRequest, res, next) => {
  try {
    const { sessionId, checkoutStarted = false } = req.body;
    if (!validSessionId(sessionId)) return res.status(400).json({ error: 'Invalid cart session' });
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (rawItems.length === 0) {
      await Cart.deleteOne({ sessionId });
      return res.json({ cart: null });
    }

    const items: TrackedCartItem[] = rawItems.slice(0, 50).map((item: any): TrackedCartItem => ({
      productId: String(item.productId || ''),
      name: String(item.name || '').trim(),
      price: Number(item.price),
      quantity: Number(item.quantity),
      image: item.image ? String(item.image) : undefined,
      sku: item.sku ? String(item.sku) : undefined,
    }));
    if (items.some(item => !item.productId || !item.name || !Number.isFinite(item.price) || item.price < 0 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 25)) {
      return res.status(400).json({ error: 'One or more cart items are invalid.' });
    }

    const account = req.userId ? await User.findById(req.userId).select('name email phone').lean() : null;
    const suppliedCustomer = req.body.customer || {};
    const customer = {
      name: String(suppliedCustomer.name || account?.name || '').trim() || undefined,
      email: String(suppliedCustomer.email || account?.email || '').trim().toLowerCase() || undefined,
      phone: String(suppliedCustomer.phone || account?.phone || '').trim() || undefined,
    };
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const cart = await Cart.findOneAndUpdate(
      { sessionId },
      { $set: { items, subtotal, itemCount, checkoutStarted: Boolean(checkoutStarted), lastActivityAt: new Date(), ...(req.userId ? { userId: req.userId } : {}), customer } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return res.json({ cart });
  } catch (error) { return next(error); }
});

export default router;
