# Database Schema

Derived from API request/response shapes, component state, enum values, and data flows across both frontends.

**Database:** Supabase (PostgreSQL)  
**Auth:** Supabase Auth (custom claims for roles)  
**Storage:** Supabase Storage  
**Realtime:** Supabase Realtime + custom Socket.IO server

---

## Design Principles

1. **Multi-tenancy:** Every table that belongs to a restaurant has a `restaurant_id` foreign key. RLS policies enforce this.
2. **Franchise model:** A `restaurant` is the top-level merchant entity. It has many `franchises` (branches). A customer orders from a `franchise`.
3. **Bilingual:** All user-visible text fields have `_arabic` variants.
4. **Soft deletes:** Use `deleted_at` nullable timestamps rather than hard deletes on key tables (menu items, customers, orders).
5. **UUIDs for customer-facing IDs:** Prevents enumeration attacks on orders and customers.

---

## Tables

---

### `restaurants`

The top-level merchant entity. Owns everything else.

```sql
CREATE TABLE restaurants (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  name_arabic         TEXT,
  logo_url            TEXT,
  background_img      TEXT,
  preferred_country   TEXT NOT NULL DEFAULT 'eg',  -- eg|ca|sa|ae
  is_foodics          BOOLEAN NOT NULL DEFAULT FALSE,
  main_franchise_id   INTEGER,  -- FK to franchises.id, set after franchise created
  menu_version        TEXT NOT NULL DEFAULT '1',   -- bump on every menu change
  config              JSONB NOT NULL DEFAULT '{}', -- feature flags
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- config shape:
-- {
--   "adminMenuManagement": boolean,
--   "currency": "EGP|SAR|CAD",
--   "supportedOrderTypes": ["DELIVERY","TAKE_OUT","DINE_IN"],
--   "pointingEnabled": boolean,
--   "offlineLoyaltyEnabled": boolean,
--   "paymobEnabled": boolean,
--   "paymobIntegrationId": number,
--   "deliveryEnabled": boolean,
--   "schedulingEnabled": boolean,
--   "roboostEnabled": boolean,
--   "tipsEnabled": boolean,
--   "referralEnabled": boolean,
--   "appDownloadEnabled": boolean
-- }
```

---

### `franchises`

A branch of a restaurant. Also called "franchise" in the codebase.

```sql
CREATE TABLE franchises (
  id                  SERIAL PRIMARY KEY,
  restaurant_id       INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  name_arabic         TEXT,
  slug                TEXT NOT NULL UNIQUE,          -- URL-safe identifier
  address             TEXT,
  address_arabic      TEXT,
  lat                 DECIMAL(10, 7),
  lng                 DECIMAL(10, 7),
  phone               TEXT,
  is_online           BOOLEAN NOT NULL DEFAULT TRUE,
  busy_mode           BOOLEAN NOT NULL DEFAULT FALSE,
  is_out_of_operation_till  TIMESTAMPTZ,
  integrated_pos_down BOOLEAN NOT NULL DEFAULT FALSE,
  outside_operating_hours   BOOLEAN NOT NULL DEFAULT FALSE,
  operating_hours     JSONB,                         -- { "mon": [{"open":"09:00","close":"22:00"}], ... }
  delivery_zones      JSONB,                         -- delivery zone config
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX franchises_restaurant_id_idx ON franchises(restaurant_id);
CREATE INDEX franchises_slug_idx ON franchises(slug);
```

---

### `admins`

Merchant dashboard users.

```sql
CREATE TABLE admins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  name            TEXT,
  role            TEXT NOT NULL DEFAULT 'owner',  -- owner|manager|staff
  language        TEXT NOT NULL DEFAULT 'en',      -- en|ar|ar-SA
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  reset_token     TEXT,
  reset_token_expires_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX admins_restaurant_id_idx ON admins(restaurant_id);
CREATE INDEX admins_email_idx ON admins(email);
```

---

### `customers`

End users of the storefront. Identified by phone number per restaurant context.

```sql
CREATE TABLE customers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id       INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  phone_number        TEXT NOT NULL,
  country_code        TEXT NOT NULL DEFAULT '+20',
  name                TEXT,
  email               TEXT,
  title               TEXT,
  short_id            TEXT NOT NULL UNIQUE DEFAULT LEFT(MD5(RANDOM()::TEXT), 8),
  is_mobile_app_user  BOOLEAN NOT NULL DEFAULT FALSE,
  is_partner_app_user BOOLEAN NOT NULL DEFAULT FALSE,
  is_self_service_user BOOLEAN NOT NULL DEFAULT FALSE,
  is_visitor          BOOLEAN NOT NULL DEFAULT FALSE,  -- anonymous session
  points_balance      INTEGER NOT NULL DEFAULT 0,
  total_points_earned INTEGER NOT NULL DEFAULT 0,
  total_points_redeemed INTEGER NOT NULL DEFAULT 0,
  loyalty_enrolled_at TIMESTAMPTZ,
  referral_code       TEXT UNIQUE DEFAULT LEFT(MD5(gen_random_uuid()::TEXT), 10),
  referred_by_id      UUID REFERENCES customers(id),
  notification_prefs  JSONB NOT NULL DEFAULT '{"sms":true,"email":true,"push":true}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX customers_phone_restaurant_idx ON customers(phone_number, restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX customers_restaurant_id_idx ON customers(restaurant_id);
CREATE INDEX customers_short_id_idx ON customers(short_id);
```

---

### `categories`

Menu categories, scoped to a restaurant. Ordered by `sort_order`.

```sql
CREATE TABLE categories (
  id              SERIAL PRIMARY KEY,
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_name   TEXT NOT NULL,
  category_name_arabic TEXT,
  description     TEXT,
  description_arabic TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_visible      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX categories_restaurant_id_idx ON categories(restaurant_id);
```

---

### `category_time_availability`

Time-based show/hide rules per category (e.g., breakfast menu).

```sql
CREATE TABLE category_time_availability (
  id              SERIAL PRIMARY KEY,
  category_id     INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id),
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(category_id)
);
```

---

### `items`

Menu items. Belong to a category and a restaurant.

```sql
CREATE TABLE items (
  id                  SERIAL PRIMARY KEY,
  restaurant_id       INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id         INTEGER NOT NULL REFERENCES categories(id) ON DELETE SET NULL,
  item_name           TEXT NOT NULL,
  item_name_arabic    TEXT,
  description         TEXT,
  description_arabic  TEXT,
  price               DECIMAL(10, 2) NOT NULL DEFAULT 0,
  image               TEXT,                          -- Supabase Storage URL
  images              JSONB NOT NULL DEFAULT '[]',   -- array of image URLs
  is_visible          BOOLEAN NOT NULL DEFAULT TRUE,
  is_available        BOOLEAN NOT NULL DEFAULT TRUE, -- runtime availability
  sort_order          INTEGER NOT NULL DEFAULT 0,
  calories            INTEGER,
  dietary_tags        TEXT[] DEFAULT '{}',           -- vegetarian|vegan|halal|gluten-free
  is_combo            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX items_restaurant_id_idx ON items(restaurant_id);
CREATE INDEX items_category_id_idx ON items(category_id);
```

---

### `item_time_availability`

Time-based availability per item.

```sql
CREATE TABLE item_time_availability (
  id              SERIAL PRIMARY KEY,
  item_id         INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id),
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(item_id)
);
```

---

### `addon_groups`

Modifier groups (e.g., "Choose a size", "Add toppings").

```sql
CREATE TABLE addon_groups (
  id              SERIAL PRIMARY KEY,
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  name_arabic     TEXT,
  required        BOOLEAN NOT NULL DEFAULT FALSE,
  min_select      INTEGER NOT NULL DEFAULT 0,
  max_select      INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX addon_groups_restaurant_id_idx ON addon_groups(restaurant_id);
```

---

### `addon_values`

Individual options within an addon group.

```sql
CREATE TABLE addon_values (
  id              SERIAL PRIMARY KEY,
  addon_group_id  INTEGER NOT NULL REFERENCES addon_groups(id) ON DELETE CASCADE,
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id),
  name            TEXT NOT NULL,
  name_arabic     TEXT,
  price           DECIMAL(10, 2) NOT NULL DEFAULT 0,
  is_available    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX addon_values_addon_group_id_idx ON addon_values(addon_group_id);
```

---

### `item_addon_groups`

Junction: which addon groups belong to which items.

```sql
CREATE TABLE item_addon_groups (
  item_id         INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  addon_group_id  INTEGER NOT NULL REFERENCES addon_groups(id) ON DELETE CASCADE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, addon_group_id)
);
```

---

### `sub_items`

Combo/bundle sub-items (child items of a parent combo item).

```sql
CREATE TABLE sub_items (
  id              SERIAL PRIMARY KEY,
  parent_item_id  INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  child_item_id   INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### `receipts`

Orders placed by customers. Called "receipts" throughout the codebase.

```sql
CREATE TABLE receipts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id),
  franchise_id    INTEGER NOT NULL REFERENCES franchises(id),
  customer_id     UUID REFERENCES customers(id),       -- NULL for guests
  receipt_state   TEXT NOT NULL DEFAULT 'PENDING',
    -- PENDING | ON_WAY_TO_PICKUP | ON_WAY_TO_DELIVERY | DELIVERED | CANCELLED
  order_type      TEXT NOT NULL,
    -- DELIVERY | TAKE_OUT | DINE_IN | DELIVERYV2
  payment_method  TEXT NOT NULL,
    -- cash | online_card | card_on_delivery | pos | none
  payment_status  TEXT NOT NULL DEFAULT 'pending',
    -- pending | completed | failed | refunded
  subtotal        DECIMAL(10, 2) NOT NULL DEFAULT 0,
  delivery_fee    DECIMAL(10, 2) NOT NULL DEFAULT 0,
  tax             DECIMAL(10, 2) NOT NULL DEFAULT 0,
  tip             DECIMAL(10, 2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_amount    DECIMAL(10, 2) NOT NULL DEFAULT 0,
  points_earned   INTEGER NOT NULL DEFAULT 0,
  points_redeemed INTEGER NOT NULL DEFAULT 0,
  promo_code      TEXT,
  receipt_note    TEXT,
  table_number    TEXT,
  delivery_address_snapshot JSONB,  -- snapshot of address at time of order
  scheduled_for   TIMESTAMPTZ,
  schedule_slot_id INTEGER REFERENCES schedule_slots(id),
  paymob_order_id TEXT,             -- Paymob order reference
  paymob_txn_id   TEXT,             -- Paymob transaction ID
  is_pos_receipt  BOOLEAN NOT NULL DEFAULT FALSE,
  device_number   TEXT,             -- for POS kiosk
  source          TEXT NOT NULL DEFAULT 'WEB',
    -- WEB | MOBILE | PARTNER | SELF_SERVICE | MOB_SELF_SERVICE
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX receipts_restaurant_id_idx ON receipts(restaurant_id);
CREATE INDEX receipts_franchise_id_idx ON receipts(franchise_id);
CREATE INDEX receipts_customer_id_idx ON receipts(customer_id);
CREATE INDEX receipts_receipt_state_idx ON receipts(receipt_state);
CREATE INDEX receipts_created_at_idx ON receipts(created_at);
```

---

### `receipt_items`

Line items within an order.

```sql
CREATE TABLE receipt_items (
  id              SERIAL PRIMARY KEY,
  receipt_id      UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  item_id         INTEGER NOT NULL REFERENCES items(id),
  item_name       TEXT NOT NULL,            -- snapshot
  item_name_arabic TEXT,                   -- snapshot
  quantity        INTEGER NOT NULL DEFAULT 1,
  unit_price      DECIMAL(10, 2) NOT NULL,
  total_price     DECIMAL(10, 2) NOT NULL,
  note            TEXT,
  addons_snapshot JSONB NOT NULL DEFAULT '[]',
  -- [{ "addonGroupId": n, "addonGroupName": "...", "addonValueId": n, "name": "...", "price": n }]
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX receipt_items_receipt_id_idx ON receipt_items(receipt_id);
```

---

### `delivery_addresses`

Customer saved delivery addresses.

```sql
CREATE TABLE delivery_addresses (
  id                  SERIAL PRIMARY KEY,
  customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  restaurant_id       INTEGER NOT NULL REFERENCES restaurants(id),
  area                TEXT,
  street_name         TEXT,
  building_number     TEXT,
  floor_number        TEXT,
  apartment_number    TEXT,
  address_title       TEXT,
  additional_details  TEXT,
  lat                 DECIMAL(10, 7),
  lng                 DECIMAL(10, 7),
  delivery_type_id    INTEGER,
  is_default          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX delivery_addresses_customer_id_idx ON delivery_addresses(customer_id);
```

---

### `pointing_systems`

Loyalty points rules per restaurant.

```sql
CREATE TABLE pointing_systems (
  id                      SERIAL PRIMARY KEY,
  restaurant_id           INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  points_per_unit         DECIMAL(10, 4) NOT NULL DEFAULT 1.0,
    -- points earned per currency unit spent
  minimum_spend           DECIMAL(10, 2) NOT NULL DEFAULT 0,
  redeem_value            DECIMAL(10, 2) NOT NULL DEFAULT 1.0,
    -- currency value of each redeemed point
  points_required_to_redeem INTEGER NOT NULL DEFAULT 100,
  expiry_days             INTEGER,     -- NULL = no expiry
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(restaurant_id)   -- one active system per restaurant
);
```

---

### `loyalty_transactions`

Points earn/redeem ledger.

```sql
CREATE TABLE loyalty_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id),
  receipt_id      UUID REFERENCES receipts(id),
  type            TEXT NOT NULL,  -- earn | redeem | expire | adjust
  points          INTEGER NOT NULL,
  description     TEXT,
  campaign_id     INTEGER REFERENCES franchise_package_offers(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX loyalty_transactions_customer_id_idx ON loyalty_transactions(customer_id);
CREATE INDEX loyalty_transactions_restaurant_id_idx ON loyalty_transactions(restaurant_id);
```

---

### `franchise_package_offers`

Flash/welcome rewards and campaigns (Offers tab in admin).

```sql
CREATE TABLE franchise_package_offers (
  id              SERIAL PRIMARY KEY,
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  name_arabic     TEXT,
  offer_type      TEXT NOT NULL,
    -- FIXED_AMOUNT | PERCENTAGE_AMOUNT | FREE_ITEM | DISCOUNT_ITEM
  value           DECIMAL(10, 2) NOT NULL,
  minimum_spend   DECIMAL(10, 2),
  cap             INTEGER,                 -- max redemptions
  redemption_count INTEGER NOT NULL DEFAULT 0,
  start_date      TIMESTAMPTZ NOT NULL,
  end_date        TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'SCHEDULED',
    -- LIVE | SCHEDULED | END_SOON | ENDED
  order_types     TEXT[] NOT NULL DEFAULT '{}',
  branch_ids      INTEGER[] NOT NULL DEFAULT '{}',   -- empty = all branches
  free_item_id    INTEGER REFERENCES items(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX franchise_package_offers_restaurant_id_idx ON franchise_package_offers(restaurant_id);
```

---

### `loyalty_calibrations`

AI campaign calibration settings per restaurant.

```sql
CREATE TABLE loyalty_calibrations (
  id              SERIAL PRIMARY KEY,
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  config          JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(restaurant_id)
);
```

---

### `feedback`

Customer reviews/ratings per order.

```sql
CREATE TABLE feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id),
  franchise_id    INTEGER REFERENCES franchises(id),
  customer_id     UUID REFERENCES customers(id),
  receipt_id      UUID REFERENCES receipts(id),
  number_of_stars INTEGER NOT NULL CHECK (number_of_stars BETWEEN 1 AND 5),
  feedback_text   TEXT,
  feedback_tags   TEXT[] DEFAULT '{}',
    -- SERVICE | APP | QUALITY | ORDER | WAITER
  feedback_tags_text TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX feedback_restaurant_id_idx ON feedback(restaurant_id);
CREATE INDEX feedback_receipt_id_idx ON feedback(receipt_id);
```

---

### `promo_codes`

Promotional discount codes.

```sql
CREATE TABLE promo_codes (
  id              SERIAL PRIMARY KEY,
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  discount_type   TEXT NOT NULL,   -- PERCENTAGE | FIXED_AMOUNT | FREE_DELIVERY
  discount_value  DECIMAL(10, 2) NOT NULL,
  minimum_spend   DECIMAL(10, 2),
  max_uses        INTEGER,
  uses_count      INTEGER NOT NULL DEFAULT 0,
  per_customer_limit INTEGER,
  valid_from      TIMESTAMPTZ,
  valid_until     TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(code, restaurant_id)
);
```

---

### `schedule_slots`

Pre-defined time slots for scheduled orders.

```sql
CREATE TABLE schedule_slots (
  id              SERIAL PRIMARY KEY,
  franchise_id    INTEGER NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id),
  label           TEXT NOT NULL,
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ NOT NULL,
  max_orders      INTEGER,
  current_orders  INTEGER NOT NULL DEFAULT 0,
  is_available    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX schedule_slots_franchise_id_idx ON schedule_slots(franchise_id);
```

---

### `delivery_zones`

Delivery zone definitions per franchise.

```sql
CREATE TABLE delivery_zones (
  id              SERIAL PRIMARY KEY,
  franchise_id    INTEGER NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id),
  name            TEXT NOT NULL,
  name_arabic     TEXT,
  delivery_fee    DECIMAL(10, 2) NOT NULL DEFAULT 0,
  min_order       DECIMAL(10, 2),
  estimated_time  INTEGER,         -- minutes
  polygon         JSONB,           -- GeoJSON polygon coordinates
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### `notifications`

In-app notifications for customers.

```sql
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id),
  type            TEXT NOT NULL,   -- order_update | offer | loyalty | system
  title           TEXT NOT NULL,
  title_arabic    TEXT,
  body            TEXT,
  body_arabic     TEXT,
  data            JSONB,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  channel         TEXT NOT NULL DEFAULT 'push',  -- push | sms | email | whatsapp
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX notifications_customer_id_idx ON notifications(customer_id);
```

---

### `referrals`

Referral program tracking.

```sql
CREATE TABLE referrals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id),
  referrer_id     UUID NOT NULL REFERENCES customers(id),
  referred_id     UUID NOT NULL REFERENCES customers(id),
  bonus_points    INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | rewarded | expired
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(referred_id, restaurant_id)
);
```

---

### `organizations`

B2B partner organizations that customers can belong to.

```sql
CREATE TABLE organizations (
  id              SERIAL PRIMARY KEY,
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id),
  name            TEXT NOT NULL,
  name_arabic     TEXT,
  slug            TEXT NOT NULL,
  email_domain    TEXT,    -- auto-enroll by email domain
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(slug, restaurant_id)
);
```

---

### `organization_customers`

Customers linked to B2B organizations.

```sql
CREATE TABLE organization_customers (
  id              SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  email           TEXT,
  is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, customer_id)
);
```

---

### `link_tracking`

Marketing link tracking.

```sql
CREATE TABLE link_tracking (
  id              SERIAL PRIMARY KEY,
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id),
  reference_name  TEXT NOT NULL,
  customer_id     UUID REFERENCES customers(id),
  receipt_id      UUID REFERENCES receipts(id),
  event_type      TEXT NOT NULL,  -- visit | receipt
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### `foodics_syncs`

Foodics integration sync history.

```sql
CREATE TABLE foodics_syncs (
  id                    SERIAL PRIMARY KEY,
  restaurant_id         INTEGER NOT NULL REFERENCES restaurants(id),
  sync_type             TEXT NOT NULL,  -- MENU | SETTINGS | FULL
  status                TEXT NOT NULL,  -- pending | running | success | failed
  last_menu_sync_at     TIMESTAMPTZ,
  last_settings_sync_at TIMESTAMPTZ,
  last_menu_sync_success_at TIMESTAMPTZ,
  last_settings_sync_success_at TIMESTAMPTZ,
  error_message         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX foodics_syncs_restaurant_id_idx ON foodics_syncs(restaurant_id);
```

---

### `foodics_credentials`

Foodics OAuth tokens per restaurant.

```sql
CREATE TABLE foodics_credentials (
  id              SERIAL PRIMARY KEY,
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE UNIQUE,
  access_token    TEXT NOT NULL,
  refresh_token   TEXT,
  expires_at      TIMESTAMPTZ,
  business_id     TEXT,
  app_type        TEXT NOT NULL DEFAULT 'ordering',  -- ordering | loyalty
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### `admin_analytics`

Admin UI interaction tracking.

```sql
CREATE TABLE admin_analytics (
  id              SERIAL PRIMARY KEY,
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id),
  admin_id        UUID REFERENCES admins(id),
  event           TEXT NOT NULL,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### `customer_analytics`

Customer UI interaction tracking.

```sql
CREATE TABLE customer_analytics (
  id              SERIAL PRIMARY KEY,
  restaurant_id   INTEGER REFERENCES restaurants(id),
  franchise_id    INTEGER REFERENCES franchises(id),
  customer_id     UUID REFERENCES customers(id),
  event           TEXT NOT NULL,
  extra_info      JSONB,
  franchise_slug  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### `client_alerts`

Client-side error logs forwarded to backend.

```sql
CREATE TABLE client_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID REFERENCES customers(id),
  restaurant_id   INTEGER REFERENCES restaurants(id),
  text            TEXT NOT NULL,
  data            JSONB,
  severity        TEXT NOT NULL DEFAULT 'LOW',  -- LOW | MEDIUM | HIGH
  print_only      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Indexes Summary

```sql
-- Performance indexes on frequent query patterns
CREATE INDEX receipts_franchise_created_idx ON receipts(franchise_id, created_at DESC);
CREATE INDEX receipts_customer_restaurant_idx ON receipts(customer_id, restaurant_id);
CREATE INDEX loyalty_transactions_customer_created_idx ON loyalty_transactions(customer_id, created_at DESC);
CREATE INDEX items_category_visible_idx ON items(category_id, is_visible) WHERE deleted_at IS NULL;
CREATE INDEX feedback_restaurant_created_idx ON feedback(restaurant_id, created_at DESC);
CREATE INDEX customers_loyalty_restaurant_idx ON customers(restaurant_id, loyalty_enrolled_at) WHERE loyalty_enrolled_at IS NOT NULL;
```

---

## Row Level Security (RLS) Policies

Supabase RLS policies enforce multi-tenant isolation at the database layer. The application layer ALSO enforces this (double protection).

```sql
-- Enable RLS on all tables
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE franchises ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
-- ... (all tables)

-- Admins can only access their own restaurant's data
-- JWT claim: { "restaurant_id": number, "role": "admin" }

CREATE POLICY "admins_own_restaurant" ON restaurants
  FOR ALL USING (id = (current_setting('request.jwt.claims', true)::json->>'restaurant_id')::integer);

CREATE POLICY "admins_own_franchises" ON franchises
  FOR ALL USING (restaurant_id = (current_setting('request.jwt.claims', true)::json->>'restaurant_id')::integer);

-- Customers can only access their own data
-- JWT claim: { "customer_id": uuid, "restaurant_id": number }

CREATE POLICY "customers_own_profile" ON customers
  FOR SELECT USING (id = (current_setting('request.jwt.claims', true)::json->>'customer_id')::uuid);

CREATE POLICY "customers_own_receipts" ON receipts
  FOR SELECT USING (customer_id = (current_setting('request.jwt.claims', true)::json->>'customer_id')::uuid);

CREATE POLICY "customers_own_addresses" ON delivery_addresses
  FOR ALL USING (customer_id = (current_setting('request.jwt.claims', true)::json->>'customer_id')::uuid);

-- Public read on menu data
CREATE POLICY "public_read_categories" ON categories
  FOR SELECT USING (is_visible = true AND deleted_at IS NULL);

CREATE POLICY "public_read_items" ON items
  FOR SELECT USING (is_visible = true AND deleted_at IS NULL);

CREATE POLICY "public_read_addon_groups" ON addon_groups
  FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "public_read_addon_values" ON addon_values
  FOR SELECT USING (is_available = true);
```

---

## Enumerations Reference

These are stored as `TEXT` with application-level validation (Zod).

```
receipt_state:   PENDING | ON_WAY_TO_PICKUP | ON_WAY_TO_DELIVERY | DELIVERED | CANCELLED
order_type:      DELIVERY | TAKE_OUT | DINE_IN | DELIVERYV2
payment_method:  cash | online_card | card_on_delivery | pos | none
payment_status:  pending | completed | failed | refunded
offer_type:      FIXED_AMOUNT | PERCENTAGE_AMOUNT | FREE_ITEM | DISCOUNT_ITEM
offer_status:    LIVE | SCHEDULED | END_SOON | ENDED
time_interval:   TODAY | YESTERDAY | THIS_WEEK | LAST_WEEK | THIS_MONTH | LAST_MONTH |
                 LAST_YEAR | THIS_YEAR | PREVIOUS_30_DAYS | SPECIFIC_RANGE | ALL
feedback_tags:   SERVICE | APP | QUALITY | ORDER | WAITER
country:         eg | ca | sa | ae
order_source:    WEB | MOBILE | PARTNER | SELF_SERVICE | MOB_SELF_SERVICE | VISITOR_SELF_SERVICE
admin_role:      owner | manager | staff
loyalty_type:    earn | redeem | expire | adjust
```

---

## Key Data Flow Notes

1. **Menu version cache-busting:** `restaurants.menu_version` is bumped on every menu change. The customer app passes it as a query param to `GET /category/details/{id}?menuVersion=X` and checks response status 304 for caching.

2. **Customer identity:** A customer exists per `(phone_number, restaurant_id)`. The same phone number at two different restaurants is two separate customer records.

3. **Receipt state machine:**
   ```
   PENDING → ON_WAY_TO_PICKUP (takeout/self-service accepted)
   PENDING → ON_WAY_TO_DELIVERY (delivery dispatched)
   ON_WAY_TO_DELIVERY → DELIVERED
   ON_WAY_TO_PICKUP → DELIVERED
   * → CANCELLED (by merchant or customer)
   ```

4. **Points calculation:** Points = `floor(order_total * pointing_systems.points_per_unit)` applied only when `order_total >= pointing_systems.minimum_spend`.

5. **Franchise vs Restaurant:** `restaurant` is the brand, `franchise` is the physical branch. Customers order from a `franchise`. Analytics can be filtered per-restaurant (all branches) or per-franchise (specific branch).
