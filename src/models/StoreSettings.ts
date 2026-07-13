import mongoose, { Schema, Document } from 'mongoose';

export interface IStoreSettings extends Document {
  key: string;
  storeName: string;
  supportEmail: string;
  supportPhone: string;
  announcement: string;
  heroTitle: string;
  heroDescription: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  pageSeo: Record<string, { title: string; description: string }>;
  termsContent: string;
  privacyContent: string;
  refundContent: string;
  shippingContent: string;
  acceptedPayments: ('cod' | 'upi')[];
  freeShippingThreshold: number;
}

const schema = new Schema<IStoreSettings>({
  key: { type: String, unique: true, default: 'primary' },
  storeName: { type: String, default: 'Achari Tiwari' },
  supportEmail: { type: String, default: 'aacharitiwari@gmail.com' },
  supportPhone: { type: String, default: '+91 79730 70600' },
  announcement: { type: String, default: 'Free delivery on orders above ₹699' },
  heroTitle: { type: String, default: 'Ghar ka swaad, har bite mein pyaar' },
  heroDescription: { type: String, default: 'Traditional Indian aachar made with natural ingredients and time-honoured recipes.' },
  seoTitle: { type: String, default: 'Achari Tiwari | Authentic Indian Aachar Online' },
  seoDescription: { type: String, default: 'Shop traditional Indian pickles made with natural ingredients and authentic recipes.' },
  seoKeywords: { type: [String], default: ['Indian pickle', 'aachar online', 'homemade pickle'] },
  pageSeo: { type: Schema.Types.Mixed, default: {} },
  termsContent: { type: String, default: 'These terms govern purchases made from Achari Tiwari. Product availability, pricing and delivery estimates may change.' },
  privacyContent: { type: String, default: 'We collect only the information needed to process orders, provide support and improve our services.' },
  refundContent: { type: String, default: 'Contact support within 7 days for damaged, incorrect or quality-affected orders. Include your order number and photographs.' },
  shippingContent: { type: String, default: 'Orders are carefully packed and normally delivered within 2–5 business days, depending on the destination.' },
  acceptedPayments: { type: [String], enum: ['cod', 'upi'], default: ['cod', 'upi'] },
  freeShippingThreshold: { type: Number, default: 699, min: 0 },
}, { timestamps: true });

export default mongoose.model<IStoreSettings>('StoreSettings', schema);
