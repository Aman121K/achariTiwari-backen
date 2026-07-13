import nodemailer from 'nodemailer';

export async function sendOrderConfirmation(order: any) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
    console.warn(`Email skipped for ${order.orderNumber}: SMTP is not configured.`);
    return false;
  }
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
  const items = order.items.map((item: any) => `<tr><td style="padding:8px 0">${item.name} × ${item.quantity}</td><td style="padding:8px 0;text-align:right">₹${item.price * item.quantity}</td></tr>`).join('');
  await transporter.sendMail({
    from: EMAIL_FROM || `Achari Tiwari <${SMTP_USER}>`,
    to: order.customer.email,
    subject: `Order ${order.orderNumber} confirmed — Achari Tiwari`,
    text: `Namaste ${order.customer.name}, your order ${order.orderNumber} for ₹${order.total} has been received. We will notify you when it ships.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#20190f"><div style="background:#17320d;color:#fff8ed;padding:24px"><h1 style="margin:0">Order confirmed</h1><p style="margin:8px 0 0">Taste of Tradition</p></div><div style="padding:24px;border:1px solid #eadcc6"><p>Namaste ${order.customer.name},</p><p>Thank you for your order. We have received <strong>${order.orderNumber}</strong> and will notify you when it ships.</p><table style="width:100%;border-collapse:collapse">${items}<tr style="border-top:1px solid #ddd"><td style="padding:12px 0"><strong>Total</strong></td><td style="padding:12px 0;text-align:right"><strong>₹${order.total}</strong></td></tr></table><p>Payment: ${order.paymentMethod === 'cash_on_delivery' ? 'Cash on delivery' : 'UPI'}</p><p style="color:#6b5a45">Achari Tiwari · Ghar ka swaad, har bite mein pyaar</p></div></div>`,
  });
  return true;
}
