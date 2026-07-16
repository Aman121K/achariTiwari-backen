import mongoose, { Document, Schema } from 'mongoose';

export interface INewsletterCampaign extends Document {
  kind: 'product' | 'blog';
  contentId: mongoose.Types.ObjectId;
  status: 'queued' | 'sending' | 'completed' | 'partial' | 'failed';
  attempted: number;
  sent: number;
  failed: number;
  startedAt?: Date;
  completedAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const newsletterCampaignSchema = new Schema<INewsletterCampaign>({
  kind: { type: String, enum: ['product', 'blog'], required: true },
  contentId: { type: Schema.Types.ObjectId, required: true },
  status: { type: String, enum: ['queued', 'sending', 'completed', 'partial', 'failed'], default: 'queued', index: true },
  attempted: { type: Number, default: 0 },
  sent: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  startedAt: Date,
  completedAt: Date,
  lastError: String,
}, { timestamps: true });

newsletterCampaignSchema.index({ kind: 1, contentId: 1 }, { unique: true });

export default mongoose.model<INewsletterCampaign>('NewsletterCampaign', newsletterCampaignSchema);
