# Achari Tiwari Backend Email Templates

Professional responsive HTML email templates for customer lifecycle emails.

## Templates

- `welcome.html` - sent when a user signs up or places their first order.
- `order-created.html` - sent after checkout/order creation.
- `order-delivered.html` - sent when the order has been delivered.
- `product-review-request.html` - sent after delivery to request a product review.
- `newsletter-confirmation.html` - confirms newsletter consent before activation.
- `newsletter-product.html` - announces a newly published product to subscribed contacts.
- `newsletter-blog.html` - announces a newly published blog story to subscribed contacts.

## Placeholder Style

These files use the backend's escaped Handlebars-style renderer in `src/services/email.ts`:

```text
{{customerName}}
{{orderNumber}}
{{orderUrl}}
{{reviewUrl}}
{{siteUrl}}
{{supportEmail}}
{{confirmationUrl}}
{{unsubscribeUrl}}
{{#each items}} ... {{/each}}
```

Simple variables, `{{#if value}}` blocks, and `{{#each items}}` blocks are supported. Keep customer data inside placeholders so it is HTML-escaped by the renderer.

## Recommended Send Timing

- Welcome: sent immediately after account signup.
- Order created: sent immediately after order creation.
- Order delivered: sent once when fulfillment first changes to `delivered`.
- Review request: available through `sendProductReviewRequest`; invoke it from a durable job queue 3 to 5 days after delivery.

## Runtime location

Templates intentionally live inside `backend/email-templates`. The renderer resolves this directory correctly when executing either `src/services/email.ts` in development or `dist/services/email.js` in production. Deploy the `email-templates` directory alongside `dist` and `package.json`.

## Brand Defaults

- Brand name: `Achari Tiwari`
- Primary color: `#254d2b`
- Accent color: `#c28a2c`
- Background: `#f7f1e7`
