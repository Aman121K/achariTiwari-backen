import mongoose, { Schema, Document } from 'mongoose';

export interface IBanner extends Document {
  _id: string;
  title: string;
  description: string;
  image: string;
  mobileImage: string;
  link: string;
  linkType: 'product' | 'category' | 'external' | 'none';
  position: number;
  displayLocation: 'home' | 'category' | 'search';
  validFrom: Date;
  validTo: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const bannerSchema = new Schema<IBanner>(
  {
    title: { type: String, required: true },
    description: String,
    image: { type: String, required: true },
    mobileImage: String,
    link: String,
    linkType: { type: String, enum: ['product', 'category', 'external', 'none'], default: 'none' },
    position: { type: Number, default: 0 },
    displayLocation: { type: String, enum: ['home', 'category', 'search'], default: 'home' },
    validFrom: { type: Date, required: true },
    validTo: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IBanner>('Banner', bannerSchema);
