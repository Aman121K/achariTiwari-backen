import crypto from 'crypto';
import mongoose from 'mongoose';
import NewsletterCampaign from '../models/NewsletterCampaign';
import NewsletterSubscriber, { NewsletterSource } from '../models/NewsletterSubscriber';
import NewsletterDelivery from '../models/NewsletterDelivery';
import Product from '../models/Product';
import BlogPost from '../models/BlogPost';
import { sendNewsletterBlog, sendNewsletterConfirmation, sendNewsletterProduct } from './email';

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const tokenHash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const stripHtml = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const currency = (value: unknown) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const apiBase = () => (process.env.PUBLIC_API_URL || 'https://api-achar.phoneclubs.com/api').replace(/\/$/, '');
const tokenSecret = () => process.env.NEWSLETTER_SECRET || process.env.JWT_SECRET || 'change-this-newsletter-secret';

export function createUnsubscribeToken(email: string) {
  const payload = Buffer.from(normalizeEmail(email)).toString('base64url');
  const signature = crypto.createHmac('sha256', tokenSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function emailFromUnsubscribeToken(token: string) {
  const [payload, provided] = token.split('.');
  if (!payload || !provided) return null;
  const expected = crypto.createHmac('sha256', tokenSecret()).update(payload).digest();
  let actual: Buffer;
  try { actual = Buffer.from(provided, 'base64url'); } catch { return null; }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try { return normalizeEmail(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return null; }
}

export async function subscribeToNewsletter(input: { email:string; name?:string; source:NewsletterSource; confirmationBaseUrl?:string }) {
  const email = normalizeEmail(input.email);
  const existing = await NewsletterSubscriber.findOne({ email }).select('+confirmationTokenHash +confirmationExpiresAt');
  if (existing?.status === 'subscribed') return;

  const rawToken = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const subscriber = existing || new NewsletterSubscriber({ email, sources: [] });
  if (input.name) subscriber.name = input.name.trim();
  subscriber.status = 'pending';
  subscriber.consentedAt = now;
  subscriber.unsubscribedAt = undefined;
  subscriber.confirmationTokenHash = tokenHash(rawToken);
  subscriber.confirmationExpiresAt = expires;
  if (!subscriber.sources.includes(input.source)) subscriber.sources.push(input.source);
  await subscriber.save();

  const base = (input.confirmationBaseUrl || apiBase()).replace(/\/$/, '');
  const delivered = await sendNewsletterConfirmation(email, `${base}/newsletter/confirm?token=${encodeURIComponent(rawToken)}`);
  if (!delivered) throw new Error('Email delivery is not configured. Please try again later.');
}

export async function confirmNewsletterSubscription(token: string) {
  const subscriber = await NewsletterSubscriber.findOne({ confirmationTokenHash:tokenHash(token), confirmationExpiresAt:{ $gt:new Date() } }).select('+confirmationTokenHash +confirmationExpiresAt');
  if (!subscriber) return false;
  subscriber.status = 'subscribed';
  subscriber.confirmedAt = new Date();
  subscriber.unsubscribedAt = undefined;
  subscriber.confirmationTokenHash = undefined;
  subscriber.confirmationExpiresAt = undefined;
  await subscriber.save();
  return true;
}

export async function unsubscribeFromNewsletter(token: string) {
  const email = emailFromUnsubscribeToken(token);
  if (!email) return false;
  const subscriber = await NewsletterSubscriber.findOne({ email });
  if (!subscriber) return true;
  subscriber.status = 'unsubscribed';
  subscriber.unsubscribedAt = new Date();
  subscriber.confirmationTokenHash = undefined;
  subscriber.confirmationExpiresAt = undefined;
  await subscriber.save();
  return true;
}

const unsubscribeUrl = (email: string) => `${apiBase()}/newsletter/unsubscribe?token=${encodeURIComponent(createUnsubscribeToken(email))}`;

async function processCampaign(campaignId: mongoose.Types.ObjectId | string) {
  const campaign = await NewsletterCampaign.findOneAndUpdate({ _id:campaignId, status:'queued' }, { $set:{ status:'sending', startedAt:new Date(), lastError:undefined }, $setOnInsert:{ attempted:0, sent:0, failed:0 } }, { new:true });
  if (!campaign) return;

  try {
    const content = campaign.kind === 'product' ? await Product.findById(campaign.contentId).lean() : await BlogPost.findById(campaign.contentId).lean();
    if (!content) throw new Error('Published newsletter content no longer exists.');
    const subscribers = await NewsletterSubscriber.find({ status:'subscribed' }).select('email').lean();
    if (subscribers.length) {
      await NewsletterDelivery.bulkWrite(subscribers.map((subscriber) => ({ updateOne:{ filter:{ campaignId:campaign._id, subscriberId:subscriber._id }, update:{ $setOnInsert:{ email:subscriber.email, status:'pending', attempts:0 } }, upsert:true } })));
    }
    await NewsletterDelivery.updateMany({ campaignId:campaign._id, status:'sending' }, { $set:{ status:'pending', lastError:'Delivery resumed after interruption.' } });
    const deliveries = await NewsletterDelivery.find({ campaignId:campaign._id, status:{ $in:['pending','failed'] }, attempts:{ $lt:4 } }).lean();

    for (let index = 0; index < deliveries.length; index += 10) {
      const batch = deliveries.slice(index, index + 10);
      await Promise.all(batch.map(async (delivery) => {
        const stillSubscribed = await NewsletterSubscriber.exists({ _id:delivery.subscriberId, status:'subscribed' });
        if (!stillSubscribed) {
          await NewsletterDelivery.updateOne({ _id:delivery._id }, { $set:{ status:'skipped', lastError:'Subscriber opted out before delivery.' } });
          return;
        }
        await NewsletterDelivery.updateOne({ _id:delivery._id, status:{ $ne:'sent' } }, { $set:{ status:'sending', lastError:undefined }, $inc:{ attempts:1 } });
        const optOut = unsubscribeUrl(delivery.email);
        try {
          let delivered: boolean;
        if (campaign.kind === 'product') {
          const product = content as any;
          const variant = product.variants?.find((item:any) => item.isActive !== false) || product.variants?.[0];
            delivered = await sendNewsletterProduct(delivery.email, { title:product.title, description:stripHtml(product.shortDescription || product.description || ''), image:product.images?.[0], price:currency(variant?.price), url:`${process.env.SITE_URL || 'https://www.aacharitiwari.com'}/product/${product.slug || product._id}` }, optOut);
          } else {
            const post = content as any;
            delivered = await sendNewsletterBlog(delivery.email, { title:post.title, excerpt:stripHtml(post.excerpt || ''), image:post.coverImage, category:String(post.category || 'Kitchen stories').replace(/-/g, ' '), url:`${process.env.SITE_URL || 'https://www.aacharitiwari.com'}/blog/${post.slug}` }, optOut);
          }
          if (!delivered) throw new Error('SMTP is not configured.');
          await NewsletterDelivery.updateOne({ _id:delivery._id }, { $set:{ status:'sent', sentAt:new Date(), lastError:undefined } });
        } catch (error) {
          await NewsletterDelivery.updateOne({ _id:delivery._id }, { $set:{ status:'failed', lastError:error instanceof Error ? error.message : 'Delivery failed' } });
        }
      }));
      const [attempted, sent, failed] = await Promise.all([
        NewsletterDelivery.countDocuments({ campaignId:campaign._id, attempts:{ $gt:0 } }),
        NewsletterDelivery.countDocuments({ campaignId:campaign._id, status:'sent' }),
        NewsletterDelivery.countDocuments({ campaignId:campaign._id, status:'failed' }),
      ]);
      await NewsletterCampaign.updateOne({ _id:campaign._id }, { $set:{ attempted, sent, failed } });
    }

    const [attempted, sent, failed] = await Promise.all([
      NewsletterDelivery.countDocuments({ campaignId:campaign._id, attempts:{ $gt:0 } }),
      NewsletterDelivery.countDocuments({ campaignId:campaign._id, status:'sent' }),
      NewsletterDelivery.countDocuments({ campaignId:campaign._id, status:'failed' }),
    ]);
    await NewsletterCampaign.updateOne({ _id:campaign._id }, { $set:{ status:failed ? 'partial' : 'completed', attempted, sent, failed, completedAt:new Date() } });
  } catch (error) {
    await NewsletterCampaign.updateOne({ _id:campaign._id }, { $set:{ status:'failed', completedAt:new Date(), lastError:error instanceof Error ? error.message : 'Newsletter delivery failed' } });
    console.error('Newsletter campaign failed', error);
  }
}

export async function queueNewsletterCampaign(kind: 'product' | 'blog', contentId: mongoose.Types.ObjectId | string) {
  try {
    const campaign = await NewsletterCampaign.create({ kind, contentId, status:'queued' });
    setImmediate(() => { void processCampaign(campaign._id); });
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    const campaign = await NewsletterCampaign.findOneAndUpdate({ kind, contentId, status:{ $in:['partial','failed'] } }, { $set:{ status:'queued', completedAt:undefined, lastError:undefined } }, { new:true });
    if (campaign) setImmediate(() => { void processCampaign(campaign._id); });
  }
}

export async function resumeNewsletterCampaigns() {
  await NewsletterCampaign.updateMany({ status:'sending' }, { $set:{ status:'queued', lastError:'Delivery resumed after a server restart.' } });
  const queued = await NewsletterCampaign.find({ status:'queued' }).select('_id').limit(20).lean();
  queued.forEach((campaign) => setImmediate(() => { void processCampaign(campaign._id); }));
}
