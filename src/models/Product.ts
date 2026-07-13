import mongoose, { Schema, Document } from 'mongoose';

export interface IProductVariant {
  label: string;
  size: string;
  optionValues: string[];
  sku: string;
  barcode?: string;
  price: number;
  compareAtPrice?: number;
  costPerItem?: number;
  inventory: number;
  lowStockThreshold: number;
  weightKg?: number;
  isActive: boolean;
}

export interface IProductOption {
  name: string;
  values: string[];
}

export interface IProduct extends Document {
  _id: string;
  title: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  images: string[];
  category: mongoose.Types.ObjectId;
  subCategory?: mongoose.Types.ObjectId;
  productType?: string;
  vendor?: string;
  collections: string[];
  options: IProductOption[];
  variants: IProductVariant[];
  tags: string[];
  ingredients: string[];
  salesChannels: string[];
  marketing: {
    badge?: string;
    campaign?: string;
    upsellProductSlugs: string[];
    crossSellProductSlugs: string[];
  };
  shipping: {
    isPhysicalProduct: boolean;
    weightKg?: number;
    hsnCode?: string;
    shelfLife?: string;
  };
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords: string[];
  searchEngine: {
    title?: string;
    description?: string;
    keywords: string[];
  };
  status: 'draft' | 'active' | 'archived';
  featured: boolean;
  publishAt?: Date;
  rating: number;
  reviews: {
    userId?: mongoose.Types.ObjectId;
    name: string;
    email?: string;
    rating: number;
    comment: string;
    isApproved: boolean;
    createdAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const productOptionSchema = new Schema<IProductOption>(
  {
    name: { type: String, required: true, trim: true },
    values: [{ type: String, required: true, trim: true }],
  },
  { _id: false }
);

const productVariantSchema = new Schema<IProductVariant>(
  {
    label: { type: String, required: true, trim: true },
    size: { type: String, required: true, trim: true },
    optionValues: [{ type: String, trim: true }],
    sku: { type: String, required: true, trim: true },
    barcode: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    costPerItem: { type: Number, min: 0 },
    inventory: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, min: 0, default: 5 },
    weightKg: { type: Number, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const productSchema = new Schema<IProduct>(
  {
    title: { type: String, required: true, trim: true },
    name: { type: String, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    shortDescription: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    images: [{ type: String, trim: true }],
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    subCategory: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    productType: { type: String, trim: true },
    vendor: { type: String, trim: true, default: 'Achari Tiwari' },
    collections: [{ type: String, trim: true }],
    options: { type: [productOptionSchema], default: [] },
    variants: { type: [productVariantSchema], default: [] },
    tags: [{ type: String, trim: true }],
    ingredients: [{ type: String, trim: true }],
    salesChannels: {
      type: [{ type: String, trim: true }],
      default: ['online_store'],
    },
    marketing: {
      badge: { type: String, trim: true },
      campaign: { type: String, trim: true },
      upsellProductSlugs: [{ type: String, trim: true }],
      crossSellProductSlugs: [{ type: String, trim: true }],
    },
    shipping: {
      isPhysicalProduct: { type: Boolean, default: true },
      weightKg: { type: Number, min: 0 },
      hsnCode: { type: String, trim: true },
      shelfLife: { type: String, trim: true },
    },
    seoTitle: { type: String, trim: true },
    seoDescription: { type: String, trim: true },
    seoKeywords: [{ type: String, trim: true }],
    searchEngine: {
      title: { type: String, trim: true },
      description: { type: String, trim: true },
      keywords: [{ type: String, trim: true }],
    },
    status: { type: String, enum: ['draft', 'active', 'archived'], default: 'draft' },
    featured: { type: Boolean, default: false },
    publishAt: Date,
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviews: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        name: { type: String, required: true, trim: true },
        email: { type: String, trim: true, lowercase: true },
        rating: { type: Number, required: true },
        comment: String,
        isApproved: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

productSchema.pre('validate', function syncLegacyName(next) {
  if (!this.name) this.name = this.title;
  next();
});

productSchema.index({
  title: 'text',
  description: 'text',
  tags: 'text',
  collections: 'text',
  productType: 'text',
});

export default mongoose.model<IProduct>('Product', productSchema);
