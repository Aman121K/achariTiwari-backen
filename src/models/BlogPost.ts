import mongoose, { Schema, Document } from 'mongoose';

export interface IBlogPost extends Document {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage?: string;
  category: 'recipes' | 'ingredients' | 'brand-stories' | 'health' | 'regional-aachar' | 'news';
  author: string;
  tags: string[];
  seoTitle?: string;
  seoDescription?: string;
  focusKeyword?: string;
  relatedProductSlugs: string[];
  relatedBlogSlugs: string[];
  secondaryKeywords: string[];
  faq: { question: string; answer: string }[];
  imageAlt?: string;
  imageCaption?: string;
  imageTitle?: string;
  readingTime?: number;
  schemaMarkup?: Record<string, unknown>;
  automation?: {
    generated: boolean;
    topic?: string;
    contentType?: string;
    season?: string;
    qualityScore?: number;
    generatedAt?: Date;
  };
  status: 'draft' | 'published';
  featured: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const blogPostSchema = new Schema<IBlogPost>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    excerpt: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    coverImage: { type: String, trim: true },
    category: {
      type: String,
      enum: ['recipes', 'ingredients', 'brand-stories', 'health', 'regional-aachar', 'news'],
      default: 'recipes',
    },
    author: { type: String, required: true, trim: true, default: 'Achari Tiwari Kitchen' },
    tags: [{ type: String, trim: true }],
    seoTitle: { type: String, trim: true },
    seoDescription: { type: String, trim: true },
    focusKeyword: { type: String, trim: true },
    relatedProductSlugs: [{ type: String, trim: true }],
    relatedBlogSlugs: [{ type: String, trim: true }],
    secondaryKeywords: [{ type: String, trim: true }],
    faq: [{ _id: false, question: { type: String, trim: true }, answer: { type: String, trim: true } }],
    imageAlt: { type: String, trim: true },
    imageCaption: { type: String, trim: true },
    imageTitle: { type: String, trim: true },
    readingTime: { type: Number, min: 1 },
    schemaMarkup: { type: Schema.Types.Mixed },
    automation: {
      generated: { type: Boolean, default: false },
      topic: { type: String, trim: true },
      contentType: { type: String, trim: true },
      season: { type: String, trim: true },
      qualityScore: { type: Number, min: 0, max: 100 },
      generatedAt: Date,
    },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    featured: { type: Boolean, default: false },
    publishedAt: Date,
  },
  { timestamps: true }
);

blogPostSchema.index({
  title: 'text',
  excerpt: 'text',
  content: 'text',
  tags: 'text',
  focusKeyword: 'text',
});

export default mongoose.model<IBlogPost>('BlogPost', blogPostSchema);
