import express from 'express';
import mongoose from 'mongoose';
import { authenticate, authorize } from '../middleware/auth';
import Product from '../models/Product';
import Category from '../models/Category';
import { isValidObjectId } from '../middleware/validateObjectId';
import { queueNewsletterCampaign } from '../services/newsletter';

const router = express.Router();

function isValidProductId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
}

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function normalizeProductPayload(body: any) {
  const variants = Array.isArray(body.variants) ? body.variants : [];
  const options = Array.isArray(body.options) ? body.options : [];

  return {
    ...body,
    title: body.title || body.name,
    name: body.name || body.title,
    images: normalizeList(body.images),
    tags: normalizeList(body.tags),
    ingredients: normalizeList(body.ingredients),
    collections: normalizeList(body.collections),
    salesChannels: normalizeList(body.salesChannels).length ? normalizeList(body.salesChannels) : ['online_store'],
    seoKeywords: normalizeList(body.seoKeywords),
    options: options.map((option: any) => ({
      name: String(option.name || '').trim(),
      values: normalizeList(option.values),
    })).filter((option: any) => option.name && option.values.length),
    variants: variants.map((variant: any) => ({
      label: variant.label || variant.size || 'Default',
      size: variant.size || variant.label || 'Default',
      optionValues: normalizeList(variant.optionValues),
      sku: variant.sku,
      barcode: variant.barcode,
      price: Number(variant.price || 0),
      compareAtPrice: variant.compareAtPrice === undefined ? undefined : Number(variant.compareAtPrice),
      costPerItem: variant.costPerItem === undefined ? undefined : Number(variant.costPerItem),
      inventory: Number(variant.inventory || 0),
      lowStockThreshold: Number(variant.lowStockThreshold ?? 5),
      weightKg: variant.weightKg === undefined ? undefined : Number(variant.weightKg),
      isActive: variant.isActive !== false,
    })),
    marketing: {
      badge: body.marketing?.badge || '',
      campaign: body.marketing?.campaign || '',
      upsellProductSlugs: normalizeList(body.marketing?.upsellProductSlugs),
      crossSellProductSlugs: normalizeList(body.marketing?.crossSellProductSlugs),
    },
    shipping: {
      isPhysicalProduct: body.shipping?.isPhysicalProduct !== false,
      weightKg: body.shipping?.weightKg === undefined ? undefined : Number(body.shipping.weightKg),
      hsnCode: body.shipping?.hsnCode || '',
      shelfLife: body.shipping?.shelfLife || body.shelfLife || '',
    },
    searchEngine: {
      title: body.searchEngine?.title || body.seoTitle || '',
      description: body.searchEngine?.description || body.seoDescription || '',
      keywords: normalizeList(body.searchEngine?.keywords),
    },
  };
}

async function hasValidCategorySelection(category: unknown, subCategory: unknown) {
  if (!isValidObjectId(category)) return false;
  if (subCategory && !isValidObjectId(subCategory)) return false;
  const parent = await Category.exists({ _id: category, parentCategory: null, isActive: true });
  if (!parent) return false;
  if (!subCategory) return true;
  return Boolean(await Category.exists({ _id: subCategory, parentCategory: category, isActive: true }));
}

router.get('/', async (req, res, next) => {
  try {
    const { status, q, category } = req.query;
    const filter: Record<string, unknown> = {};

    if (status) filter.status = status;
    if (category) {
      const requestedCategory = String(category).trim();
      const matchedCategory = mongoose.Types.ObjectId.isValid(requestedCategory)
        ? await Category.findOne({ _id: requestedCategory, isActive: true }).select('_id')
        : await Category.findOne({ slug: requestedCategory.toLowerCase(), isActive: true }).select('_id');
      if (!matchedCategory) {
        res.json({ products: [] });
        return;
      }
      filter.category = matchedCategory._id;
    }
    if (q) filter.$text = { $search: String(q) };

    const products = await Product.find(filter).populate('category subCategory').sort({ createdAt: -1 });
    res.json({ products });
  } catch (error) {
    next(error);
  }
});

router.get('/categories', async (_req, res, next) => {
  try {
    const [categories, productCounts] = await Promise.all([
      Category.find({ isActive: true, parentCategory: null }).sort({ name: 1 }).lean(),
      Product.aggregate<{ _id: mongoose.Types.ObjectId; productCount: number }>([
        { $match: { status: 'active' } },
        { $group: { _id: '$category', productCount: { $sum: 1 } } },
      ]),
    ]);
    const countByCategory = new Map(productCounts.map((item) => [String(item._id), item.productCount]));
    res.json({
      categories: categories.map((category) => ({
        _id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        image: category.image,
        icon: category.icon,
        productCount: countByCategory.get(String(category._id)) || 0,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!isValidProductId(req.params.id)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }
    const product = await Product.findById(req.params.id).populate('category subCategory');
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json({ product });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/reviews', async (req, res, next) => {
  try {
    if (!isValidProductId(req.params.id)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }
    const product = await Product.findById(req.params.id).select('reviews rating');
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const reviews = product.reviews.filter((review) => review.isApproved);
    return res.json({ reviews, rating: reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0 });
  } catch (error) { return next(error); }
});

router.post('/:id/reviews', async (req, res, next) => {
  try {
    if (!isValidProductId(req.params.id)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || '').trim();
    if (name.length < 2 || !Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length < 5) {
      return res.status(400).json({ error: 'Name, rating and a meaningful review are required.' });
    }
    const product = await Product.findByIdAndUpdate(req.params.id, { $push: { reviews: { name, email, rating, comment, isApproved: false, createdAt: new Date() } } }, { new: true });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    return res.status(201).json({ message: 'Thank you. Your review will appear after moderation.' });
  } catch (error) { return next(error); }
});

router.post('/', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const payload = normalizeProductPayload(req.body);
    if (!payload.category) payload.category = (await Category.findOneAndUpdate({ slug: 'all-pickles' }, { $setOnInsert: { name: 'All Pickles', slug: 'all-pickles', description: 'All products', isActive: true } }, { new: true, upsert: true }))._id;
    if (!(await hasValidCategorySelection(payload.category, payload.subCategory))) {
      res.status(400).json({ error: 'Select a valid category and a subcategory that belongs to it.' });
      return;
    }
    const product = await Product.create(payload);
    if (product.status === 'active') await queueNewsletterCampaign('product', product._id).catch(error => console.error('Product newsletter queue failed', error));
    res.status(201).json({ product });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    if (!isValidProductId(req.params.id)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }
    const payload = normalizeProductPayload(req.body);
    if (!payload.category) payload.category = (await Category.findOneAndUpdate({ slug: 'all-pickles' }, { $setOnInsert: { name: 'All Pickles', slug: 'all-pickles', description: 'All products', isActive: true } }, { new: true, upsert: true }))._id;
    if (!(await hasValidCategorySelection(payload.category, payload.subCategory))) {
      res.status(400).json({ error: 'Select a valid category and a subcategory that belongs to it.' });
      return;
    }
    const product = await Product.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    }).populate('category subCategory');

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    if (product.status === 'active') await queueNewsletterCampaign('product', product._id).catch(error => console.error('Product newsletter queue failed', error));
    res.json({ product });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    if (!isValidProductId(req.params.id)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
