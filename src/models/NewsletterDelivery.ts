import mongoose, { Document, Schema } from 'mongoose';

export interface INewsletterDelivery extends Document {
  campaignId: mongoose.Types.ObjectId;
  subscriberId: mongoose.Types.ObjectId;
  email: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';
  attempts: number;
  sentAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const newsletterDeliverySchema = new Schema<INewsletterDelivery>({
  campaignId: { type: Schema.Types.ObjectId, ref:'NewsletterCampaign', required:true, index:true },
  subscriberId: { type: Schema.Types.ObjectId, ref:'NewsletterSubscriber', required:true },
  email: { type:String, required:true, lowercase:true, trim:true },
  status: { type:String, enum:['pending','sending','sent','failed','skipped'], default:'pending', index:true },
  attempts: { type:Number, default:0 },
  sentAt: Date,
  lastError: String,
}, { timestamps:true });

newsletterDeliverySchema.index({ campaignId:1, subscriberId:1 }, { unique:true });

export default mongoose.model<INewsletterDelivery>('NewsletterDelivery', newsletterDeliverySchema);
