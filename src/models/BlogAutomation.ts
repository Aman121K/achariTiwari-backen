import mongoose, { Document, Schema } from 'mongoose';

export interface IBlogAutomation extends Document {
  key: 'daily-blog';
  enabled: boolean;
  publishMode: 'published' | 'draft';
  hourUtc: number;
  lastRunDate?: string;
  lastRunAt?: Date;
  lastStatus?: 'running' | 'succeeded' | 'failed';
  lastError?: string;
  lastPost?: mongoose.Types.ObjectId;
}

const schema = new Schema<IBlogAutomation>({
  key: { type: String, unique: true, default: 'daily-blog' },
  enabled: { type: Boolean, default: true },
  publishMode: { type: String, enum: ['published', 'draft'], default: 'published' },
  hourUtc: { type: Number, min: 0, max: 23, default: 3 },
  lastRunDate: String,
  lastRunAt: Date,
  lastStatus: { type: String, enum: ['running', 'succeeded', 'failed'] },
  lastError: String,
  lastPost: { type: Schema.Types.ObjectId, ref: 'BlogPost' },
}, { timestamps: true });

export default mongoose.model<IBlogAutomation>('BlogAutomation', schema);
