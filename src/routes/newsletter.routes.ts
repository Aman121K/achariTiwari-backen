import express from 'express';
import rateLimit from 'express-rate-limit';
import { confirmNewsletterSubscription, subscribeToNewsletter, unsubscribeFromNewsletter } from '../services/newsletter';

const router = express.Router();
const subscriptionLimit = rateLimit({ windowMs:15 * 60 * 1000, limit:8, standardHeaders:'draft-7', legacyHeaders:false, message:{ error:'Too many subscription attempts. Please try again later.' } });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const resultPage = (title:string, message:string, success:boolean) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;background:#f7f1e7;color:#2b241b;font-family:Arial,sans-serif"><main style="max-width:560px;margin:8vh auto;padding:48px 28px;background:#fffaf2;border:1px solid #eadcc8;text-align:center"><p style="color:#c28a2c;font-size:12px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase">Achari Tiwari newsletter</p><h1 style="font-family:Georgia,serif;font-size:32px;color:#254d2b">${title}</h1><p style="line-height:1.7;color:#5f5345">${message}</p><a href="${process.env.SITE_URL || 'https://www.aacharitiwari.com'}" style="display:inline-block;margin-top:16px;padding:14px 22px;background:${success ? '#254d2b' : '#8f1715'};color:white;text-decoration:none;font-weight:700">Return to the pantry</a></main></body></html>`;

router.post('/subscribe', subscriptionLimit, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const name = String(req.body.name || '').trim();
    const source = ['footer','blog','checkout'].includes(req.body.source) ? req.body.source : 'footer';
    if (!emailPattern.test(email) || email.length > 254) return res.status(400).json({ error:'Enter a valid email address.' });
    const inferredBase = `${req.protocol}://${req.get('host')}/api`;
    await subscribeToNewsletter({ email, name, source, confirmationBaseUrl:process.env.PUBLIC_API_URL || inferredBase });
    return res.status(202).json({ message:'Check your inbox and confirm your subscription.' });
  } catch (error) { return next(error); }
});

router.get('/confirm', async (req, res, next) => {
  try {
    const confirmed = await confirmNewsletterSubscription(String(req.query.token || ''));
    return res.status(confirmed ? 200 : 400).type('html').send(resultPage(confirmed ? 'You’re on the list.' : 'This confirmation link is invalid.', confirmed ? 'Fresh product launches, kitchen stories and offers will now arrive in your inbox.' : 'The link may have expired. Please subscribe again from the website.', confirmed));
  } catch (error) { return next(error); }
});

const unsubscribe = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const removed = await unsubscribeFromNewsletter(String(req.query.token || req.body?.token || ''));
    if (req.method === 'POST') return res.status(removed ? 200 : 400).json({ ok:removed });
    return res.status(removed ? 200 : 400).type('html').send(resultPage(removed ? 'You have been unsubscribed.' : 'This unsubscribe link is invalid.', removed ? 'You will no longer receive product and story announcements from us.' : 'Please contact support if you still need help managing email preferences.', removed));
  } catch (error) { return next(error); }
};

router.get('/unsubscribe', unsubscribe);
router.post('/unsubscribe', subscriptionLimit, unsubscribe);

export default router;
