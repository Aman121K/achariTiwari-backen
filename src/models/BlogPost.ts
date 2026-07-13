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
