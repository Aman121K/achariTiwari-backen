import express from 'express';
import Banner from '../models/Banner';
import StoreSettings from '../models/StoreSettings';
import Product from '../models/Product';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();
const defaults = () => ({ key: 'primary' });
const robotsValues = new Set(['index,follow', 'noindex,follow', 'index,nofollow', 'noindex,nofollow']);

const cleanText = (value: unknown, maxLength: number) => typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
const cleanKeywords = (value: unknown) => Array.isArray(value)
  ? value.map((keyword) => cleanText(keyword, 80)).filter(Boolean).slice(0, 20)
  : typeof value === 'string'
    ? value.split(',').map((keyword) => cleanText(keyword, 80)).filter(Boolean).slice(0, 20)
    : [];

const cleanPageSeo = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([path, entry]) => path.startsWith('/') && path.length <= 160 && entry && typeof entry === 'object' && !Array.isArray(entry))
    .slice(0, 100)
    .map(([path, entry]) => {
      const fields = entry as Record<string, unknown>;
      const robots = cleanText(fields.robots, 32);
      return [path, {
        title: cleanText(fields.title, 120),
        description: cleanText(fields.description, 500),
        keywords: cleanKeywords(fields.keywords),
        canonical: cleanText(fields.canonical, 1000),
        robots: robotsValues.has(robots) ? robots : 'index,follow',
        ogTitle: cleanText(fields.ogTitle, 120),
        ogDescription: cleanText(fields.ogDescription, 500),
        ogImage: cleanText(fields.ogImage, 1000),
      }];
    }));
};

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
    if (Object.prototype.hasOwnProperty.call(update, 'seoKeywords')) update.seoKeywords = cleanKeywords(update.seoKeywords);
    if (Object.prototype.hasOwnProperty.call(update, 'pageSeo')) update.pageSeo = cleanPageSeo(update.pageSeo);
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
