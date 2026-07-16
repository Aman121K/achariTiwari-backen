import mongoose, { Schema, Document } from 'mongoose';

export interface IOrder extends Document {
  _id: string;
  userId?: mongoose.Types.ObjectId;
  guestAccessTokenHash?: string;
  isGuest: boolean;
  customer: { name: string; email: string; phone: string };
  orderNumber: string;
  items: {
    productId: mongoose.Types.ObjectId | string;
    name: string;
    price: number;
    quantity: number;
    image: string;
  }[];
  subtotal: number;
  shippingCost: number;
  tax: number;
  discountAmount: number;
  discountCode?: string;
  total: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentMethod: 'card' | 'upi' | 'bank_transfer' | 'cash_on_delivery';
  shippingAddress: {
    name: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  trackingNumber?: string;
  notes?: string;
  marketingAccepted: boolean;
  marketingAcceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    guestAccessTokenHash: { type: String, select: false },
    isGuest: { type: Boolean, default: true },
    customer: {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      phone: { type: String, required: true, trim: true },
    },
    orderNumber: { type: String, unique: true, required: true },
    items: [
      {
        productId: { type: Schema.Types.Mixed, required: true },
        name: String,
        price: Number,
        quantity: Number,
        image: String,
      },
    ],
    subtotal: { type: Number, required: true },
    shippingCost: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    discountCode: String,
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['card', 'upi', 'bank_transfer', 'cash_on_delivery'],
      required: true,
    },
    shippingAddress: {
      name: String,
      phone: String,
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    trackingNumber: String,
    notes: String,
    marketingAccepted: { type: Boolean, default: false },
    marketingAcceptedAt: Date,
  },
  { timestamps: true }
);

// Supports paginated customer history and admin/status queues without collection scans.
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ 'customer.email': 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<IOrder>('Order', orderSchema);
