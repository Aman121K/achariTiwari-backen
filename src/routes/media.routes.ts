import express from 'express';
import multer from 'multer';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import MediaAsset from '../models/MediaAsset';
import { deleteMedia, mediaStorageConfigured, uploadMedia } from '../services/media-storage';
import { validateObjectIdParam } from '../middleware/validateObjectId';

const router = express.Router();
router.param('id', validateObjectIdParam);
const allowedTypes = new Set(['image/jpeg','image/png','image/webp','image/gif','image/avif','application/pdf']);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 }, fileFilter: (_req,file,done) => {
  if (!allowedTypes.has(file.mimetype)) { done(new Error('Only JPG, PNG, WebP, GIF, AVIF and PDF files are allowed.')); return; }
  done(null, true);
} });

router.use(authenticate, authorize(['admin']));

router.get('/', async (req, res, next) => {
  try { return res.json({ configured: mediaStorageConfigured(), assets: await MediaAsset.find().sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit)||100,250)) }); }
  catch (error) { return next(error); }
});

router.post('/', upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose a file to upload.' });
    const stored = await uploadMedia(req.file, String(req.body.folder || 'general'));
    const asset = await MediaAsset.create({ ...stored, originalName:req.file.originalname, mimeType:req.file.mimetype, size:req.file.size, uploadedBy:req.userId });
    return res.status(201).json({ asset });
  } catch (error) { return next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const asset = await MediaAsset.findById(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Media asset not found.' });
    await deleteMedia(asset.key); await asset.deleteOne();
    return res.json({ ok:true });
  } catch (error) { return next(error); }
});

export default router;
