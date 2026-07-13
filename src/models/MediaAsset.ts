import mongoose, { Document, Schema } from 'mongoose';

export interface IMediaAsset extends Document {
  key: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
  folder: string;
  uploadedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const schema = new Schema<IMediaAsset>({
  key: { type: String, required: true, unique: true, index: true },
  url: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true, min: 1 },
  folder: { type: String, required: true, index: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model<IMediaAsset>('MediaAsset', schema);
