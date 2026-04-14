# Architecture

System design for the Eatcrumbs backend — a multi-tenant food ordering platform.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend (Customer) | Next.js — hosted on Vercel |
| Frontend (Admin) | Next.js — hosted on Vercel |
| Backend API | Fastify + Node.js + TypeScript — hosted on Railway/Render |
| Database | Supabase (PostgreSQL) |
| Auth | Custom JWT (backend issues tokens, Supabase RLS validates them) |
| Realtime | Socket.IO (backed by backend server) |
| File Storage | Supabase Storage → S3 |
| Payments | Paymob |
| Email | Resend |
| Notifications | WhatsApp Business API |
| Geocoding | Pelias (`https://pilias.eg.prepit.app/v1`) |
| Delivery Tracking | Roboost integration |
| POS/Menu Sync | Foodics OAuth API |
| Analytics | Amplitude, TikTok Pixel, Facebook Pixel, Matomo, Sentry |
| DNS/CDN | Cloudflare |

---

## 1. Multi-Tenancy

### Subdomain Routing

Every restaurant has a unique subdomain. The admin and customer apps are served from the same Next.js codebase but resolve to different tenants at runtime.

```
admin.eg.prepit.app       → admin panel for any restaurant (authenticated by admin JWT)
<restaurant-slug>.prepit.app → customer storefront for that restaurant
```

The **customer frontend** identifies which restaurant it's serving via the subdomain. The app reads `window.location.hostname` and strips the TLD to extract the slug:

```js
// From compiled customer bundle
const slug = window.location.hostname.endsWith("prepit.app")
  ? hostname.split(".prepit.app")[0]
  : hostname.replace("www", "")
```

The slug is used to look up the `restaurant_id` on every API call.

### Backend Tenant Resolution

Every incoming request is resolved to a `restaurant_id` via middleware:

```
1. Extract slug from request header `X-Restaurant-Slug` (set by frontend)
   OR from subdomain of `Origin` / `Referer` header
2. Cache slug → restaurant_id in Redis (TTL: 5 min)
3. Attach restaurant_id to request context
4. All route handlers use ctx.restaurant_id for every query
```

### Tenant Isolation — Defense in Depth

**Layer 1 — Application:** Every Fastify route handler explicitly filters by `restaurant_id` from request context.

**Layer 2 — Database:** Supabase RLS policies enforce restaurant-scoped access using JWT claims.

**Layer 3 — Validation:** Zod schemas validate that IDs in request bodies belong to the authenticated tenant before any mutation.

A merchant JWT contains `{ admin_id, restaurant_id, role }` as claims. Any attempt to access another restaurant's data fails at all three layers.

---

## 2. Auth Flows

### 2a. Merchant Authentication (Admin)

```
Admin logs in with email + password
→ POST /admin/v2/signin { email, password }
→ Backend validates credentials, bcrypt.compare()
→ Issues JWT: { admin_id, restaurant_id, role, exp: +7 days }
→ Token stored in cookie: admin-token (httpOnly, Secure, SameSite=None)
→ All subsequent requests read token from cookie
→ Axios interceptor adds Authorization: Bearer <token>
→ On 401: redirect to /login

Password Reset:
→ POST /forgot-password { email }
→ Backend generates reset token (crypto.randomBytes(32).toString('hex'))
→ Stores hashed token in admins.reset_token + expiry
→ Sends email via Resend: "Reset your password" link
→ Admin clicks link → POST /verify-reset-password-token { token }
→ POST /reset-password { token, newPassword }
```

### 2b. Customer Phone OTP Authentication

```
Customer enters phone number
→ POST /auth/otp { phoneNumber, countryCode, franchiseId, login: true, ... }
→ Backend generates 6-digit OTP, stores in Redis (TTL: 5 min)
→ Sends OTP via WhatsApp / SMS
→ Customer enters OTP
→ POST /auth/check-otp { phoneNumber, code, name, ... }
→ Backend validates OTP from Redis
→ Creates or finds customer record for (phone_number, restaurant_id)
→ Issues JWT: { customer_id, restaurant_id, person_name, phone_number, exp: +30 days }
→ Token stored in cookie: TOKEN
→ Axios interceptor adds Authorization: Bearer <token>
```

### 2c. Guest / Visitor Checkout

```
Customer visits storefront without logging in
→ POST /user/create-visitor { isMobileAppUser, isWebSelfServiceUser, ... }
→ Backend creates anonymous customer record (is_visitor: true)
→ Issues short-lived visitor JWT
→ Customer can browse menu and place order
→ Order confirmation prompts for phone number
```

### 2d. JWT Middleware (Fastify)

```typescript
// Applied to all protected routes
fastify.addHook('preHandler', async (request, reply) => {
  const token = request.cookies['admin-token'] || request.cookies['TOKEN']
    || request.headers.authorization?.replace('Bearer ', '')
  if (!token) return reply.status(401).send({ error: 'Unauthorized' })
  
  const payload = jwt.verify(token, process.env.JWT_SECRET)
  request.user = payload
  request.restaurantId = payload.restaurant_id
})
```

---

## 3. Real-Time Order Flow

Socket.IO v3 with two separate server namespaces.

### Customer Places an Order

```
1. Customer submits cart → POST /receipt/confirm
2. Backend creates receipt (state: PENDING)
3. Backend broadcasts to merchant via Socket.IO:
   namespace: /socket/admin
   event: NEW_ORDER
   payload: { receiptId, franchiseId, orderSummary }
4. Admin dashboard receives notification (bell icon + audio)
5. Admin accepts order → POST /receipt/{id}/accept
6. Backend updates receipt_state → ON_WAY_TO_PICKUP or ON_WAY_TO_DELIVERY
7. Backend broadcasts to customer via Socket.IO:
   namespace: /socket/restaurant
   event: RECEIPT_STATE_CHANGE
   payload: receiptId
8. Customer app receives event → re-fetches GET /receipt/updated-receipt-state
9. Customer sees "Order Accepted / Being Prepared"
```

### Socket.IO Server Architecture

```
Fastify server runs Socket.IO adapter
Socket.IO namespaces:
  /socket/admin     — merchant dashboard connections
  /socket/restaurant — customer connections (per restaurant)
  /socket/franchise  — customer connections (per franchise/branch)
  /socket/waiter     — waiter tablet connections

Connection auth (on connect):
  Customer: { restaurantId, token }  → validates JWT, joins room `restaurant:{id}`
  Admin:    { adminId, token }        → validates admin JWT, joins room `admin:{id}`

Rooms:
  restaurant:{restaurantId}   — all customers of a restaurant
  franchise:{franchiseId}     — customers at a specific branch
  admin:{restaurantId}        — all admin tabs for a restaurant

Broadcast patterns:
  Menu change   → emit to room `restaurant:{id}` MENU_VERSION_CHANGE
  Order update  → emit to room `franchise:{id}` RECEIPT_STATE_CHANGE(receiptId)
  Item status   → emit to room `restaurant:{id}` RESTAURANT_ITEM_STATUS_CHANGE
  Reward redeemed → emit to customer's socket REWARD_REDEEMED(packageOfferId)
```

---

## 4. Paymob Payment Flow

### Payment Initiation

```
1. Customer selects "online_card" payment
2. POST /receipt/confirm → backend creates receipt (payment_status: pending)
3. Backend calls Paymob API:
   a. GET auth token from Paymob
   b. Create Paymob order with amount (in cents)
   c. Generate payment key for iframe
4. Backend returns { paymentUrl, receiptId } to customer
5. Customer is redirected to Paymob hosted payment page
   OR Paymob iframe is loaded on /pay page
```

### Paymob Webhook

```
Paymob calls POST /webhooks/paymob (public endpoint, no JWT)
→ Validate HMAC signature using Paymob secret
→ Extract transaction data: { orderId, success, amount, transactionId }
→ Find receipt by paymob_order_id
→ Update payment_status: completed | failed
→ If success:
   a. Update receipt.payment_status = 'completed'
   b. Update receipt.receipt_state = 'PENDING' (awaiting merchant accept)
   c. Award loyalty points
   d. Send WhatsApp confirmation to customer
   e. Notify merchant via Socket.IO
→ If failed:
   a. Update receipt.payment_status = 'failed'
   b. Redirect customer to /paymentfailed
```

### Saved Cards

```
Paymob stores tokenized cards on their side.
Backend stores card reference (paymob_card_id) mapped to customer_id.
Customer selects saved card → backend includes card_token in Paymob payment key request.
```

---

## 5. WhatsApp Notification Triggers

All notifications go via WhatsApp Business API (Meta Cloud API or 360dialog).

```
Trigger 1: Order Placed (payment confirmed OR cash order placed)
→ Template: ORDER_PLACED
→ Recipient: customer phone number
→ Content: order number, items summary, estimated time, tracking link

Trigger 2: Order Accepted by Merchant
→ Template: ORDER_ACCEPTED
→ Recipient: customer phone number
→ Content: "Your order is being prepared"

Trigger 3: Order Ready for Pickup
→ Template: ORDER_READY
→ Recipient: customer phone number
→ Content: "Your order is ready for pickup at [branch name]"

Trigger 4: Out for Delivery
→ Template: ORDER_OUT_FOR_DELIVERY
→ Recipient: customer phone number
→ Content: "Your order is on the way"

Trigger 5: OTP Authentication
→ Template: OTP_VERIFICATION
→ Recipient: customer phone number
→ Content: "Your verification code is: {code}"

Implementation:
→ WhatsApp service receives event queue
→ Looks up customer phone number + country code
→ Formats message using approved Meta template
→ Sends via WhatsApp Cloud API
→ Logs to notifications table
```

---

## 6. Image Upload Flow

### Frontend to Storage (No Direct Upload)

```
Admin wants to upload item image:
1. Admin selects image file (max 5MB, PNG/JPG/JPEG only)
2. POST /item/with-images (multipart/form-data)
   - itemData: JSON
   - uploadedImages: file(s)
3. Fastify server receives files via @fastify/multipart
4. Backend validates file type (magic bytes) and size
5. Uploads to Supabase Storage bucket: restaurant-images/{restaurantId}/{uuid}.jpg
6. Gets public URL from Supabase
7. Saves URL(s) to items.images[] in database
8. Returns item data with image URLs to frontend
```

### Supabase Storage Buckets

```
restaurant-images/   — menu item images, restaurant logos, backgrounds
  {restaurantId}/
    items/
      {uuid}.jpg
    logos/
      logo.jpg
    backgrounds/
      bg.jpg

loyalty-passes/      — generated Apple/Google Wallet pass files
  {customerId}/
    pass.pkpass

Public bucket: restaurant-images (read-only public)
Private bucket: loyalty-passes (customer-authenticated read)
```

### Image Reorder

```
Admin drags to reorder images:
→ items.images[] array is re-ordered
→ POST /item/reorder-images { itemId, imageOrder: [url, url, ...] }
```

---

## 7. Custom Domain Provisioning (Cloudflare)

When a restaurant wants a custom domain (e.g., `order.mybrand.com`):

```
1. Admin submits domain in dashboard settings
2. Backend calls Cloudflare API:
   a. Add DNS CNAME record: order.mybrand.com → {restaurant-slug}.prepit.app
   b. Create Cloudflare SSL certificate for custom domain
   c. Enable proxying
3. Backend adds domain to Vercel project via Vercel API:
   POST https://api.vercel.com/v9/projects/{project-id}/domains
   { "name": "order.mybrand.com" }
4. Customer verifies DNS propagation
5. Backend stores custom_domain in restaurants.config
6. Cloudflare Worker / Next.js middleware maps hostname to restaurant slug
```

---

## 8. Rate Limiting Strategy

Using `@fastify/rate-limit` per route category:

```
Public storefront endpoints (GET menu, GET restaurant):
  - 200 req/min per IP
  - Redis-backed, burst-friendly

Auth endpoints (OTP, sign-in):
  - 5 req/min per IP
  - 3 req/min per phone number (for OTP)
  - 10 req/min per IP for password reset

Order placement:
  - 10 req/min per customer
  - Prevents duplicate order submission

Merchant API (all /admin/v2 routes):
  - 300 req/min per admin token

Analytics/tracking:
  - 500 req/min per IP (noisy endpoints)

Webhook endpoints (Paymob):
  - IP allowlist (Paymob IP ranges only)
  - No rate limit, but HMAC validation on every request
```

---

## 9. Fastify Server Structure

```
src/
├── server.ts              — Fastify instance, plugin registration
├── config/
│   ├── env.ts             — Zod-validated environment variables
│   └── supabase.ts        — Supabase client
├── plugins/
│   ├── auth.ts            — JWT middleware
│   ├── tenant.ts          — Restaurant slug → ID resolver
│   ├── rateLimit.ts       — Rate limiting config
│   ├── cors.ts            — CORS configuration
│   └── socket.ts          — Socket.IO server
├── routes/
│   ├── admin/
│   │   ├── auth.ts
│   │   ├── menu.ts        — categories, items, addons
│   │   ├── dashboard.ts
│   │   ├── overview.ts
│   │   ├── feedback.ts
│   │   ├── customers.ts
│   │   ├── offers.ts
│   │   ├── loyalty.ts
│   │   └── foodics.ts
│   ├── customer/
│   │   ├── auth.ts
│   │   ├── menu.ts        — public menu read
│   │   ├── orders.ts
│   │   ├── delivery.ts
│   │   ├── loyalty.ts
│   │   ├── payment.ts
│   │   └── user.ts
│   ├── webhooks/
│   │   └── paymob.ts
│   └── health.ts
├── services/
│   ├── jwt.ts
│   ├── otp.ts
│   ├── whatsapp.ts
│   ├── resend.ts
│   ├── paymob.ts
│   ├── foodics.ts
│   ├── storage.ts
│   └── points.ts
└── lib/
    ├── db.ts              — typed Supabase queries
    └── errors.ts          — custom error classes
```

---

## 10. Environment Variables

```env
# Server
PORT=3000
NODE_ENV=production
JWT_SECRET=
JWT_ADMIN_SECRET=

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Paymob
PAYMOB_API_KEY=
PAYMOB_HMAC_SECRET=
PAYMOB_INTEGRATION_ID=

# Resend
RESEND_API_KEY=
EMAIL_FROM=

# WhatsApp
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=

# Foodics
FOODICS_CLIENT_ID=
FOODICS_CLIENT_SECRET=
FOODICS_REDIRECT_URI=

# Cloudflare
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ZONE_ID=

# Vercel
VERCEL_API_TOKEN=
VERCEL_PROJECT_ID=

# Redis (for rate limiting, OTP storage)
REDIS_URL=

# Frontend URLs
ADMIN_FRONTEND_URL=https://admin.prepit.app
CUSTOMER_FRONTEND_URL=https://{slug}.prepit.app
```

---

## 11. Key Architectural Decisions

### Why Custom JWT instead of Supabase Auth

The existing frontends store tokens in cookies named `admin-token` (admin) and `TOKEN` (customer). Supabase Auth uses its own cookie names and refresh token flow. To be compatible with the existing frontend without changes, we issue custom JWTs that mimic the expected cookie structure. The Supabase service role key is used for all DB operations server-side, with RLS policies for additional safety.

### Why Socket.IO instead of Supabase Realtime

The frontend explicitly connects to `NEXT_PUBLIC_SOCKET_URL + "/socket/restaurant"` and uses Socket.IO v3 client. Supabase Realtime uses a different protocol. We must implement Socket.IO server to be frontend-compatible.

### Axios Version Header

The customer frontend adds `headers.version = "v2"` to every request. Our backend should accept this header and can use it for versioning decisions.

### Restaurant ID vs Slug

The customer frontend holds `restaurantId: "740"` as a hardcoded default for development. In production, the restaurant is resolved from the subdomain. The backend always prefers the subdomain-resolved ID over any ID in the request body.

### Multi-API-Version Strategy

The customer frontend uses two API version prefixes:
- `apiV1: "v1"` — older endpoints
- `apiV2: "v2"` — newer endpoints (menu categories fetch uses v2)

The fetch helper reads `/category/details/{id}` with a version header (`version: "v2"`). Our backend handles this via the `version` header rather than URL path versioning.
