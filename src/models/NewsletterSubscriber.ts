import mongoose, { Document, Schema } from 'mongoose';

export type NewsletterStatus = 'pending' | 'subscribed' | 'unsubscribed';
export type NewsletterSource = 'footer' | 'blog' | 'checkout';

export interface INewsletterSubscriber extends Document {
  email: string;
  name?: string;
  status: NewsletterStatus;
  sources: NewsletterSource[];
  consentedAt: Date;
  confirmedAt?: Date;
  unsubscribedAt?: Date;
  confirmationTokenHash?: string;
  confirmationExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const newsletterSubscriberSchema = new Schema<INewsletterSubscriber>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  name: { type: String, trim: true },
  status: { type: String, enum: ['pending', 'subscribed', 'unsubscribed'], default: 'pending', index: true },
  sources: [{ type: String, enum: ['footer', 'blog', 'checkout'] }],
  consentedAt: { type: Date, required: true, default: Date.now },
  confirmedAt: Date,
  unsubscribedAt: Date,
  confirmationTokenHash: { type: String, select: false },
  confirmationExpiresAt: { type: Date, select: false },
}, { timestamps: true });

newsletterSubscriberSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<INewsletterSubscriber>('NewsletterSubscriber', newsletterSubscriberSchema);
