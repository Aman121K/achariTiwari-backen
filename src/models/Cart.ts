import mongoose, { Document, Schema } from 'mongoose';

export interface ICart extends Document {
  sessionId: string;
  userId?: mongoose.Types.ObjectId;
  customer?: { name?: string; email?: string; phone?: string };
  items: { productId: string; name: string; price: number; quantity: number; image?: string; sku?: string }[];
  subtotal: number;
  itemCount: number;
  checkoutStarted: boolean;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const cartSchema = new Schema<ICart>({
  sessionId: { type: String, required: true, unique: true, index: true, minlength: 16, maxlength: 100 },
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  customer: {
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
  },
  items: [{
    _id: false,
    productId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, max: 25 },
    image: String,
    sku: String,
  }],
  subtotal: { type: Number, required: true, min: 0 },
  itemCount: { type: Number, required: true, min: 1 },
  checkoutStarted: { type: Boolean, default: false },
  lastActivityAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

cartSchema.index({ updatedAt: -1 });
cartSchema.index({ checkoutStarted: 1, lastActivityAt: -1 });

export default mongoose.model<ICart>('Cart', cartSchema);
