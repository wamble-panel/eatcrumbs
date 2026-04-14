# Progress

## Status: AWAITING APPROVAL ON STEP 1-3 DOCS

---

## Completed

- [x] Reverse-engineered both frontend compiled builds (admin + customer)
- [x] `/docs/api-contract.md` — full API surface (~113 endpoints across both frontends)
- [x] `/docs/schema.md` — complete database schema (22 tables, indexes, RLS policies)
- [x] `/docs/architecture.md` — multi-tenancy, auth flows, realtime, payments, notifications, storage, Cloudflare, rate limiting

---

## Pending — Awaiting User Approval

Nothing is built yet. Waiting for approval of the three docs before any code is written.

---

## Build Queue (post-approval)

1. [ ] Supabase schema — migrations, RLS, seed data
2. [ ] Fastify server setup — project structure, plugins, middleware, rate limiting
3. [ ] Auth routes — merchant signup/login, customer OTP, JWT middleware
4. [ ] Multi-tenant middleware — resolve restaurant from subdomain
5. [ ] Restaurant + branch routes — CRUD for dashboard
6. [ ] Menu routes — categories, items, modifier groups, availability
7. [ ] Image upload routes — multipart, Supabase Storage
8. [ ] Storefront routes — public menu fetch, branch fetch, item detail
9. [ ] Cart and order creation routes
10. [ ] Paymob integration — payment initiation + webhook handler
11. [ ] Real-time order updates — Socket.IO broadcast on order state change
12. [ ] Merchant order management routes — accept, reject, update status
13. [ ] WhatsApp notification service
14. [ ] Customer auth routes — phone OTP
15. [ ] Loyalty points routes — earn on order, redeem at checkout
16. [ ] Analytics routes — revenue, top items, order volume, peak hours
17. [ ] Customer profile routes — order history, saved addresses
18. [ ] Custom domain provisioning — Cloudflare API
19. [ ] Migration tool — scrape and import menu from competitor platforms

---

## Known Gaps / Questions

1. **Admin `/admin/v2/sign-in` vs `/signin`** — Two sign-in endpoints exist in the compiled code. The axios baseURL is already `/admin/v2`, so `/signin` is the full path and `/admin/v2/sign-in` is a legacy alias. Need to confirm.

2. **Paymob webhook URL** — Frontend doesn't reveal the webhook receiver URL. Needs to be configured in Paymob dashboard. Will use `POST /webhooks/paymob`.

3. **OTP delivery** — Frontend sends phone OTP but doesn't reveal the SMS/WhatsApp provider directly. Architecture doc proposes WhatsApp Business API as the primary channel (matching the overall stack).

4. **Roboost integration** — The delivery tracking API (`GET /roboost/trackOrder`) proxies to an external Roboost service. Need Roboost API credentials.

5. **Admin password change flow** — Current evidence shows forgot-password + reset-password. No in-session password change endpoint found yet. May need `POST /change-password`.

6. **Item sales page data source** — The `/itemsales` page in admin doesn't have a dedicated endpoint visible. It likely uses `/item/top_products` or a dedicated dashboard report with `REPORT_TYPE=MENU_DATA`.

7. **`/pay` page implementation** — The customer `/pay` page initiates Paymob. The exact request shape to create the payment isn't visible from the frontend alone. Needs Paymob docs.

8. **Customer `GET /config` (RTK Query)** — This endpoint appears in the customer's RTK Query setup but the response shape isn't clear. Likely returns restaurant-level feature flags.

---

## Discovered API Calls Not Yet Documented

The following routes appeared in the customer frontend but need more context:

- `GET /receipt/pos/{deviceNumber}/{franchiseId}` — self-service kiosk receipt
- `POST /receipt/cancel-pos-receipt` — cancel kiosk order
- `POST /cart-loyalty/cart/calculate` — full body shape unknown
- `GET /cart-loyalty/offer/` — query params unknown
- `POST /user/loyalty-enrollment { code }` — enrollment flow unclear
