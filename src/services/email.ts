import { readFile } from 'fs/promises';
import path from 'path';
import nodemailer from 'nodemailer';

type TemplateName = 'welcome' | 'order-created' | 'order-delivered' | 'product-review-request';
type TemplateData = Record<string, unknown>;

const templateDirectory = path.resolve(__dirname, '../../email-templates');
const htmlEscape = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character] || character));
const currency = (value: unknown) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

function renderBlock(template: string, data: TemplateData): string {
  const withLoops = template.replace(/{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g, (_match, key: string, block: string) => {
    const items = Array.isArray(data[key]) ? data[key] as TemplateData[] : [];
    return items.map(item => renderBlock(block, { ...data, ...item })).join('');
  });
  const withConditionals = withLoops.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (_match, key: string, block: string) => data[key] ? renderBlock(block, data) : '');
  return withConditionals.replace(/{{\s*(\w+)\s*}}/g, (_match, key: string) => htmlEscape(data[key]));
}

async function loadTemplate(name: TemplateName, data: TemplateData) {
  const source = await readFile(path.join(templateDirectory, `${name}.html`), 'utf8');
  const subject = source.match(/Subject:\s*([^\n\r]+)/)?.[1]?.trim() || 'Achari Tiwari update';
  return { subject: renderBlock(subject, data), html: renderBlock(source.replace(/^<!--[\s\S]*?-->\s*/, ''), data) };
}

function transporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) return null;
  return nodemailer.createTransport({ host:SMTP_HOST, port:Number(SMTP_PORT || 587), secure:Number(SMTP_PORT) === 465, auth:{ user:SMTP_USER, pass:SMTP_PASSWORD } });
}

async function sendTemplate(to: string, name: TemplateName, data: TemplateData, text: string) {
  const mailer = transporter();
  if (!mailer) { console.warn(`Email "${name}" skipped for ${to}: SMTP is not configured.`); return false; }
  const rendered = await loadTemplate(name, { supportEmail:process.env.SUPPORT_EMAIL || 'aacharitiwari@gmail.com', siteUrl:process.env.SITE_URL || 'https://www.aacharitiwari.com', ...data });
  await mailer.sendMail({ from:process.env.EMAIL_FROM || `Achari Tiwari <${process.env.SMTP_USER}>`, to, subject:rendered.subject, text, html:rendered.html });
  return true;
}

const orderItems = (order: any) => (order.items || []).map((item: any) => ({ productTitle:item.name, variantLabel:item.variantLabel || '', size:item.size || '', quantity:item.quantity, lineTotal:currency(Number(item.price) * Number(item.quantity)), reviewUrl:`${process.env.SITE_URL || 'https://www.aacharitiwari.com'}/product/${item.productId}#reviews` }));

export function sendWelcomeEmail(user: { name:string; email:string }) {
  return sendTemplate(user.email, 'welcome', { customerName:user.name }, `Welcome to Achari Tiwari, ${user.name}. Explore traditional small-batch aachar at ${process.env.SITE_URL || 'https://www.aacharitiwari.com'}.`);
}

export function sendOrderConfirmation(order: any) {
  const address = order.shippingAddress || {};
  return sendTemplate(order.customer.email, 'order-created', { customerName:order.customer.name, orderNumber:order.orderNumber, orderUrl:`${process.env.SITE_URL || 'https://www.aacharitiwari.com'}/account`, items:orderItems(order), subtotal:currency(order.subtotal), shippingCharge:currency(order.shippingCost), orderTotal:currency(order.total), shippingName:address.name || order.customer.name, shippingLine1:address.street, shippingLine2:'', shippingCity:address.city, shippingState:address.state, postalCode:address.zipCode, shippingCountry:address.country || 'India' }, `Namaste ${order.customer.name}, your order ${order.orderNumber} for ${currency(order.total)} has been received.`);
}

export function sendOrderDeliveredEmail(order: any) {
  return sendTemplate(order.customer.email, 'order-delivered', { customerName:order.customer.name, orderNumber:order.orderNumber, items:orderItems(order) }, `Your Achari Tiwari order ${order.orderNumber} has been delivered.`);
}

export function sendProductReviewRequest(order: any) {
  const items = orderItems(order);
  return sendTemplate(order.customer.email, 'product-review-request', { customerName:order.customer.name, items, reviewUrl:items[0]?.reviewUrl || `${process.env.SITE_URL || 'https://www.aacharitiwari.com'}/products` }, `How was your Achari Tiwari order ${order.orderNumber}? We would love your feedback.`);
}
