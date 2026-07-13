# AachariTiwari Backend API

This is the Node.js + Express backend API for the AachariTiwari e-commerce platform, built with TypeScript and MongoDB.

## Features

- **User Management**: Authentication, registration, profile management
- **Product Management**: CRUD operations for products, categories
- **Shopping Cart**: Cart management APIs
- **Order Management**: Order creation, tracking, and management
- **Admin Panel**: Full admin controls including user, order, discount, and banner management
- **Discounts & Promotions**: Create and manage discount codes
- **Banners & Marketing**: Manage promotional banners
- **Analytics**: Dashboard and sales analytics for admins

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: MongoDB
- **Authentication**: JWT
- **Password**: bcryptjs
- **Payment**: Stripe (integrated)

## Prerequisites

- Node.js 16+ 
- MongoDB 5+
- npm or yarn

## Installation

1. Clone and navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```

4. Configure your environment variables in `.env`:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/acharitiwari
JWT_SECRET=your_secret_key_here
JWT_EXPIRE=7d
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
```

## Running the Server

### Development Mode
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

### Health Check
```bash
curl http://localhost:5000/api/health
```

## Project Structure

```
src/
├── config/          # Configuration files (database, etc.)
├── controllers/     # Request handlers
├── middleware/      # Authentication, error handling
├── models/          # MongoDB schemas
├── routes/          # API endpoints
├── index.ts         # Main server entry point
└── scripts/         # Database seeding, migrations
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile (protected)
- `PUT /api/auth/profile` - Update profile (protected)

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create product (admin)
- `PUT /api/products/:id` - Update product (admin)
- `DELETE /api/products/:id` - Delete product (admin)

### Cart
- `GET /api/cart` - Get cart (protected)
- `POST /api/cart/add` - Add to cart (protected)
- `DELETE /api/cart/remove/:productId` - Remove from cart (protected)

### Orders
- `POST /api/orders` - Create a guest order (public checkout)
- `GET /api/orders` - Get all orders (admin)
- `GET /api/orders/:orderId` - Get order details (admin)
- `PUT /api/orders/:orderId` - Update fulfillment/payment/tracking (admin)
- `DELETE /api/orders/:orderId` - Delete an order (admin)

### Admin Routes
- `GET /api/admin/products` - Get all products (admin)
- `GET /api/admin/orders` - Get all orders (admin)
- `GET /api/admin/users` - Get all users (admin)
- `POST /api/admin/users` - Create a user (admin)
- `PUT /api/admin/users/:id` - Update a user (admin)
- `DELETE /api/admin/users/:id` - Delete a user (admin)
- `GET /api/admin/discounts` - Get all discounts (admin)
- `POST /api/admin/discounts` - Create discount (admin)
- `GET /api/admin/banners` - Get all banners (admin)
- `POST /api/admin/banners` - Create banner (admin)
- `GET /api/admin/analytics/dashboard` - Dashboard analytics (admin)
- `GET /api/admin/analytics/sales` - Sales analytics (admin)

## Authentication

This API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_token_here>
```

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Error description"
}
```

## Database Models

### User
- name, email, password, phone
- role (user/admin)
- addresses, wishlists
- Timestamps

### Product
- name, description, price
- category, tags
- images, weight, ingredients, shelfLife
- stock, rating, reviews
- SEO fields (seoTitle, seoDescription, seoKeywords)

### Order
- orderNumber, userId
- items, subtotal, total
- status, paymentStatus
- shippingAddress, trackingNumber

### Discount
- code, discountType (percentage/fixed)
- maxUses, usedCount
- validFrom, validTo
- applicableProducts, applicableCategories

### Banner
- title, description, image
- link, linkType
- displayLocation
- validFrom, validTo

## Contributing

1. Create a feature branch
2. Make your changes
3. Submit a pull request

## License

ISC
