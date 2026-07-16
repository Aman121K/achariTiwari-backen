import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/database';
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/product.routes';
import blogRoutes from './routes/blog.routes';
import cartRoutes from './routes/cart.routes';
import orderRoutes from './routes/order.routes';
import userRoutes from './routes/user.routes';
import adminRoutes from './routes/admin.routes';
import storeRoutes from './routes/store.routes';
import { errorHandler } from './middleware/errorHandler';
import mediaRoutes from './routes/media.routes';
import newsletterRoutes from './routes/newsletter.routes';
import { resumeNewsletterCampaigns } from './services/newsletter';

dotenv.config();

const app: Express = express();
const PORT =  5002;
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  // Reflect the requesting origin so credentialed requests work from any domain.
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Connect to Database
connectDB().then(() => resumeNewsletterCampaigns().catch(error => console.error('Newsletter resume failed', error)));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/admin/media', mediaRoutes);
app.use('/api/newsletter', newsletterRoutes);

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'API is running' });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
