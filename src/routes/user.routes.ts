import express from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthRequest } from '../middleware/auth';
import User from '../models/User';
import Product from '../models/Product';

const router = express.Router();

router.get('/wishlist', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await User.findById(req.userId).populate({ path: 'wishlists', match: { status: 'active' } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ wishlist: user.wishlists });
  } catch (error) { next(error); }
});

router.post('/wishlist/add', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const productId = String(req.body.productId || '');
    if (!mongoose.isValidObjectId(productId)) { res.status(400).json({ error: 'A valid productId is required' }); return; }
    const product = await Product.findOne({ _id: productId, status: 'active' });
    if (!product) { res.status(404).json({ error: 'Product not found' }); return; }
    const user = await User.findByIdAndUpdate(req.userId, { $addToSet: { wishlists: product._id } }, { new: true }).populate({ path: 'wishlists', match: { status: 'active' } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ wishlist: user.wishlists });
  } catch (error) { next(error); }
});

router.post('/wishlist/merge', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const rawIds = Array.isArray(req.body.productIds) ? req.body.productIds.map(String) : [];
    const validIds = rawIds.filter((id: string) => mongoose.isValidObjectId(id));
    const products = await Product.find({ _id: { $in: validIds }, status: 'active' }).select('_id');
    const user = await User.findByIdAndUpdate(req.userId, { $addToSet: { wishlists: { $each: products.map(product => product._id) } } }, { new: true }).populate({ path: 'wishlists', match: { status: 'active' } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ wishlist: user.wishlists });
  } catch (error) { next(error); }
});

router.delete('/wishlist/remove/:productId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.productId)) { res.status(400).json({ error: 'Invalid product id' }); return; }
    const user = await User.findByIdAndUpdate(req.userId, { $pull: { wishlists: req.params.productId } }, { new: true }).populate({ path: 'wishlists', match: { status: 'active' } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ wishlist: user.wishlists });
  } catch (error) { next(error); }
});

router.get('/:userId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (req.userId !== req.params.userId && req.userRole !== 'admin') { res.status(403).json({ error: 'You cannot view this profile' }); return; }
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ user });
  } catch (error) { next(error); }
});

export default router;
