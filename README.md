# DIY-DRY Payment API

Custom Node.js backend for the DIY-DRY Elementor checkout (not WooCommerce). Creates Stripe PaymentIntents, recalculates totals server-side, and stores orders in MongoDB.

## Stack

- Node.js, Express, MongoDB (Mongoose)
- Stripe (PaymentIntents + webhooks)
- helmet, cors, morgan, express-rate-limit

## Setup

1. Copy environment file:

```bash
cd backend
cp .env.example .env
```

2. Edit `.env` with your MongoDB URI, Stripe keys, and site URL.

3. Install and run:

```bash
npm install
npm run dev
```

API listens on `http://localhost:5000` by default.

## Stripe webhook (required for reliable order status)

In [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks), add an endpoint:

- **URL:** `https://YOUR_BACKEND_DOMAIN.com/api/webhook`
- **Events:** `payment_intent.succeeded`, `payment_intent.payment_failed`
- Copy the signing secret into `STRIPE_WEBHOOK_SECRET`

For local testing use the Stripe CLI:

```bash
stripe listen --forward-to localhost:5000/api/webhook
```

## API

### `GET /api/health`

Health check.

### `POST /api/create-payment-intent`

Creates a pending MongoDB order, recalculates totals, and returns a Stripe `clientSecret`.

**Body:**

```json
{
  "customer": {
    "fullName": "Jane Doe",
    "phone": "3865551234",
    "email": "jane@example.com",
    "address": "123 Main St",
    "city": "Palm Coast",
    "state": "FL",
    "zip": "32137",
    "instructions": "Gate code 1234",
    "notes": ""
  },
  "rental": {
    "startDate": "2026-05-20",
    "endDate": "2026-05-23"
  },
  "cart": [],
  "protectionChecked": true,
  "afterHoursChecked": false
}
```

`cart` is the same array shape as `localStorage` key `diydry-cart`. **Amounts in the cart are not trusted** — the server uses `priceCatalog.js`.

**Response:**

```json
{
  "clientSecret": "pi_..._secret_...",
  "orderId": "...",
  "amountCents": 12345,
  "grandTotal": 123.45
}
```

## Frontend (Elementor checkout)

Set in your checkout HTML widget:

```javascript
const DIYDRY_API_BASE = 'https://YOUR_BACKEND_DOMAIN.com';
const stripePublicKey = 'pk_live_...'; // publishable key only
```

Call `POST ${DIYDRY_API_BASE}/api/create-payment-intent` instead of the WordPress REST route.

## Security notes

- Never commit `.env` or Stripe secret keys.
- Card data stays in Stripe Elements; only PaymentIntent IDs are stored.
- Totals are always recalculated on the server.
- Use HTTPS in production and restrict `FRONTEND_ORIGIN`.

## Deploy to Vercel

1. Push the repo to GitHub (include the `backend/` folder).
2. [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
3. Set **Root Directory** to `backend`.
4. Add **Environment Variables** (Production): `MONGO_URI`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `FRONTEND_ORIGIN`, `NODE_ENV=production`.
5. Deploy. Your API base URL is `https://YOUR-PROJECT.vercel.app`.
6. Stripe webhook URL: `https://YOUR-PROJECT.vercel.app/api/webhook`.
7. Update Elementor checkout: `DIYDRY_API_BASE = 'https://YOUR-PROJECT.vercel.app'`.

Use **MongoDB Atlas** for `MONGO_URI` (not `localhost`). Local dev still uses `npm run dev`.

See step-by-step details in the project chat / team docs for Vercel + Atlas setup.

## Other deployment

Deploy to Railway, Render, Fly.io, or a VPS with `npm start`. Set environment variables and update checkout `DIYDRY_API_BASE`.
