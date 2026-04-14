# API Contract

Reverse-engineered from the compiled Next.js frontends:
- `admin.eg.prepit.app` — merchant management panel
- `customer_example_sided_website` — customer-facing storefront

---

## Base URLs

| Frontend | Base URL | Notes |
|----------|----------|-------|
| Admin | `https://api.eg.l.prepits.com/admin/v2` | Env: `NEXT_PUBLIC_HOST` |
| Customer | `https://api.eg.l.prepits.com` | API versions `v1` / `v2` per call |

---

## Authentication

### Admin
- Axios interceptor reads JWT from cookie `admin-token`
- Header: `Authorization: Bearer <token>`
- Skipped for: `POST /admin/v2/sign-in`, `POST /admin/v2/signin`

### Customer
- Axios interceptor reads JWT from cookie named `TOKEN`
- Header: `Authorization: Bearer <token>`
- Header: `version: v2` added to all requests
- JWT payload contains: `customer_id`, `person_name`, `phone_number`

---

## Admin API Endpoints

All paths are relative to base `/admin/v2`.

---

### Authentication

#### `POST /signin`
Sign in as admin.

**Request body:**
```json
{ "email": "string", "password": "string" }
```

**Response:**
```json
{ "token": "string" }
```

**Auth:** Public

---

#### `POST /forgot-password`
Send password reset email.

**Request body:**
```json
{ "email": "string" }
```

**Auth:** Public

---

#### `POST /verify-reset-password-token`
Validate reset token before allowing password change.

**Request body:**
```json
{ "token": "string" }
```

**Auth:** Public

---

#### `POST /reset-password`
Set new password using reset token.

**Request body:**
```json
{ "token": "string", "newPassword": "string" }
```

**Auth:** Public

---

### Admin Info

#### `GET /info`
Get admin's restaurant and franchise info. Called on every authenticated page load.

**Response:**
```json
{
  "restaurant": {
    "id": "number",
    "name": "string",
    "backgroundImg": "string",
    "logoUrl": "string",
    "preferredCountry": "string",
    "isFoodicsRestaurant": "boolean",
    "config": "object",
    "mainFranchiseId": "number"
  },
  "franchises": [
    {
      "id": "number",
      "name": "string"
    }
  ]
}
```

**Auth:** Merchant (Bearer token)

---

### Menu — Categories

#### `POST /category`
Create a new category.

**Request body:**
```json
{
  "restaurantId": "number",
  "category_name": "string",
  "category_name_arabic": "string",
  "description": "string"
}
```

**Auth:** Merchant

---

#### `POST /category/edit`
Edit an existing category.

**Request body:**
```json
{
  "id": "number",
  "restaurantId": "number",
  "category_name": "string",
  "category_name_arabic": "string",
  "description": "string"
}
```

**Auth:** Merchant

---

#### `POST /category/delete`
Delete a category.

**Request body:**
```json
{ "id": "number", "restaurantId": "number" }
```

**Auth:** Merchant

---

#### `POST /category/update-order`
Reorder categories (drag-and-drop).

**Request body:**
```json
{
  "restaurantId": "number",
  "categories": [{ "id": "number", "order": "number" }]
}
```

**Auth:** Merchant

---

#### `GET /category/time-availability`
Get all category time-based availability rules.

**Query params:** `restaurantId` (from auth context)

**Response:**
```json
[
  {
    "categoryId": "number",
    "startTime": "string",
    "endTime": "string",
    "enabled": "boolean"
  }
]
```

**Auth:** Merchant

---

#### `POST /category/time-availability`
Update a category's time-based availability.

**Request body:**
```json
{
  "categoryId": "number",
  "startTime": "string",
  "endTime": "string",
  "enabled": "boolean"
}
```

**Auth:** Merchant

---

#### `GET /category/details/{restaurantId}`
Get all categories with their nested items. Used by both frontends.

**Response:**
```json
[
  {
    "id": "number",
    "category_name": "string",
    "category_name_arabic": "string",
    "restaurant": { "id": "number", "menuVersion": "string" },
    "itemCategories": [
      {
        "item": {
          "id": "number",
          "item_name": "string",
          "item_name_arabic": "string",
          "price": "number",
          "description": "string",
          "description_arabic": "string",
          "image": "string",
          "subItems": [...]
        }
      }
    ]
  }
]
```

**Auth:** Public (customer) / Merchant (admin)

---

### Menu — Items

#### `POST /item`
Create or edit a menu item (no image upload).

**Request body (newItem object):**
```json
{
  "id": "number | null",
  "restaurantId": "number",
  "item_name": "string",
  "item_name_arabic": "string",
  "description": "string",
  "description_arabic": "string",
  "price": "number",
  "categoryId": "number",
  "visible": "boolean",
  "subItems": []
}
```

**Auth:** Merchant

---

#### `POST /item/with-images`
Create or edit a menu item with image upload.

**Request:** `multipart/form-data`
- `itemData`: JSON string of item object (same as above)
- `uploadedImages`: image files (PNG, JPG, JPEG, max 5MB each)

**Auth:** Merchant

---

#### `GET /item/list`
Get list of items.

**Query params:** `restaurantId`, `isMenuItem` (boolean)

**Auth:** Merchant

---

#### `GET /item/subitem/list`
Get sub-items (combo items).

**Query params:** `restaurantId`

**Auth:** Merchant

---

#### `GET /item/time-availability`
Get all item time-based availability rules.

**Auth:** Merchant

---

#### `POST /item/time-availability`
Update item time availability.

**Request body:**
```json
{
  "itemId": "number",
  "restaurantId": "number",
  "startTime": "string",
  "endTime": "string",
  "enabled": "boolean"
}
```

**Auth:** Merchant

---

#### `POST /item/top_products`
Get top-selling products for analytics.

**Request body:**
```json
{
  "restaurantId": "number",
  "franchiseIds": ["number"],
  "timeInterval": "string",
  "startDate": "string | null",
  "endDate": "string | null"
}
```

**Auth:** Merchant

---

#### `GET /item/subitem-offers`
Get offers associated with sub-items.

**Query params:** `subItemIds` (comma-separated IDs)

**Auth:** Merchant

---

### Menu — Addons

#### `POST /addon/add-edit`
Create or edit an addon group.

**Request body:**
```json
{
  "id": "number | null",
  "restaurantId": "number",
  "name": "string",
  "name_arabic": "string",
  "required": "boolean",
  "min": "number",
  "max": "number",
  "addonValues": [
    {
      "id": "number | null",
      "name": "string",
      "name_arabic": "string",
      "price": "number"
    }
  ]
}
```

**Auth:** Merchant

---

#### `POST /addon/delete`
Delete an addon group.

**Request body:**
```json
{ "id": "number", "restaurantId": "number" }
```

**Auth:** Merchant

---

#### `GET /addon/list`
Get all addon groups.

**Query params:** `restaurantId`

**Auth:** Merchant

---

### Dashboard & Analytics

#### `POST /dashboard/sales-data`
Sales analytics.

**Request body:**
```json
{
  "timeInterval": "TODAY|YESTERDAY|THIS_WEEK|LAST_WEEK|THIS_MONTH|LAST_MONTH|LAST_YEAR|THIS_YEAR|PREVIOUS_30_DAYS|SPECIFIC_RANGE",
  "startDate": "ISO string | null",
  "endDate": "ISO string | null",
  "franchiseIds": ["number"]
}
```

**Response:**
```json
{ "salesInfo": { "totalAmount": "number", "totalOrders": "number", "averageOrderSize": "number" } }
```

**Auth:** Merchant

---

#### `POST /dashboard/loyalty-data`
Loyalty program analytics.

**Request body:** Same shape as `sales-data`

**Response:**
```json
{ "loyaltyInfo": { ... } }
```

**Auth:** Merchant

---

#### `POST /dashboard/offline-loyalty-data`
Offline loyalty analytics.

**Request body:** Same as `sales-data` + `restaurantId`

**Auth:** Merchant

---

#### `POST /dashboard/trends-data`
Order/customer trend analytics.

**Request body:** Same as `sales-data`

**Response:**
```json
{ "orderTrends": [...], "customerTrends": [...] }
```

**Auth:** Merchant

---

#### `POST /dashboard/points-data`
Loyalty points analytics.

**Request body:** Same as `sales-data` + `restaurantId`

**Response:**
```json
{ "pointsDashboard": { ... } }
```

**Auth:** Merchant

---

#### `POST /dashboard/offers-data`
Offers/campaigns analytics.

**Request body:** Same as `sales-data` + `restaurantId`

**Response:**
```json
{ "offersDashboard": { ... } }
```

**Auth:** Merchant

---

#### `POST /overview`
Aggregated overview metrics.

**Request body:**
```json
{
  "timeInterval": "string",
  "franchiseIds": ["number"]
}
```

**Response:**
```json
{
  "totalAmount": "number",
  "totalOrders": "number",
  "averageOrderSize": "number",
  "tips": "number",
  "enrolledUsers": "number",
  "overallRating": "number",
  "repeatCustomerFrequency": "number",
  "topCustomers": [...],
  "topProducts": [...],
  "orderRedemptionRate": "number",
  "pointsRedemptionRate": "number",
  "campaignConversionRate": "number",
  "roi": "number"
}
```

**Auth:** Merchant

---

#### `POST /dashboard/report`
Export report data.

**Request body:**
```json
{
  "reportType": "ORDER_DATA|MENU_DATA|FEEDBACK_DATA|CUSTOMER_DATA|LOYALTY_DATA",
  "timeInterval": "string",
  "startDate": "string | null",
  "endDate": "string | null",
  "franchiseIds": ["number"],
  "restaurantId": "number"
}
```

**Auth:** Merchant

---

### Feedback

#### `POST /feedback`
Get paginated feedback list.

**Request body:**
```json
{
  "restaurantId": "number",
  "franchiseIds": ["number"],
  "timeInterval": "string",
  "startDate": "string | null",
  "endDate": "string | null",
  "page": "number",
  "pageSize": "number"
}
```

**Auth:** Merchant

---

#### `POST /feedback/overall`
Get overall feedback summary.

**Request body:**
```json
{
  "restaurantId": "number",
  "franchiseIds": ["number"],
  "timeInterval": "string"
}
```

**Auth:** Merchant

---

#### `POST /feedback/pagination`
Get feedback page count.

**Request body:** Same as `/feedback`

**Response:**
```json
{ "numberOfPages": "number" }
```

**Auth:** Merchant

---

#### `POST /feedback/analytics`
Get feedback analytics breakdown.

**Request body:**
```json
{
  "restaurantId": "number",
  "franchiseIds": ["number"],
  "timeInterval": "string",
  "startDate": "string | null",
  "endDate": "string | null"
}
```

**Auth:** Merchant

---

### Customer Profiles (Admin view)

#### `GET /customerprofiles/all-users`
Get all customers for a restaurant.

**Query params:** `restaurantId`, `franchiseIds[]`, `page`, `pageSize`, `substring` (search)

**Auth:** Merchant

---

#### `POST /customerprofiles/pagination`
Get customer count / page count.

**Request body:**
```json
{
  "restaurantId": "number",
  "numberOfProfilesPerPage": "number",
  "substring": "string"
}
```

**Response:**
```json
{ "numberOfPages": "number" }
```

**Auth:** Merchant

---

#### `POST /customerprofiles/customer-details`
Get detailed profile for one customer.

**Request body:**
```json
{ "customerId": "string", "restaurantId": "number" }
```

**Auth:** Merchant

---

#### `POST /customerprofiles/all-receipts`
Get all receipts for a customer.

**Request body:**
```json
{ "customerId": "string", "restaurantId": "number" }
```

**Auth:** Merchant

---

### Loyalty / Pointing System

#### `GET /pointing/latest-pointing-system`
Get the current loyalty rules for a restaurant.

**Query params:** `restaurantId`

**Auth:** Merchant

---

#### `POST /pointing/create-pointing-system`
Create or update loyalty program rules.

**Request body:**
```json
{
  "restaurantId": "number",
  "pointsPerUnit": "number",
  "minimumSpend": "number",
  "redeemValue": "number",
  "pointsRequiredToRedeem": "number",
  "expiryDays": "number | null"
}
```

**Auth:** Merchant

---

#### `GET /loyalty-calibration`
Get AI campaign calibration settings.

**Auth:** Merchant

---

#### `POST /loyalty-calibration`
Update AI campaign calibration settings.

**Request body:** Campaign calibration config object

**Auth:** Merchant

---

### Franchise Package Offers (Welcome Rewards / Flash Offers)

#### `GET /franchisePackageOffer/all-fto`
Get all franchise package offers.

**Auth:** Merchant

---

#### `POST /franchisePackageOffer/fto`
Create or update a package offer.

**Request body:**
```json
{
  "id": "number | null",
  "restaurantId": "number",
  "name": "string",
  "offerType": "FIXED_AMOUNT|PERCENTAGE_AMOUNT|FREE_ITEM|DISCOUNT_ITEM",
  "value": "number",
  "minimumSpend": "number | null",
  "cap": "number | null",
  "startDate": "ISO string",
  "endDate": "ISO string",
  "branches": ["number"],
  "orderTypes": ["TAKE_OUT|DINE_IN|DELIVERY"]
}
```

**Auth:** Merchant

---

#### `POST /franchisePackageOffer/end-fto`
Delete or end a package offer.

**Request body:**
```json
{ "id": "number" }
```

**Auth:** Merchant

---

### Restaurant

#### `GET /restaurant/{restaurantId}`
Get full restaurant config. Used by both frontends.

**Response:**
```json
{
  "id": "number",
  "name": "string",
  "backgroundImg": "string",
  "logoUrl": "string",
  "preferredCountry": "eg|ca|sa|ae",
  "isFoodicsRestaurant": "boolean",
  "config": {
    "adminMenuManagement": "boolean"
  },
  "franchises": [...]
}
```

**Auth:** Public (customer) / Merchant (admin)

---

#### `POST /restaurant/admin-analytics`
Track admin-side UI analytics event.

**Request body:**
```json
{
  "event": "ADMIN_ANALYTICS_EVENT string",
  "restaurantId": "number"
}
```

**Auth:** Merchant

---

### Foodics Integration

#### `POST /foodics/authorize`
Handle Foodics OAuth callback.

**Request body:**
```json
{
  "foodicsReference": "string",
  "restaurantId": "number",
  "appType": "ordering|loyalty"
}
```

**Auth:** Merchant

---

#### `POST /foodics/settings-sync`
Sync Foodics settings (branches, images, config).

**Request body:**
```json
{ "restaurantId": "number" }
```

**Auth:** Merchant

---

#### `POST /foodics/menu-sync`
Sync Foodics menu (products, modifiers, combos).

**Request body:**
```json
{ "restaurantId": "number" }
```

**Auth:** Merchant

---

#### `POST /foodics/settings-menu-sync`
Sync both settings and menu.

**Request body:**
```json
{ "restaurantId": "number" }
```

**Auth:** Merchant

---

#### `POST /foodics/async-settings-sync`
Start async settings sync (returns immediately, notifies via socket).

**Request body:**
```json
{ "restaurantId": "number" }
```

**Auth:** Merchant

---

#### `POST /foodics/async-menu-sync`
Start async menu sync.

**Request body:**
```json
{ "restaurantId": "number" }
```

**Auth:** Merchant

---

#### `POST /foodics/async-settings-menu-sync`
Start async full sync.

**Request body:**
```json
{ "restaurantId": "number" }
```

**Auth:** Merchant

---

#### `POST /foodics/get-last-sync`
Get timestamps of last sync operations.

**Request body:**
```json
{ "restaurantId": "number" }
```

**Response:**
```json
{
  "lastMenuSyncAt": "ISO string | null",
  "lastSettingsSyncAt": "ISO string | null",
  "lastMenuSyncSuccessAt": "ISO string | null",
  "lastSettingsSyncSuccessAt": "ISO string | null",
  "isSuccess": "boolean"
}
```

**Auth:** Merchant

---

### WebSocket — Admin

**Namespace:** `/socket/admin`  
**Connection query:** `{ adminId: number, token: string }`  
**Events emitted by server:** (TBD — used for Foodics async sync progress)

---

---

## Customer API Endpoints

All paths relative to base `https://api.eg.l.prepits.com`.

---

### Authentication

#### `POST /auth/otp`
Request or resend OTP for phone login.

**Request body:**
```json
{
  "phoneNumber": "string",
  "countryCode": "string",
  "name": "string",
  "code": "string | null",
  "franchiseId": "number",
  "login": "boolean",
  "isPartnerAppUser": "boolean",
  "isMobileAppUser": "boolean",
  "isWebSelfServiceUser": "boolean"
}
```

**Response:**
```json
{ "sent": "boolean" }
```

**Auth:** Public

---

#### `POST /auth/check-otp`
Verify OTP and authenticate.

**Request body:**
```json
{
  "phoneNumber": "string",
  "name": "string",
  "code": "string",
  "isPartnerAppUser": "boolean",
  "isMobileAppUser": "boolean",
  "isWebSelfServiceUser": "boolean",
  "email": "string | null",
  "organization": "string | null",
  "title": "string | null"
}
```

**Response:**
```json
{
  "token": "string",
  "isNewUser": "boolean"
}
```

**Auth:** Public

---

#### `POST /auth/send-verify-mail`
Send verification email to customer.

**Request body:**
```json
{
  "organizationName": "string",
  "mail": "string"
}
```

**Auth:** Customer

---

#### `POST /verify-phone`
Verify phone number.

**Auth:** Customer

---

### Restaurant & Menu

#### `GET /restaurant/{restaurantId}`
Get restaurant data by ID.

**Response:**
```json
{
  "id": "number",
  "name": "string",
  "logoUrl": "string",
  "backgroundImg": "string",
  "preferredCountry": "string",
  "franchises": [...],
  "config": {...},
  "menuVersion": "string"
}
```

**Auth:** Public

---

#### `GET /restaurant/social-media/{restaurantId}`
Get social media links for a restaurant.

**Auth:** Public

---

#### `GET /config`
Get restaurant configuration. (RTK Query)

**Auth:** Public

---

#### `GET /category/details/{restaurantId}`
Get full menu (categories + items) for a restaurant.

**Query params:** `franchiseSlug` (optional), `menuVersion` (optional, for cache-busting)

**Auth:** Public

---

#### `GET /items/item/{itemId}`
Get details for a single item (for item detail page).

**Auth:** Public

---

#### `GET /items/status`
Get item availability status map.

**Query params:** `restaurantId`, `franchiseSlug`

**Auth:** Public

---

#### `GET /items/upselling-items`
Get upsell suggestions.

**Auth:** Public (via RTK Query, adds `Authorization` header if token present)

---

#### `GET /franchise/is-open`
Check if a franchise branch is currently open.

**Query params:** `franchiseId`

**Response:**
```json
{ "isOpen": "boolean" }
```

**Auth:** Public

---

### Orders / Receipts

#### `POST /receipt/confirm`
Place an order (create receipt). This is the main checkout endpoint.

**Request body (inferred from cart structure):**
```json
{
  "restaurantId": "number",
  "franchiseId": "number",
  "orderType": "DELIVERY|TAKE_OUT|DINE_IN",
  "items": [
    {
      "itemId": "number",
      "quantity": "number",
      "price": "number",
      "subItems": [{ "id": "number", "name": "string", "price": "number" }],
      "note": "string | null"
    }
  ],
  "deliveryAddressId": "number | null",
  "tip": "number",
  "promoCode": "string | null",
  "paymentMethod": "cash|online_card|card_on_delivery|pos",
  "paymobCardId": "number | null",
  "scheduleSlotId": "number | null",
  "loyaltyPointsToRedeem": "number",
  "receiptNote": "string | null",
  "tableNumber": "string | null"
}
```

**Response:**
```json
{
  "id": "string",
  "receiptState": "PENDING|ON_WAY_TO_PICKUP|ON_WAY_TO_DELIVERY|DELIVERED|CANCELLED",
  "paymentUrl": "string | null",
  "totalAmount": "number"
}
```

**Auth:** Customer or Guest

---

#### `GET /receipt`
Get a specific receipt.

**Query params:** `receiptId`

**Auth:** Customer

---

#### `GET /receipt/previous-orders`
Get order history for current customer.

**Query params:** `restaurantId`

**Auth:** Customer

---

#### `GET /receipt/latest-receipt/{restaurantId}`
Get most recent receipt for a restaurant.

**Auth:** Customer

---

#### `GET /receipt/active-receipt`
Get active (pending/in-progress) receipt.

**Query params:** `franchiseId`

**Auth:** Customer

---

#### `GET /receipt/active-receipt-per-restaurant`
Get active receipt by restaurant.

**Query params:** `restaurantId`

**Auth:** Customer

---

#### `GET /receipt/updated-receipt-state`
Poll for updated order state.

**Query params:** `receiptId`, `restaurantId`

**Response:**
```json
{
  "receiptId": "string",
  "receiptState": "PENDING|ON_WAY_TO_PICKUP|ON_WAY_TO_DELIVERY|DELIVERED|CANCELLED"
}
```

**Auth:** Customer

---

#### `GET /receipt/pos/{deviceNumber}/{franchiseId}`
Get POS terminal receipt.

**Auth:** Customer / Kiosk

---

#### `POST /receipt/cancel-pos-receipt`
Cancel a POS receipt.

**Request body:**
```json
{ "franchiseId": "number", "deviceNumber": "string" }
```

**Auth:** Customer / Kiosk

---

### Delivery

#### `GET /delivery/address`
Get all saved delivery addresses for current customer.

**Response:**
```json
[
  {
    "id": "number",
    "area": "string",
    "streetName": "string",
    "buildingNumber": "string",
    "floorNumber": "string",
    "apartmentNumber": "string",
    "addressTitle": "string",
    "additionalDetails": "string",
    "lat": "number",
    "lng": "number",
    "deliveryTypeId": "number"
  }
]
```

**Auth:** Customer

---

#### `POST /delivery/address`
Create or update a delivery address.

**Request body:**
```json
{
  "id": "number | null",
  "area": "string",
  "streetName": "string",
  "buildingNumber": "string",
  "floorNumber": "string",
  "apartmentNumber": "string",
  "addressTitle": "string",
  "additionalDetails": "string",
  "lat": "number",
  "lng": "number",
  "deliveryTypeId": "number"
}
```

**Auth:** Customer

---

#### `POST /delivery/delete-address`
Delete a delivery address.

**Request body:**
```json
{ "addressId": "number" }
```

**Auth:** Customer

---

### Payment (Paymob)

#### `GET /user/paymob/cards`
Get customer's saved Paymob cards.

**Response:**
```json
[
  {
    "id": "number",
    "maskedPan": "string",
    "cardSubtype": "VISA/MASTER|mada|Apple Pay|Google Pay",
    "isDefault": "boolean"
  }
]
```

**Auth:** Customer

---

#### `POST /user/paymob/delete-card`
Delete a saved card.

**Request body:**
```json
{ "cardId": "number" }
```

**Auth:** Customer

---

#### `GET /pay`
Initiate payment / redirect to Paymob. (Page-level navigation with query params)

**Query params:** `orderId`, `returnUrl`, `failUrl`

**Auth:** Customer

---

### Loyalty & Points

#### `GET /pointing`
Get loyalty program info and customer's points.

**Query params:** `restaurantId`, `splitedOfferFromList` (boolean), `customerShortId`

**Response:**
```json
{
  "pointsBalance": "number",
  "pointsEarned": "number",
  "pointsRedeemed": "number",
  "availableOffers": [...],
  "enrollmentStatus": "enrolled|inactive"
}
```

**Auth:** Customer

---

#### `POST /promoCode/`
Apply or validate a promo code.

**Request body:**
```json
{ "promoCodeName": "string", "restaurantId": "number" }
```

**Auth:** Customer

---

#### `POST /cart-loyalty/cart/calculate`
Calculate cart total with loyalty discounts applied.

**Request body:** Cart object (items, promoCode, redemption info)

**Auth:** Customer

---

#### `GET /cart-loyalty/offer/`
Get available loyalty offers for current customer.

**Query params:** (cart/customer context params)

**Auth:** Customer

---

#### `GET /loyalty-wallet-config/{restaurantId}`
Get loyalty wallet display config (for Apple/Google Wallet).

**Auth:** Customer

---

#### `POST /user/loyalty-enrollment`
Enroll customer in loyalty program.

**Request body:**
```json
{ "code": "string" }
```

**Auth:** Customer

---

#### `GET /user/check-Customer-offline-offers`
Check offline loyalty offers.

**Query params:** `customerShortId`

**Auth:** Public

---

### Schedule

#### `GET /schedule-slot/current`
Get available pickup/delivery time slots.

**Query params:** `franchiseId`

**Response:**
```json
[
  {
    "id": "number",
    "label": "string",
    "startTime": "ISO string",
    "endTime": "ISO string",
    "available": "boolean"
  }
]
```

**Auth:** Public

---

#### `GET /schedule-slot/franchise-delivery-zone-slots`
Get time slots for a specific delivery zone.

**Query params:** `franchiseId`, `deliveryZoneId`

**Auth:** Public

---

### Feedback (Customer)

#### `POST /feedback`
Submit order feedback.

**Request body:**
```json
{
  "receiptId": "string",
  "numberOfStars": "1|2|3|4|5",
  "feedback": "string",
  "feedbackTags": ["SERVICE|APP|QUALITY|ORDER|WAITER"],
  "feedbackTagsText": "string"
}
```

**Auth:** Customer

---

### User Account

#### `POST /user/create-visitor`
Create anonymous visitor session.

**Request body:**
```json
{
  "isMobileAppUser": "boolean",
  "isPartnerAppUser": "boolean",
  "isWebSelfServiceUser": "boolean"
}
```

**Response:**
```json
{ "token": "string", "visitorId": "string" }
```

**Auth:** Public

---

#### `POST /user/customer-analytics`
Track customer-side analytics event.

**Request body:**
```json
{
  "event": "string",
  "extraInfo": "object",
  "franchiseId": "number",
  "restaurantId": "number",
  "franchiseSlug": "string"
}
```

**Auth:** Customer or Guest

---

#### `POST /user/alert`
Log client-side error / warning to backend.

**Request body:**
```json
{
  "text": "string",
  "data": "object",
  "severity": "LOW|MEDIUM|HIGH",
  "printOnly": "boolean"
}
```

**Auth:** Customer or Guest

---

#### `GET /user/organization`
Get user's organization association.

**Query params:** `restaurantId`

**Auth:** Customer

---

#### `GET /user/diconnect-organization-email`
Disconnect organization email from account.

**Auth:** Customer

---

#### `GET /user/email-verified`
Check if customer's email is verified.

**Auth:** Customer

---

#### `POST /user/delete`
Delete customer account.

**Auth:** Customer

---

### Referral

#### `POST /referralcode/info`
Get referral program info for a customer.

**Request body:**
```json
{ "restaurantId": "number" }
```

**Auth:** Customer

---

### Notifications

#### `GET /notification/{customerId}`
Get customer notifications.

**Auth:** Customer

---

#### `POST /notification/toggle-notification`
Toggle notification preferences.

**Request body:**
```json
{ "type": "string", "enabled": "boolean" }
```

**Auth:** Customer

---

### Organizations

#### `GET /organizations/all-organizations/{restaurantId}`
Get all organizations for a restaurant.

**Auth:** Customer

---

#### `GET /organizations/organization-customer/{id}`
Get customer's organization link.

**Auth:** Customer

---

### Apple Wallet / Google Wallet

#### `GET /apple-wallet/pass/{customerId}/{restaurantId}`
Get existing Apple Wallet pass.

**Auth:** Customer

---

#### `GET /apple-wallet/registered-pass/{customerId}/{restaurantId}`
Get registered Apple Wallet pass.

**Query params:** `customerShortId` (optional)

**Auth:** Customer

---

#### `POST /apple-wallet/pass/generate`
Generate Apple Wallet loyalty pass.

**Request body:**
```json
{ "customerId": "string", "restaurantId": "number" }
```

**Response:** `application/octet-stream` (blob)

**Auth:** Customer

---

#### `GET /google-wallet/registered-pass/{customerId}/{restaurantId}`
Get registered Google Wallet pass.

**Auth:** Customer

---

#### `POST /google-wallet/create-pass-object`
Create Google Wallet loyalty pass.

**Request body:**
```json
{ "customerId": "string", "restaurantId": "number" }
```

**Auth:** Customer

---

### Mobile App Redirects

#### `GET /mobile-app/store-redirect`
Redirect to app store.

**Query params:** `os`, `restaurantId`, `linkSource`, `deviceId`

**Auth:** Public

---

#### `GET /mobile-app/download-app-popup`
Get download app popup config.

**Query params:** `restaurantId`

**Auth:** Public

---

### Delivery Tracking (Roboost)

#### `GET /roboost/trackOrder`
Track delivery order via Roboost integration.

**Query params:** `deliveryReceiptId`, `referenceNumber`

**Auth:** Customer

---

### Link Tracking

#### `POST /link-tracking/visit`
Track a marketing link visit.

**Request body:**
```json
{ "referenceName": "string" }
```

**Auth:** Public

---

#### `POST /link-tracking/receipt`
Track that a receipt came from a marketing link.

**Request body:**
```json
{ "referenceName": "string", "receiptId": "string" }
```

**Auth:** Customer

---

### WebSockets — Customer

**Socket.IO v3 used throughout.**

#### Namespace: `/socket/restaurant`
**Connection query:** `{ restaurantId: number, token: string }`

**Events (server → client):**
- `RESTAURANT_ITEM_STATUS_CHANGE` — Menu item enabled/disabled; client re-fetches menu
- `MENU_VERSION_CHANGE` — Menu updated; client re-fetches menu
- `RECEIPT_STATE_CHANGE` — Order status updated `(receiptId: string)`
- `ORGANICATION_CUSTOMER_VERIFIED` — Customer org verification completed
- `REWARD_REDEEMED` — Loyalty reward was redeemed `(packageOfferId: string)`
- `WALLET_CARD_ADDED` — New payment card added

#### Namespace: `/socket/franchise`
**Connection query:** `{ franchiseId: number, token: string }`

#### Namespace: `/socket/waiter`
**Events:**
- `UPDATE_SCHEDULING_CUTOFFS` — Schedule cutoffs changed

---

## Summary of Route Count

| Category | Admin Routes | Customer Routes |
|----------|-------------|-----------------|
| Auth | 4 | 4 |
| Menu | 15 | 7 |
| Orders/Receipts | 0 | 11 |
| Delivery | 0 | 3 |
| Payment | 0 | 3 |
| Loyalty | 4 | 6 |
| Dashboard/Analytics | 8 | 0 |
| Customer Profiles | 4 | 0 |
| Feedback | 4 | 1 |
| Restaurant | 2 | 3 |
| Foodics | 8 | 0 |
| User | 1 | 8 |
| Schedule | 0 | 2 |
| Notifications | 0 | 2 |
| Wallet | 0 | 6 |
| Other | 2 | 5 |
| **Total** | **~52** | **~61** |
