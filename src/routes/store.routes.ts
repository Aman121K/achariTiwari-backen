import express from 'express';
import Banner from '../models/Banner';
import StoreSettings from '../models/StoreSettings';
import Product from '../models/Product';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();
const defaults = () => ({ key: 'primary' });

router.get('/settings', async (_req, res, next) => {
  try {
    const settings = await StoreSettings.findOneAndUpdate({ key: 'primary' }, { $setOnInsert: defaults() }, { new: true, upsert: true, setDefaultsOnInsert: true });
    res.json({ settings });
  } catch (error) { next(error); }
});

router.put('/settings', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const allowed = ['storeName','supportEmail','supportPhone','announcement','heroTitle','heroDescription','seoTitle','seoDescription','seoKeywords','pageSeo','termsContent','privacyContent','refundContent','shippingContent','acceptedPayments','freeShippingThreshold'];
    const update = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    const settings = await StoreSettings.findOneAndUpdate({ key: 'primary' }, update, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
    res.json({ settings });
  } catch (error) { next(error); }
});

router.get('/banners', async (_req, res, next) => {
  try {
    const now = new Date();
    const banners = await Banner.find({ isActive: true, $and: [{ $or: [{ validFrom: { $exists: false } }, { validFrom: { $lte: now } }] }, { $or: [{ validTo: { $exists: false } }, { validTo: { $gte: now } }] }] }).sort({ position: 1 });
    res.json({ banners });
  } catch (error) { next(error); }
});

router.get('/reviews', async (_req, res, next) => {
  try {
    const products = await Product.find({ 'reviews.isApproved': true }).select('title reviews').limit(20);
    const reviews = products.flatMap((product) => product.reviews.filter((review) => review.isApproved).map((review) => ({ ...((review as any).toObject ? (review as any).toObject() : review), product: product.title })));
    res.json({ reviews: reviews.slice(0, 20) });
  } catch (error) { next(error); }
});

export default router;
