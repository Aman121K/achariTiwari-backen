import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import Banner from '../models/Banner';
import Discount from '../models/Discount';
import Order from '../models/Order';
import Product from '../models/Product';
import User from '../models/User';
import Category from '../models/Category';

const router = express.Router();

router.use(authenticate);
router.use(authorize(['admin']));

router.get('/products', async (_req, res, next) => {
  try {
    const products = await Product.find().populate('category subCategory').sort({ createdAt: -1 });
    res.json({ products });
  } catch (error) {
    next(error);
  }
});

router.get('/orders', async (_req, res, next) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({ orders });
  } catch (error) {
    next(error);
  }
});

router.get('/categories', async (_req, res, next) => {
  try { res.json({ categories: await Category.find().populate('parentCategory', 'name slug').sort({ parentCategory: 1, name: 1 }) }); }
  catch (error) { next(error); }
});

router.post('/categories', async (req, res, next) => {
  try {
    const parentCategory = req.body.parentCategory || null;
    if (parentCategory && !(await Category.exists({ _id: parentCategory, parentCategory: null }))) return res.status(400).json({ error: 'Select a valid top-level parent category.' });
    const category = await Category.create({ ...req.body, parentCategory });
    return res.status(201).json({ category });
  } catch (error) { return next(error); }
});

router.put('/categories/:id', async (req, res, next) => {
  try {
    const parentCategory = req.body.parentCategory || null;
    if (parentCategory === req.params.id) return res.status(400).json({ error: 'A category cannot be its own parent.' });
    if (parentCategory && !(await Category.exists({ _id: parentCategory, parentCategory: null }))) return res.status(400).json({ error: 'Select a valid top-level parent category.' });
    const category = await Category.findByIdAndUpdate(req.params.id, { ...req.body, parentCategory }, { new: true, runValidators: true });
    if (!category) return res.status(404).json({ error: 'Category not found' });
    return res.json({ category });
  } catch (error) { return next(error); }
});

router.delete('/categories/:id', async (req, res, next) => {
  try {
    const [children, products] = await Promise.all([Category.countDocuments({ parentCategory: req.params.id }), Product.countDocuments({ $or: [{ category: req.params.id }, { subCategory: req.params.id }] })]);
    if (children || products) return res.status(409).json({ error: `This category is in use by ${children} subcategories and ${products} products. Reassign them before deleting it.` });
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    return res.json({ ok: true });
  } catch (error) { return next(error); }
});

router.put('/orders/:orderId/status', async (req, res, next) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.orderId,
      {
        status: req.body.status,
        paymentStatus: req.body.paymentStatus,
        trackingNumber: req.body.trackingNumber,
      },
      { new: true, runValidators: true }
    );
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    res.json({ order });
  } catch (error) {
    next(error);
  }
});

router.get('/users', async (_req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

router.post('/users', async (req, res, next) => {
  try {
    const user = await User.create(req.body);
    const safeUser = await User.findById(user._id).select('-password');
    res.status(201).json({ user: safeUser });
  } catch (error) { next(error); }
});

router.put('/users/:id', async (req, res, next) => {
  try {
    const allowed = ['name', 'email', 'phone', 'role'];
    const update = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user });
  } catch (error) { return next(error); }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ ok: true });
  } catch (error) { return next(error); }
});

router.get('/discounts', async (_req, res, next) => {
  try {
    const discounts = await Discount.find().sort({ createdAt: -1 });
    res.json({ discounts });
  } catch (error) {
    next(error);
  }
});

router.post('/discounts', async (req, res, next) => {
  try {
    const discount = await Discount.create(req.body);
    res.status(201).json({ discount });
  } catch (error) {
    next(error);
  }
});

router.put('/discounts/:id', async (req, res, next) => {
  try {
    const discount = await Discount.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!discount) {
      res.status(404).json({ error: 'Discount not found' });
      return;
    }
    res.json({ discount });
  } catch (error) {
    next(error);
  }
});

router.delete('/discounts/:id', async (req, res, next) => {
  try {
    const discount = await Discount.findByIdAndDelete(req.params.id);
    if (!discount) {
      res.status(404).json({ error: 'Discount not found' });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/banners', async (_req, res, next) => {
  try {
    const banners = await Banner.find().sort({ position: 1, createdAt: -1 });
    res.json({ banners });
  } catch (error) {
    next(error);
  }
});

router.post('/banners', async (req, res, next) => {
  try {
    const banner = await Banner.create(req.body);
    res.status(201).json({ banner });
  } catch (error) {
    next(error);
  }
});

router.put('/banners/:id', async (req, res, next) => {
  try {
    const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!banner) {
      res.status(404).json({ error: 'Banner not found' });
      return;
    }
    res.json({ banner });
  } catch (error) {
    next(error);
  }
});

router.delete('/banners/:id', async (req, res, next) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) {
      res.status(404).json({ error: 'Banner not found' });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/analytics/dashboard', async (_req, res, next) => {
  try {
    const [products, orders, users, discounts, banners] = await Promise.all([
      Product.countDocuments(),
      Order.countDocuments(),
      User.countDocuments(),
      Discount.countDocuments(),
      Banner.countDocuments(),
    ]);
    res.json({ analytics: { products, orders, users, discounts, banners } });
  } catch (error) {
    next(error);
  }
});

router.get('/analytics/sales', async (_req, res, next) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    res.json({ analytics: { orders: orders.length, revenue } });
  } catch (error) {
    next(error);
  }
});

router.get('/reviews', async (_req, res, next) => {
  try {
    const products = await Product.find({ 'reviews.0': { $exists: true } }).select('title reviews');
    const reviews = products.flatMap((product) => product.reviews.map((review: any) => ({ ...review.toObject(), productId: product._id, productTitle: product.title })));
    res.json({ reviews });
  } catch (error) { next(error); }
});

router.put('/reviews/:productId/:reviewId', async (req, res, next) => {
  try {
    const product = await Product.findOneAndUpdate({ _id: req.params.productId, 'reviews._id': req.params.reviewId }, { $set: { 'reviews.$.isApproved': Boolean(req.body.isApproved) } }, { new: true });
    if (!product) return res.status(404).json({ error: 'Review not found' });
    return res.json({ ok: true });
  } catch (error) { return next(error); }
});

router.delete('/reviews/:productId/:reviewId', async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.productId, { $pull: { reviews: { _id: req.params.reviewId } } });
    if (!product) return res.status(404).json({ error: 'Review not found' });
    return res.json({ ok: true });
  } catch (error) { return next(error); }
});

export default router;
