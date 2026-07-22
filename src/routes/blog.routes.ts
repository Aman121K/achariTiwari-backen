import express from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import BlogPost from '../models/BlogPost';
import { validateObjectIdParam } from '../middleware/validateObjectId';
import { queueNewsletterCampaign } from '../services/newsletter';
import BlogAutomation from '../models/BlogAutomation';
import { createAutomatedBlog, regenerateAutomatedBlog, regenerateAutomatedImage } from '../services/blog-automation';

const router = express.Router();
router.param('id', validateObjectIdParam);

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

function normalizePostPayload(body: any) {
  return {
    ...body,
    tags: normalizeList(body.tags),
    relatedProductSlugs: normalizeList(body.relatedProductSlugs),
    relatedBlogSlugs: normalizeList(body.relatedBlogSlugs),
    secondaryKeywords: normalizeList(body.secondaryKeywords),
    publishedAt: body.status === 'published' ? body.publishedAt || new Date() : body.publishedAt,
  };
}

function authorizeCron(req: express.Request, res: express.Response, next: express.NextFunction) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'Invalid cron authorization.' }); return;
  }
  next();
}

router.post('/automation/cron', authorizeCron, async (_req, res, next) => {
  try { res.json(await createAutomatedBlog()); } catch (error) { next(error); }
});

router.get('/automation/settings', authenticate, authorize(['admin']), async (_req, res, next) => {
  try {
    const settings = await BlogAutomation.findOneAndUpdate({ key:'daily-blog' }, { $setOnInsert:{ enabled:true, publishMode:'published', hourUtc:3 } }, { upsert:true, new:true });
    res.json({ settings });
  } catch (error) { next(error); }
});

router.put('/automation/settings', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const update = { enabled:Boolean(req.body.enabled), publishMode:req.body.publishMode === 'draft' ? 'draft' : 'published', hourUtc:Math.max(0,Math.min(23,Number(req.body.hourUtc)||3)) };
    const settings = await BlogAutomation.findOneAndUpdate({ key:'daily-blog' }, update, { upsert:true, new:true, runValidators:true });
    res.json({ settings });
  } catch (error) { next(error); }
});

router.post('/automation/generate', authenticate, authorize(['admin']), async (req, res, next) => {
  try { res.status(201).json(await createAutomatedBlog({ force:true, status:req.body.status === 'published' ? 'published' : 'draft' })); } catch (error) { next(error); }
});

router.post('/:id/regenerate', authenticate, authorize(['admin']), async (req, res, next) => {
  try { const post = await BlogPost.findById(req.params.id); if (!post) { res.status(404).json({ error:'Blog post not found' }); return; } res.json({ post:await regenerateAutomatedBlog(post) }); } catch (error) { next(error); }
});

router.post('/:id/regenerate-image', authenticate, authorize(['admin']), async (req, res, next) => {
  try { const post = await BlogPost.findById(req.params.id); if (!post) { res.status(404).json({ error:'Blog post not found' }); return; } res.json({ post:await regenerateAutomatedImage(post) }); } catch (error) { next(error); }
});

router.post('/:id/status', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const status = req.body.status === 'published' ? 'published' : 'draft';
    const post = await BlogPost.findByIdAndUpdate(req.params.id, { status, ...(status === 'published' ? { publishedAt:new Date() } : {}) }, { new:true, runValidators:true });
    if (!post) { res.status(404).json({ error:'Blog post not found' }); return; }
    if (status === 'published') await queueNewsletterCampaign('blog', post._id).catch(error => console.error('Blog newsletter queue failed', error));
    res.json({ post });
  } catch (error) { next(error); }
});

router.get('/', (req, res, next) => req.query.includeDrafts === 'true' ? authenticate(req as AuthRequest, res, () => authorize(['admin'])(req as AuthRequest, res, next)) : next(), async (req, res, next) => {
  try {
    const includeDrafts = req.query.includeDrafts === 'true';
    const query = includeDrafts ? {} : { status: 'published' };
    const posts = await BlogPost.find(query).sort({ publishedAt: -1, createdAt: -1 });
    res.json({ posts });
  } catch (error) {
    next(error);
  }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const post = await BlogPost.findOne({ slug: req.params.slug, status: 'published' });
    if (!post) {
      res.status(404).json({ error: 'Blog post not found' });
      return;
    }
    res.json({ post });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const post = await BlogPost.create(normalizePostPayload(req.body));
    if (post.status === 'published') await queueNewsletterCampaign('blog', post._id).catch(error => console.error('Blog newsletter queue failed', error));
    res.status(201).json({ post });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const post = await BlogPost.findByIdAndUpdate(req.params.id, normalizePostPayload(req.body), {
      new: true,
      runValidators: true,
    });
    if (!post) {
      res.status(404).json({ error: 'Blog post not found' });
      return;
    }
    if (post.status === 'published') await queueNewsletterCampaign('blog', post._id).catch(error => console.error('Blog newsletter queue failed', error));
    res.json({ post });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const post = await BlogPost.findByIdAndDelete(req.params.id);
    if (!post) {
      res.status(404).json({ error: 'Blog post not found' });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
