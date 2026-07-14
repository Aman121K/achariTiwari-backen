import express from 'express';
import Order from '../models/Order';
import { authenticate, authorize, AuthRequest, optionalAuthenticate } from '../middleware/auth';
import { sendOrderConfirmation, sendOrderDeliveredEmail } from '../services/email';
import Product from '../models/Product';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { validateObjectIdParam } from '../middleware/validateObjectId';
import Cart from '../models/Cart';

const router = express.Router();
router.param('orderId', validateObjectIdParam);

const storefrontCatalog: Record<string, { name: string; price: number }> = {
  '1': { name: 'Premium Red Chili Aachar', price: 299 }, '2': { name: 'Traditional Mango Aachar', price: 349 },
  '3': { name: 'Fresh Lime Pickle', price: 249 }, '4': { name: 'Garlic Pickle Delight', price: 279 },
  '5': { name: 'Mixed Vegetable Aachar', price: 399 }, '6': { name: 'Spicy Ginger Pickle', price: 269 },
  '7': { name: 'Amla (Gooseberry) Aachar', price: 329 }, '8': { name: 'Kaddu (Pumpkin) Ka Aachar', price: 249 },
  '9': { name: 'Nimbu Mirch Ka Aachar', price: 199 }, '10': { name: 'Khatta Meetha Aam Ka Aachar', price: 369 },
  '11': { name: 'Lal Mirch Aur Lahsun', price: 319 }, '12': { name: 'Gobhi Gajar Ka Aachar', price: 289 },
  '13': { name: 'Pyaz Ka Aachar (Onion Pickle)', price: 229 }, '14': { name: 'Aloo Bukhara Aachar', price: 399 },
  '15': { name: 'Til Gud Aam Aachar', price: 449 }, '16': { name: 'Bharwan Karela Aachar', price: 349 },
  '17': { name: 'Instant Tadka Aachar', price: 189 },
};

const makeOrderNumber = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `AT-${date}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
};

const hashGuestToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

// Guest checkout: no account or authentication is required.
router.post('/', optionalAuthenticate, async (req: AuthRequest, res, next) => {
  try {
    const { customer, shippingAddress, items, paymentMethod = 'cash_on_delivery', notes = '', cartSessionId } = req.body;
    if (!customer?.name || !/^\S+@\S+\.\S+$/.test(customer.email || '') || !customer?.phone) {
      res.status(400).json({ error: 'Valid customer contact details are required.' });
      return;
    }
    if (!shippingAddress?.street || !shippingAddress?.city || !shippingAddress?.state || !shippingAddress?.zipCode) {
      res.status(400).json({ error: 'A complete delivery address is required.' });
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Your cart is empty.' });
      return;
    }
    if (!['cash_on_delivery', 'upi'].includes(paymentMethod)) {
      res.status(400).json({ error: 'Unsupported payment method.' });
      return;
    }

    const normalizedItems = await Promise.all(items.map(async (item: any) => {
      const productId = String(item.productId || '');
      const catalogItem = storefrontCatalog[productId];
      const databaseProduct = mongoose.isValidObjectId(productId) ? await Product.findById(productId) : null;
      const variant = databaseProduct?.variants.find((candidate) => candidate.isActive !== false) || databaseProduct?.variants[0];
      return ({
      productId,
      name: databaseProduct?.title || catalogItem?.name || '',
      price: variant?.price ?? catalogItem?.price,
      quantity: Number(item.quantity),
      image: databaseProduct?.images?.[0] || String(item.image || ''),
    })}));
    const invalidItem = normalizedItems.some((item) => !item.productId || !item.name || !Number.isFinite(item.price) || item.price < 0 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 25);
    if (invalidItem) {
      res.status(400).json({ error: 'One or more cart items are invalid.' });
      return;
    }

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shippingCost = subtotal >= 699 ? 0 : 79;
    const guestAccessToken = req.userId ? undefined : crypto.randomBytes(32).toString('base64url');
    const order = await Order.create({
      orderNumber: makeOrderNumber(),
      isGuest: !req.userId,
      userId: req.userId,
      guestAccessTokenHash: guestAccessToken ? hashGuestToken(guestAccessToken) : undefined,
      customer,
      items: normalizedItems,
      subtotal,
      shippingCost,
      tax: 0,
      discountAmount: 0,
      total: subtotal + shippingCost,
      paymentMethod,
      paymentStatus: 'pending',
      status: 'pending',
      shippingAddress: { ...shippingAddress, country: shippingAddress.country || 'India' },
      notes,
    });
    sendOrderConfirmation(order).catch((emailError) => console.error('Order email failed', emailError));
    if (typeof cartSessionId === 'string') Cart.deleteOne({ sessionId: cartSessionId }).catch(error => console.error('Converted cart cleanup failed', error));
    res.status(201).json({ order, guestAccessToken });
  } catch (error) {
    next(error);
  }
});

// Authenticated customers can only read their own orders. Cursor-style paging can
// be added later without changing the ownership model or indexes.
router.get('/mine', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const orders = await Order.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(limit).lean();
    return res.json({ orders });
  } catch (error) { return next(error); }
});

// Guest history is authorized by a high-entropy per-order secret stored only as a hash.
router.post('/guest-lookup', async (req, res, next) => {
  try {
    const references = Array.isArray(req.body?.references) ? req.body.references.slice(0, 20) : [];
    const valid = references.filter((ref: any) => typeof ref?.orderNumber === 'string' && typeof ref?.token === 'string');
    const candidates = await Order.find({ orderNumber: { $in: valid.map((ref: any) => ref.orderNumber) }, isGuest: true })
      .select('+guestAccessTokenHash').lean();
    const tokens = new Map(valid.map((ref: any) => [ref.orderNumber, hashGuestToken(ref.token)]));
    const orders = candidates
      .filter((order) => order.guestAccessTokenHash && tokens.get(order.orderNumber) === order.guestAccessTokenHash)
      .map(({ guestAccessTokenHash: _secret, ...order }) => order);
    return res.json({ orders: orders.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)) });
  } catch (error) { return next(error); }
});

router.get('/', authenticate, authorize(['admin']), async (_req, res, next) => {
  try {
    res.json({ orders: await Order.find().sort({ createdAt: -1 }) });
  } catch (error) { next(error); }
});

router.get('/:orderId', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    return res.json({ order });
  } catch (error) { return next(error); }
});

router.put('/:orderId', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const allowed = ['status', 'paymentStatus', 'trackingNumber', 'notes'];
    const update = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    const previous = await Order.findById(req.params.orderId).select('status');
    const order = await Order.findByIdAndUpdate(req.params.orderId, update, { new: true, runValidators: true });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status === 'delivered' && previous?.status !== 'delivered') sendOrderDeliveredEmail(order).catch(error => console.error('Delivery email failed', error));
    return res.json({ order });
  } catch (error) { return next(error); }
});

router.delete('/:orderId', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    return res.json({ ok: true });
  } catch (error) { return next(error); }
});

export default router;
