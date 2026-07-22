import { GoogleGenAI } from '@google/genai';
import BlogPost, { IBlogPost } from '../models/BlogPost';
import BlogAutomation from '../models/BlogAutomation';
import Product from '../models/Product';
import { uploadMediaBuffer } from './media-storage';
import { queueNewsletterCampaign } from './newsletter';
import sanitizeHtml from 'sanitize-html';

const CONTENT_TYPES = ['Recipe','Traditional Story','Village Memory','Seasonal Food','Festival Food','Breakfast Pairing','Lunch Pairing','Dinner Pairing','Travel Food','Indian Culture','Mustard Oil','Spices','Food Science','Buying Guide','Storage Guide','Regional Taste'];
const PRODUCTS = [
  { name: 'Bharwa Lal Mirchi Pickle', weight: 40, hints: ['bharwa-lal-mirchi', 'lal-mirchi', 'chilli'] },
  { name: 'Mango Pickle', weight: 40, hints: ['mango', 'aam'] },
  { name: 'Garlic Pickle', weight: 20, hints: ['garlic', 'lahsun'] },
];

type GeneratedArticle = {
  title: string; slug: string; excerpt: string; content: string; category: 'recipes'|'ingredients'|'brand-stories'|'health'|'regional-aachar'|'news';
  seoTitle: string; seoDescription: string; focusKeyword: string; secondaryKeywords: string[]; tags: string[];
  faq: { question: string; answer: string }[]; imagePrompt: string; imageAlt: string; imageCaption: string; imageTitle: string;
};

const articleSchema = {
  type: 'object', additionalProperties: false,
  required: ['title','slug','excerpt','content','category','seoTitle','seoDescription','focusKeyword','secondaryKeywords','tags','faq','imagePrompt','imageAlt','imageCaption','imageTitle'],
  properties: {
    title:{type:'string'}, slug:{type:'string'}, excerpt:{type:'string'}, content:{type:'string'},
    category:{type:'string',enum:['recipes','ingredients','brand-stories','health','regional-aachar','news']},
    seoTitle:{type:'string'}, seoDescription:{type:'string'}, focusKeyword:{type:'string'},
    secondaryKeywords:{type:'array',items:{type:'string'},minItems:3,maxItems:8}, tags:{type:'array',items:{type:'string'},minItems:3,maxItems:10},
    faq:{type:'array',minItems:4,maxItems:7,items:{type:'object',additionalProperties:false,required:['question','answer'],properties:{question:{type:'string'},answer:{type:'string'}}}},
    imagePrompt:{type:'string'}, imageAlt:{type:'string'}, imageCaption:{type:'string'}, imageTitle:{type:'string'},
  },
};

function client() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured.');
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

function seasonFor(date = new Date()) {
  const month = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', month: 'numeric' }).format(date));
  if ([3,4,5,6].includes(month)) return 'Indian summer and raw mango season';
  if ([7,8,9].includes(month)) return 'Indian monsoon and comforting spicy meals';
  if ([10,11].includes(month)) return 'Indian festival season and traditional family meals';
  return 'Indian winter and warming garlic-forward food';
}

function weightedProduct() {
  const value = Math.random() * 100;
  return value < 40 ? PRODUCTS[0] : value < 80 ? PRODUCTS[1] : PRODUCTS[2];
}

function slugify(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 90);
}

function stripHtml(value: string) { return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
function words(value: string) { return stripHtml(value).split(/\s+/).filter(Boolean); }

function scoreArticle(article: GeneratedArticle) {
  const wordCount = words(article.content).length;
  const text = stripHtml(article.content).toLowerCase();
  const keyword = article.focusKeyword.toLowerCase();
  const density = text.split(keyword).length - 1;
  const required = ['table of contents','ingredients','pairing','storage','frequently asked','conclusion'];
  let score = 0;
  if (wordCount >= 1000 && wordCount <= 2200) score += 30;
  if (article.seoTitle.length >= 35 && article.seoTitle.length <= 65) score += 10;
  if (article.seoDescription.length >= 120 && article.seoDescription.length <= 165) score += 10;
  if (required.filter(item => text.includes(item)).length >= 5) score += 20;
  if (article.faq.length >= 4) score += 10;
  if (density >= 2 && density <= Math.max(10, Math.ceil(wordCount * .02))) score += 10;
  if (PRODUCTS.every(product => text.includes(product.name.toLowerCase()))) score += 10;
  return { score, wordCount };
}

async function histories() {
  const posts = await BlogPost.find().select('title slug focusKeyword secondaryKeywords automation.topic').sort({ createdAt: -1 }).limit(500).lean();
  return {
    topics: posts.map(post => post.automation?.topic || post.title).filter(Boolean),
    slugs: posts.map(post => post.slug),
    keywords: posts.flatMap(post => [post.focusKeyword, ...(post.secondaryKeywords || [])]).filter(Boolean),
  };
}

async function productLinks() {
  const products = await Product.find({ status: 'active' }).select('title slug').lean();
  const chosen = PRODUCTS.map(target => products.find(product => target.hints.some(hint => product.slug.includes(hint) || product.title.toLowerCase().includes(hint.replace(/-/g, ' '))))).filter(Boolean);
  return Array.from(new Set([...chosen.map(product => product!.slug), ...products.map(product => product.slug)])).slice(0, 3);
}

async function relatedBlogs(focusKeyword: string) {
  const terms = focusKeyword.split(/\s+/).filter(term => term.length > 3).slice(0, 4);
  const query = terms.length ? { status:'published', $text:{ $search:terms.join(' ') } } : { status:'published' };
  try { return (await BlogPost.find(query).sort({ publishedAt:-1 }).limit(3).select('slug').lean()).map(post => post.slug); }
  catch { return (await BlogPost.find({ status:'published' }).sort({ publishedAt:-1 }).limit(3).select('slug').lean()).map(post => post.slug); }
}

async function generateArticle(existing?: IBlogPost): Promise<{ article: GeneratedArticle; topic: string; contentType: string; season: string; qualityScore: number }> {
  const history = await histories();
  const hero = weightedProduct();
  const contentType = existing?.automation?.contentType || CONTENT_TYPES[Math.floor(Math.random() * CONTENT_TYPES.length)];
  const season = seasonFor();
  const topic = existing?.automation?.topic || `${contentType}: ${hero.name} for ${season}`;
  const prompt = `Create one original AchariTiwari SEO article.\nPrimary product: ${hero.name} (natural emphasis only).\nSeason: ${season}. Content type: ${contentType}.\nAudience: Indian families, food lovers, students, working professionals and NRIs, especially UP, Bihar, Jharkhand and West Bengal.\nAvoid these existing topics: ${history.topics.slice(0,80).join(' | ')}\nAvoid these slugs: ${history.slugs.slice(0,100).join(', ')}\nAvoid these focus keywords: ${history.keywords.slice(0,100).join(', ')}\n\nRequirements: 1200-2000 words, minimum 1000. Human editorial voice with specific sensory and cultural detail; never generic, robotic or salesy. Include an interesting hook, traditional story, why the pickle is special, taste experience, seasonal relevance, authentic ingredients, food pairings, storage tips, serving suggestions, conclusion and subtle CTA. Include a linked table of contents. Use semantic HTML only for content (h2/h3/p/ul/ol/a), no document/body tags. Naturally mention and recommend Bharwa Lal Mirchi Pickle, Mango Pickle and Garlic Pickle. Never make medical claims; use cautious food-language only. The image prompt must request ultra-premium realistic luxury food photography in a rustic Indian kitchen, earthen pot, wooden table, natural light, mustard oil and traditional masala, editorial style, no text, no watermark. Slug must be lowercase ASCII kebab-case. SEO title max 65 chars; description 120-165 chars.`;
  let last: GeneratedArticle | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response: any = await client().interactions.create({
      model: process.env.GEMINI_TEXT_MODEL || 'gemini-3.6-flash',
      input: `You are an expert Indian food editor and technical SEO strategist. Return only schema-valid data. Preserve factual caution and a natural human voice.\n\n${attempt ? `${prompt}\nPrevious draft failed quality checks. Rewrite with complete required sections and 1200-2000 words.` : prompt}`,
      response_format: { type:'text', mime_type:'application/json', schema:articleSchema },
    });
    if (!response.output_text) throw new Error('Gemini returned no article text.');
    last = JSON.parse(response.output_text) as GeneratedArticle;
    last.slug = slugify(last.slug || last.title);
    last.content = sanitizeHtml(last.content, {
      allowedTags: ['h2','h3','p','ul','ol','li','strong','em','a','blockquote'],
      allowedAttributes: { a:['href','title'] },
      allowedSchemes: ['http','https'],
      transformTags: { a: sanitizeHtml.simpleTransform('a', { rel:'noopener noreferrer' }) },
    });
    const duplicate = await BlogPost.exists({ slug: last.slug, ...(existing ? { _id:{ $ne:existing._id } } : {}) });
    const quality = scoreArticle(last);
    if (!duplicate && quality.score >= 80) return { article:last, topic, contentType, season, qualityScore:quality.score };
  }
  if (!last) throw new Error('The article model returned no content.');
  throw new Error(`Generated article did not pass the quality threshold (score ${scoreArticle(last).score}/100).`);
}

async function generateImage(article: Pick<GeneratedArticle,'imagePrompt'|'slug'>) {
  const result: any = await client().interactions.create({
    model: process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-lite-image',
    input: article.imagePrompt,
    response_format: { type:'image', mime_type:'image/png', aspect_ratio:'3:2', image_size:'1K' },
  });
  const encoded = result.output_image?.data;
  if (!encoded) throw new Error('Gemini returned no generated image data. Confirm billing and image-model access.');
  return (await uploadMediaBuffer(Buffer.from(encoded, 'base64'), 'blogs', `${article.slug}.png`)).url;
}

function schemaMarkup(article: GeneratedArticle, coverImage: string, publishedAt: Date) {
  const base = (process.env.SITE_URL || 'https://acharitiwari.vercel.app').replace(/\/$/, '');
  return {
    article: { '@context':'https://schema.org','@type':'Article', headline:article.title, description:article.seoDescription, image:[coverImage], datePublished:publishedAt.toISOString(), author:{'@type':'Organization',name:'Achari Tiwari Kitchen'}, publisher:{'@type':'Organization',name:'AchariTiwari'}, mainEntityOfPage:`${base}/blog/${article.slug}` },
    faq: { '@context':'https://schema.org','@type':'FAQPage', mainEntity:article.faq.map(item => ({'@type':'Question',name:item.question,acceptedAnswer:{'@type':'Answer',text:item.answer}})) },
    breadcrumb: { '@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:base},{'@type':'ListItem',position:2,name:'Blog',item:`${base}/blog`},{'@type':'ListItem',position:3,name:article.title,item:`${base}/blog/${article.slug}`}] },
  };
}

function appendInternalLinks(content: string, productSlugs: string[], blogSlugs: string[]) {
  const products = productSlugs.map(slug => `<li><a href="/product/${encodeURIComponent(slug)}">Explore ${slug.split('-').map(word => word[0]?.toUpperCase() + word.slice(1)).join(' ')}</a></li>`).join('');
  const blogs = blogSlugs.map(slug => `<li><a href="/blog/${encodeURIComponent(slug)}">Read ${slug.split('-').map(word => word[0]?.toUpperCase() + word.slice(1)).join(' ')}</a></li>`).join('');
  return `${content}${products ? `<h2>Related AchariTiwari Pickles</h2><ul>${products}</ul>` : ''}${blogs ? `<h2>More from the AchariTiwari Kitchen</h2><ul>${blogs}</ul>` : ''}`;
}

export async function createAutomatedBlog(options: { status?: 'draft'|'published'; force?: boolean } = {}) {
  const config = await BlogAutomation.findOneAndUpdate({ key:'daily-blog' }, { $setOnInsert:{ enabled:true, publishMode:'published', hourUtc:3 } }, { upsert:true, new:true });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Kolkata', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
  if (!options.force && !config.enabled) return { skipped:true, reason:'Automation is disabled.' };
  if (!options.force && new Date().getUTCHours() !== config.hourUtc) return { skipped:true, reason:`Scheduled for UTC hour ${config.hourUtc}.` };
  if (!options.force && config.lastRunDate === today && config.lastStatus === 'running') return { skipped:true, reason:'Today’s blog generation is already running.' };
  if (!options.force && config.lastRunDate === today && config.lastStatus === 'succeeded') return { skipped:true, reason:'Today’s blog was already generated.' };
  config.lastRunDate = today; config.lastRunAt = new Date(); config.lastStatus = 'running'; config.lastError = undefined; await config.save();
  try {
    const generated = await generateArticle();
    const coverImage = await generateImage(generated.article);
    const publishedAt = new Date();
    const relatedProductSlugs = await productLinks();
    const relatedBlogSlugs = await relatedBlogs(generated.article.focusKeyword);
    generated.article.content = appendInternalLinks(generated.article.content, relatedProductSlugs, relatedBlogSlugs);
    const status = options.status || config.publishMode;
    const post = await BlogPost.create({ ...generated.article, coverImage, relatedProductSlugs, relatedBlogSlugs, author:'Achari Tiwari Kitchen', status, featured:false, publishedAt:status === 'published' ? publishedAt : undefined, readingTime:Math.max(1, Math.ceil(words(generated.article.content).length / 220)), schemaMarkup:schemaMarkup(generated.article, coverImage, publishedAt), automation:{ generated:true, topic:generated.topic, contentType:generated.contentType, season:generated.season, qualityScore:generated.qualityScore, generatedAt:new Date() } });
    config.lastStatus = 'succeeded'; config.lastPost = post._id as any; await config.save();
    if (status === 'published') await queueNewsletterCampaign('blog', post._id).catch(error => console.error('Blog newsletter queue failed', error));
    return { skipped:false, post };
  } catch (error) {
    config.lastStatus = 'failed'; config.lastError = error instanceof Error ? error.message : 'Unknown automation error'; await config.save(); throw error;
  }
}

export async function regenerateAutomatedBlog(post: IBlogPost) {
  const generated = await generateArticle(post);
  Object.assign(post, generated.article, { readingTime:Math.max(1,Math.ceil(words(generated.article.content).length/220)), automation:{ generated:true, topic:generated.topic, contentType:generated.contentType, season:generated.season, qualityScore:generated.qualityScore, generatedAt:new Date() } });
  post.relatedProductSlugs = await productLinks(); post.relatedBlogSlugs = await relatedBlogs(generated.article.focusKeyword);
  post.content = appendInternalLinks(post.content, post.relatedProductSlugs, post.relatedBlogSlugs);
  post.readingTime = Math.max(1, Math.ceil(words(post.content).length / 220));
  if (post.coverImage) post.schemaMarkup = schemaMarkup(generated.article, post.coverImage, post.publishedAt || new Date());
  await post.save(); return post;
}

export async function regenerateAutomatedImage(post: IBlogPost) {
  const imagePrompt = `Ultra-premium realistic luxury food photography for “${post.title}”, rustic Indian kitchen, traditional pickle in an earthen pot, natural window light, wooden table, mustard oil and whole traditional masala, editorial food magazine style, appetizing but authentic, no text, no watermark.`;
  post.coverImage = await generateImage({ imagePrompt, slug:post.slug }); await post.save(); return post;
}
