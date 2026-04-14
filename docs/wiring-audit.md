# Wiring Audit — Frontend Calls vs Backend Routes

**Method:** API calls extracted from minified JS chunks in
`admin.eg.prepit.app/_next/static/` and `customer_example_sided_website/_next/static/`
via regex against the compiled bundles.

**Admin base URL (hard-coded in build):** `https://api.eg.l.prepits.com/admin/v2`
**Customer base URL (hard-coded in build):** `https://api.eg.l.prepits.com`

**Auth — Admin:** reads `admin-token` cookie via `js-cookie`; adds
`Authorization: Bearer {token}` to every request _except_ `/sign-in` and `/signin`.

**Auth — Customer:** reads `TOKEN` cookie via `getCookie`; adds
`Authorization: Bearer {token}` plus `headers.version = "v2"` (RTK Query
endpoint uses Redux state token instead). CORS config in backend already
allows the `version` header.

Legend: ✅ Match | ⚠️ Adapt needed (path/method/body mismatch) | ❌ Missing entirely

---

## 1. Admin Dashboard (`admin.eg.prepit.app`)

### 1.1 Auth — ✅ All match

| Frontend call | Backend route | Notes |
|---|---|---|
| `POST /admin/v2/sign-in` | `POST /admin/v2/sign-in` | ✅ |
| `POST /admin/v2/signin` | `POST /admin/v2/signin` | ✅ alias |
| `POST /admin/v2/forgot-password` | `POST /admin/v2/forgot-password` | ✅ |
| `POST /admin/v2/verify-reset-password-token` | `POST /admin/v2/verify-reset-password-token` | ✅ |
| `POST /admin/v2/reset-password` | `POST /admin/v2/reset-password` | ✅ |

### 1.2 Restaurant / Info

| Frontend call | Backend route | Status | Notes |
|---|---|---|---|
| `GET /admin/v2/info` | `GET /admin/v2/info` | ✅ | |
| `POST /admin/v2/restaurant/admin-analytics` | `POST /admin/v2/restaurant/admin-analytics` | ✅ | |
| `GET /admin/v2/restaurant/:restaurantId` | `GET /restaurant/:id` (customer prefix) | ⚠️ | Backend registers this under **no** prefix; admin frontend calls it under `/admin/v2`. Need to also register the route (or alias) under `/admin/v2/restaurant/:id`. |

### 1.3 Menu — Categories ✅ All match

| Frontend call | Backend route | Status |
|---|---|---|
| `GET /admin/v2/category/details/:restaurantId` | `GET /admin/v2/category/details/:restaurantId` | ✅ |
| `POST /admin/v2/category` | `POST /admin/v2/category` | ✅ |
| `POST /admin/v2/category/edit` | `POST /admin/v2/category/edit` | ✅ |
| `POST /admin/v2/category/delete` | `POST /admin/v2/category/delete` | ✅ |
| `POST /admin/v2/category/update-order` | `POST /admin/v2/category/update-order` | ✅ |
| `GET /admin/v2/category/time-availability` | `GET /admin/v2/category/time-availability` | ✅ |
| (implicit) `POST /admin/v2/category/time-availability` | `POST /admin/v2/category/time-availability` | ✅ |

### 1.4 Menu — Items ✅ All match

| Frontend call | Backend route | Status | Notes |
|---|---|---|---|
| `GET /admin/v2/item/list?restaurantId=X&isMenuItem=Y` | `GET /admin/v2/item/list` | ✅ | `isMenuItem` param accepted as query param; needs pass-through in handler if used for filtering |
| `GET /admin/v2/item/subitem/list?restaurantId=X` | `GET /admin/v2/item/subitem/list` | ✅ | |
| `POST /admin/v2/item` | `POST /admin/v2/item` | ✅ | Body: `data.newItem` object |
| `POST /admin/v2/item/with-images` | `POST /admin/v2/item/with-images` | ✅ | Multipart; `itemData` JSON field + `uploadedImages` files |
| `GET /admin/v2/item/time-availability` | `GET /admin/v2/item/time-availability` | ✅ | |
| `POST /admin/v2/item/top_products` | `POST /admin/v2/item/top_products` | ✅ | |
| `GET /admin/v2/item/subitem-offers?subItemIds=X,Y` | `GET /admin/v2/item/subitem-offers` | ✅ | |

### 1.5 Menu — Addons ✅ All match

| Frontend call | Backend route | Status |
|---|---|---|
| `GET /admin/v2/addon/list?restaurantId=X` | `GET /admin/v2/addon/list` | ✅ |
| `POST /admin/v2/addon/add-edit` | `POST /admin/v2/addon/add-edit` | ✅ |
| `POST /admin/v2/addon/delete` | `POST /admin/v2/addon/delete` | ✅ |

### 1.6 Feedback ⚠️ All need adaptation

The frontend sends filter criteria as **POST request bodies** while the
backend exposes **GET** endpoints with query params; paths also differ.

| Frontend call | Backend route | Status | Action |
|---|---|---|---|
| `POST /admin/v2/feedback` | `GET /admin/v2/feedback/list` | ⚠️ | Rename backend to `POST /admin/v2/feedback` accepting body `{restaurantId, franchiseId?, rating?, page, pageSize}` |
| `POST /admin/v2/feedback/analytics` | `GET /admin/v2/dashboard/feedback-analytics` | ⚠️ | Add `POST /admin/v2/feedback/analytics` accepting body with date range |
| `POST /admin/v2/feedback/overall` | `GET /admin/v2/feedback/stats` | ⚠️ | Add `POST /admin/v2/feedback/overall` accepting body `{restaurantId, franchiseId?}` |
| `POST /admin/v2/feedback/pagination` | _(not implemented)_ | ❌ | Add `POST /admin/v2/feedback/pagination` returning total page count |

### 1.7 Customer Profiles ⚠️ All need adaptation

Frontend uses `/customerprofiles/…` paths; backend uses `/customers/…`.

| Frontend call | Backend route | Status | Action |
|---|---|---|---|
| `GET /admin/v2/customerprofiles/all-users?restaurantId=X&…` | `GET /admin/v2/customers/list` | ⚠️ | Add alias `GET /admin/v2/customerprofiles/all-users` |
| `POST /admin/v2/customerprofiles/all-receipts` | `GET /admin/v2/customers/:id/orders` | ⚠️ | Add `POST /admin/v2/customerprofiles/all-receipts` accepting `{customerId, restaurantId, page, …}` |
| `POST /admin/v2/customerprofiles/customer-details` | `GET /admin/v2/customers/:id` | ⚠️ | Add `POST /admin/v2/customerprofiles/customer-details` accepting `{customerId}` |
| `POST /admin/v2/customerprofiles/pagination` | _(not implemented)_ | ❌ | Add `POST /admin/v2/customerprofiles/pagination` returning page count |

### 1.8 Dashboard / Reports ⚠️

| Frontend call | Backend route | Status | Notes |
|---|---|---|---|
| `POST /admin/v2/dashboard/report` | _(not implemented as single endpoint)_ | ❌ | Frontend sends `{reportType, restaurantId, franchiseId?, timeInterval, startDate?, endDate?}` with `reportType` from `ReportType` enum (`ORDER_DATA`, `MENU_DATA`, `FEEDBACK_DATA`, `CUSTOMER_DATA`, `LOYALTY_DATA`). Backend has separate analytics GET endpoints. Need to add `POST /admin/v2/dashboard/report` that dispatches by `reportType`. |

### 1.9 Franchise Package Offers ⚠️ Path mismatch

Frontend uses `/franchisePackageOffer/…`; backend uses `/offers/…`.

| Frontend call | Backend route | Status | Action |
|---|---|---|---|
| `GET /admin/v2/franchisePackageOffer/all-fto` | `GET /admin/v2/offers/list` | ⚠️ | Add alias `GET /admin/v2/franchisePackageOffer/all-fto` |
| `POST /admin/v2/franchisePackageOffer/fto` | `POST /admin/v2/offers/save` | ⚠️ | Add alias `POST /admin/v2/franchisePackageOffer/fto` |
| `POST /admin/v2/franchisePackageOffer/end-fto` | `POST /admin/v2/offers/delete` | ⚠️ | Add alias `POST /admin/v2/franchisePackageOffer/end-fto` |

### 1.10 Loyalty / Pointing System ⚠️ Path mismatch

Frontend uses `/pointing/…`; backend uses `/loyalty/…`.

| Frontend call | Backend route | Status | Action |
|---|---|---|---|
| `GET /admin/v2/pointing/latest-pointing-system?restaurantId=X` | `GET /admin/v2/loyalty/pointing-system` | ⚠️ | Add alias `GET /admin/v2/pointing/latest-pointing-system` |
| `POST /admin/v2/pointing/create-pointing-system` | `POST /admin/v2/loyalty/pointing-system` | ⚠️ | Add alias `POST /admin/v2/pointing/create-pointing-system` |
| `GET /admin/v2/loyalty-calibration` | _(not implemented)_ | ❌ | Add `GET /admin/v2/loyalty-calibration` — returns campaign calibration config (unknown schema) |
| `POST /admin/v2/loyalty-calibration` | _(not implemented)_ | ❌ | Add `POST /admin/v2/loyalty-calibration` |

### 1.11 Foodics ⚠️ Multiple path mismatches

The frontend distinguishes between sync modes (menu-only, settings-only, both)
and has async variants of each; the backend only has one generic sync endpoint.

| Frontend call | Backend route | Status | Notes |
|---|---|---|---|
| `GET /admin/v2/foodics/get-last-sync` | `GET /admin/v2/foodics/sync-history` | ⚠️ | Rename or alias to `get-last-sync`; response shape likely differs (frontend expects a single date, backend returns array) |
| `POST /admin/v2/foodics/menu-sync` | `POST /admin/v2/foodics/sync` | ⚠️ | Add alias; accepts `{restaurantId}` |
| `POST /admin/v2/foodics/settings-sync` | _(not implemented)_ | ❌ | Separate sync for settings (categories/config) only |
| `POST /admin/v2/foodics/settings-menu-sync` | _(not implemented)_ | ❌ | Sync both settings and menu |
| `POST /admin/v2/foodics/async-menu-sync` | _(not implemented)_ | ❌ | Async (background job) variant of menu sync |
| `POST /admin/v2/foodics/async-settings-sync` | _(not implemented)_ | ❌ | Async settings-only sync |
| `POST /admin/v2/foodics/async-settings-menu-sync` | _(not implemented)_ | ❌ | Async full sync |

---

## 2. Customer Storefront (`customer_example_sided_website`)

### 2.1 Authentication ⚠️ Paths completely differ

The storefront uses `/auth/…` and `user/…`; the backend uses `/customer/…`.

| Frontend call | Backend route | Status | Notes |
|---|---|---|---|
| `POST /auth/otp` `{phoneNumber, countryCode, name, code, franchiseId, login, isPartnerAppUser, isMobileAppUser, isWebSelfServiceUser}` | `POST /customer/send-otp` `{phoneNumber, restaurantId}` | ⚠️ | Path differs. Frontend also passes `code` in the same call (combined send+verify); backend separates send and verify. Need to add `POST /auth/otp` that handles the two-in-one pattern or document expected split. |
| `POST /auth/check-otp` `{phoneNumber, name, code, isPartnerAppUser, isMobileAppUser, isWebSelfServiceUser, email, organization, title}` | `POST /customer/verify-otp` | ⚠️ | Path differs. Body shape differs: frontend sends `name` not `personName`, includes `organization`, `title`. |
| `POST /auth/send-verify-mail` `{organizationName, mail}` | _(not implemented)_ | ❌ | Email verification for organisation accounts |
| `POST user/create-visitor` `{isMobileAppUser, isPartnerAppUser, isWebSelfServiceUser}` | `POST /customer/visitor-login` `{restaurantId}` | ⚠️ | Path and body differ; backend uses `restaurantId` not app-type flags |
| `POST user/delete` | `DELETE /customer/account` | ⚠️ | Different method (POST vs DELETE) and path |
| `GET user/email-verified` | _(not implemented)_ | ❌ | Check if customer email is verified |
| `GET user/diconnect-organization-email` | _(not implemented)_ | ❌ | Note: intentional typo (`diconnect`) in frontend |
| `GET user/organization?restaurantId=X` | _(not implemented)_ | ❌ | Fetch customer's linked organisation |
| `POST user/loyalty-enrollment` `{code}` | _(not implemented)_ | ❌ | Enrol in a loyalty programme via code |

### 2.2 Restaurant & Menu

| Frontend call | Backend route | Status | Notes |
|---|---|---|---|
| `GET /restaurant/:id` | `GET /restaurant/:id` | ✅ | |
| `GET /category/details/:restaurantId` (optionally `?franchiseSlug=X`) | `GET /category/details/:restaurantId` | ✅ | Backend ignores `franchiseSlug`; frontend passes it to optionally filter by branch. Backend should either handle or silently ignore this param. |
| `GET items/item/:id` | `GET /items/item/:id` | ✅ | No leading `/` in frontend call — resolved relative to base URL, same effective path |
| `GET items/status?restaurantId=X&franchiseSlug=Y` | `GET /items/status?ids=X,Y` | ⚠️ | Frontend passes `restaurantId` + `franchiseSlug`; backend expects comma-separated `ids`. Completely different query parameter contract. |
| `GET /items/upselling-items` (RTK Query, auth via Redux token) | _(not implemented)_ | ❌ | Upselling/cross-sell suggestions |
| `GET franchise/is-open?franchiseId=X` | `GET /franchise/is-open/:franchiseId` | ⚠️ | Frontend passes `franchiseId` as **query param**; backend expects it as **path param** |
| `GET restaurant/social-media/:id` | _(not implemented)_ | ❌ | Social media links for the restaurant |

### 2.3 Orders & Receipts ⚠️ Several mismatches

| Frontend call | Backend route | Status | Notes |
|---|---|---|---|
| `POST /receipt/confirm` `(raw cart object t)` | `POST /receipt/confirm` | ✅⚠️ | Path matches; body shape needs verification — frontend passes the cart slice directly, backend expects `{restaurantId, franchiseId, orderType, paymentMethod, items, …}`. Likely compatible but must confirm field names |
| `GET /receipt/previous-orders?restaurantId=X` | `GET /receipt/list` | ⚠️ | Path differs; backend uses `/receipt/list` |
| `GET receipt/latest-receipt/:id` | `GET /receipt/:id` | ⚠️ | Frontend uses `/receipt/latest-receipt/:id`; backend uses `/receipt/:id` |
| `GET receipt/updated-receipt-state?receiptId=X&restaurantId=Y` | `GET /receipt/:id/track` | ⚠️ | Frontend uses query params; backend uses path param `:id` |
| `GET receipt/active-receipt?franchiseId=X` | _(not implemented)_ | ❌ | Active (in-progress) order polling |
| `GET receipt/active-receipt-per-restaurant?restaurantId=X` | _(not implemented)_ | ❌ | Per-restaurant active order check |
| `GET receipt/pos/:franchiseId/:deviceId` | _(not implemented)_ | ❌ | POS terminal receipt fetch |
| `POST /receipt/cancel-pos-receipt` `{franchiseId, deviceNumber}` | _(not implemented)_ | ❌ | POS receipt cancellation |
| `POST /feedback` `{numberOfStars, feedback, receiptId, feedbackTags, feedbackTagsText}` | `POST /receipt/:id/feedback` `{rating, comment?}` | ⚠️ | Path differs; body differs: `numberOfStars` vs `rating`, frontend includes `feedbackTags` array and `feedbackTagsText`, backend doesn't support tags |

### 2.4 Delivery Addresses ⚠️ Path and method mismatches

| Frontend call | Backend route | Status | Notes |
|---|---|---|---|
| `GET /delivery/address` | `GET /delivery/addresses` | ⚠️ | Singular vs plural in path |
| `POST /delivery/address` `{area, streetName, buildingNumber, floorNumber, apartmentNumber, addressTitle, additionalDetails, lat, lng, id, deliveryTypeId}` | `POST /delivery/addresses` | ⚠️ | Path (singular vs plural); body field names differ (`streetName`/`buildingNumber` etc vs `addressLine`); frontend sends `id` for update in same endpoint |
| `POST /delivery/delete-address` `{addressId}` | `DELETE /delivery/addresses/:id` | ⚠️ | Frontend uses POST with body `{addressId}`; backend uses DELETE with path param |

### 2.5 Loyalty, Points & Promos ⚠️ Paths differ

| Frontend call | Backend route | Status | Notes |
|---|---|---|---|
| `GET /pointing?restaurantId=X&splitedOfferFromList=Y&customerShortId=Z` | `GET /loyalty/balance` | ⚠️ | Path differs; frontend passes `splitedOfferFromList` and `customerShortId` which are not part of backend schema |
| `POST /promoCode/` `{promoCodeName, restaurantId}` | `POST /promo/validate` `{code, orderTotal, deliveryFee}` | ⚠️ | Path differs; body differs: `promoCodeName` vs `code`, frontend doesn't send `orderTotal`, backend requires it |
| `GET /loyalty-wallet-config/:franchiseId` | _(not implemented)_ | ❌ | Loyalty wallet configuration per franchise |
| `POST referralcode/info` `{restaurantId}` | `GET /loyalty/referral-info` | ⚠️ | Method (POST vs GET) and path differ |

### 2.6 Schedule Slots ❌ Not implemented

| Frontend call | Backend route | Status |
|---|---|---|
| `GET /schedule-slot/current?franchiseId=X` | _(not implemented)_ | ❌ |
| `GET /schedule-slot/franchise-delivery-zone-slots?franchiseId=X&deliveryZone=Y` | _(not implemented)_ | ❌ |

### 2.7 Notifications ⚠️ Path mismatches

| Frontend call | Backend route | Status | Notes |
|---|---|---|---|
| `GET notification/:restaurantId` | `GET /customer/notifications` | ⚠️ | Frontend passes `restaurantId` as path segment; backend derives restaurant from JWT |
| `POST notification/toggle-notification` `{…}` | `POST /customer/notifications/mark-read` | ⚠️ | Path differs |

### 2.8 User / Analytics

| Frontend call | Backend route | Status | Notes |
|---|---|---|---|
| `POST /user/customer-analytics` `{franchiseId, restaurantId, franchiseSlug, event, extraInfo}` | `POST /customer/analytics` `{event}` | ⚠️ | Path differs; body fields differ — frontend sends `franchiseId`, `franchiseSlug`, `extraInfo`; backend only stores `event` |
| `POST /user/alert` `{text, data, severity, printOnly}` | _(not implemented)_ | ❌ | Client-side error / alert reporting to server |
| `GET /user/paymob/cards` | _(not implemented)_ | ❌ | Saved Paymob card tokens |
| `POST /user/paymob/delete-card` `{…}` | _(not implemented)_ | ❌ | Remove a saved card |

### 2.9 Config ✅

| Frontend call | Backend route | Status |
|---|---|---|
| `GET /config` | `GET /config` | ✅ |

### 2.10 Socket.IO namespaces ✅ All match

| Frontend namespace | Backend namespace | Status |
|---|---|---|
| `/socket/restaurant` | `/socket/restaurant` | ✅ |
| `/socket/franchise` | `/socket/franchise` | ✅ |
| `/socket/waiter` | `/socket/waiter` | ✅ |

### 2.11 External / Microservice calls (not part of this backend)

These paths appear in the storefront but point to separate microservices
that this backend does not need to implement:

| Call | Notes |
|---|---|
| `POST cart-loyalty/cart/calculate` | Separate cart-loyalty service |
| `GET cart-loyalty/offer/` | Separate cart-loyalty service |
| `POST link-tracking/receipt` | Link tracking microservice |
| `POST link-tracking/visit` | Link tracking microservice |
| `GET roboost/trackOrder?deliveryReceiptId=X&referenceNumber=Y` | Roboost delivery tracking (third-party) |
| `GET /apple-wallet/pass/`, `POST /apple-wallet/pass/generate` | Apple Wallet pass service |
| `GET /google-wallet/create-pass-object` | Google Wallet service |
| `GET /organizations/all-organizations/:id` | Multi-org service |
| `GET organizations/organization-customer/:id` | Multi-org service |
| `GET user/check-Customer-offline-offers?customerShortId=X` | Offline offers service |

---

## 3. Summary Table

### By count

| Category | Admin | Customer |
|---|---|---|
| ✅ Match | 26 | 7 |
| ⚠️ Adapt (path/method/body fix) | 19 | 22 |
| ❌ Missing entirely | 10 | 20 |

### Priority ranking for adaptation (highest impact first)

#### Tier 1 — Core user flows broken without these

1. **Customer auth paths** — `POST /auth/otp`, `POST /auth/check-otp` redirect to wrong backend endpoints; storefront cannot log in.
2. **Customer delivery addresses** — All three address calls use wrong paths (`/delivery/address` vs `/delivery/addresses`, POST-delete vs DELETE).
3. **Customer receipt history** — `GET /receipt/previous-orders` hits a 404; backend has `/receipt/list`.
4. **Customer order tracking** — `GET receipt/updated-receipt-state` hits 404; backend has `/receipt/:id/track` with different param convention.
5. **Customer visitor login** — `POST user/create-visitor` hits 404; backend has `/customer/visitor-login`.
6. **Customer feedback** — `POST /feedback` hits 404; backend has `/receipt/:id/feedback` with different body.

#### Tier 2 — Admin core flows broken

7. **Admin feedback pages** — All four `/feedback/*` paths wrong (POST vs GET, different paths).
8. **Admin customer profiles** — All four `/customerprofiles/*` paths wrong.
9. **Admin pointing/loyalty** — `/pointing/latest-pointing-system` and `/pointing/create-pointing-system` wrong paths.
10. **Admin package offers** — All three `/franchisePackageOffer/*` paths wrong.
11. **Admin restaurant info** — `GET /admin/v2/restaurant/:id` 404s (only exists at `/restaurant/:id`).

#### Tier 3 — Features degraded but non-blocking

12. `GET /franchise/is-open` — query param vs path param.
13. `GET items/status` — completely different query params.
14. `POST /promoCode/` — wrong path and body.
15. `GET notification/:id` — wrong path pattern.
16. `POST /user/customer-analytics` — wrong path.
17. **Admin dashboard report** — `POST /dashboard/report` not implemented.
18. **Foodics sync paths** — All sync endpoints have wrong paths.

#### Tier 4 — Missing features (no equivalent in backend)

19. Schedule slots (`GET /schedule-slot/…` × 2)
20. Active receipt polling (`GET receipt/active-receipt`)
21. POS receipt endpoints × 2
22. Paymob saved cards × 2
23. Loyalty wallet config
24. Loyalty calibration (admin) × 2
25. Email verification flow × 3
26. Foodics async sync × 5
27. `POST /auth/send-verify-mail`

---

## 4. Key structural observations

### Admin — the interceptor skips auth on sign-in
The admin axios interceptor explicitly skips the `Authorization` header for
`/admin/v2/sign-in` and `/admin/v2/signin`. The backend already exempts these
routes from `requireAdmin`. ✅

### Customer — version header
The customer interceptor sets `headers.version = "v2"` on every request.
The backend CORS plugin already allows this header. ✅

### Customer — RTK Query token source
The `/items/upselling-items` RTK Query endpoint reads the token from Redux
`userInfo.token` state (not from the `TOKEN` cookie). If the backend returns
the token only as a cookie and not in the response body, the RTK endpoint
will fail to authenticate.

### The `franchiseSlug` filter on `/category/details/:restaurantId`
The storefront optionally appends `?franchiseSlug=X` when fetching menu by
branch. The backend currently ignores this parameter and returns the full
menu. If per-branch item visibility is a feature, the backend needs to handle
this filter.

### `POST /receipt/confirm` body shape
The storefront passes the Redux cart slice directly as the request body.
The most critical fields to verify against backend Zod schema are:
- `orderType` — frontend likely uses `DELIVERY | TAKE_OUT | DINE_IN` (enum values from
  `OrderType` constant); backend schema uses `z.nativeEnum(OrderType)` ✅
- `paymentMethod` — frontend likely uses lowercase values (`cash`, `online_card`); backend
  schema uses `z.nativeEnum(PaymentMethod)` ✅
- `items[].itemId` — must be present in the item objects that the frontend sends.
  Storefront cart items typically have `id` not `itemId`; this needs verification.

### `POST /feedback` field name: `numberOfStars` vs `rating`
The storefront sends `{numberOfStars, feedback, receiptId, feedbackTags, feedbackTagsText}`.
The backend expects `{rating, comment?}` at `POST /receipt/:id/feedback`.
Both the path and at least two field names differ.

### Delivery address fields: flat vs structured
Storefront sends `{area, streetName, buildingNumber, floorNumber, apartmentNumber,
addressTitle, additionalDetails, lat, lng, id, deliveryTypeId}` — a structured address.
Backend expects `{label, addressLine, area, lat, lng, isDefault}` — a flat string.
These need a field-mapping adapter.

### `GET /pointing` response shape
The storefront passes extra params `splitedOfferFromList` and `customerShortId`
(the latter appears to be a short customer identifier separate from the UUID `id`).
The backend schema has no `customerShortId` column; customers are identified by UUID.
This is the most significant data-model difference found.
