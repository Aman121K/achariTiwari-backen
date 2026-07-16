import express from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import BlogPost from '../models/BlogPost';
import { validateObjectIdParam } from '../middleware/validateObjectId';
import { queueNewsletterCampaign } from '../services/newsletter';

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
    publishedAt: body.status === 'published' ? body.publishedAt || new Date() : body.publishedAt,
  };
}

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
