import crypto from 'crypto';
import path from 'path';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const region = process.env.AWS_REGION || 'ap-south-1';
const bucket = process.env.AWS_S3_BUCKET || '';
const client = new S3Client({ region });

const safePart = (value: string) => value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');

export function mediaStorageConfigured() { return Boolean(bucket); }

export async function uploadMedia(file: Express.Multer.File, requestedFolder: string) {
  if (!bucket) throw new Error('AWS_S3_BUCKET is not configured.');
  const folder = safePart(requestedFolder || 'general') || 'general';
  const extension = safePart(path.extname(file.originalname)) || (file.mimetype === 'image/webp' ? '.webp' : '');
  const base = safePart(path.basename(file.originalname, path.extname(file.originalname))) || 'asset';
  const key = `media/${folder}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${base}${extension}`;
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: file.buffer, ContentType: file.mimetype, CacheControl: 'public, max-age=31536000, immutable', Metadata: { originalName: encodeURIComponent(file.originalname) } }));
  const cdn = process.env.AWS_CLOUDFRONT_URL?.replace(/\/$/, '');
  const url = cdn ? `${cdn}/${key}` : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  return { key, url, folder };
}

export async function deleteMedia(key: string) {
  if (!bucket) throw new Error('AWS_S3_BUCKET is not configured.');
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
