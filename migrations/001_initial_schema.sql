-- =============================================================================
-- Prepit / Eatcrumbs — Initial Schema
-- =============================================================================
-- Run against a Supabase project with service-role credentials.
-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =============================================================================
-- ORGANISATIONS (top-level grouping of restaurants, optional)
-- =============================================================================
create table if not exists organizations (
  id          serial primary key,
  name        text not null,
  created_at  timestamptz not null default now()
);

-- =============================================================================
-- RESTAURANTS
-- =============================================================================
create table if not exists restaurants (
  id                  serial primary key,
  organization_id     int references organizations(id) on delete set null,
  name                text not null,
  name_arabic         text,
  background_img      text,
  logo_url            text,
  preferred_country   text not null default 'EG',
  is_foodics          boolean not null default false,
  main_franchise_id   int,                         -- FK added after franchises
  config              jsonb not null default '{}',
  menu_version        int not null default 1,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- =============================================================================
-- FRANCHISES (branches)
-- =============================================================================
create table if not exists franchises (
  id            serial primary key,
  restaurant_id int not null references restaurants(id) on delete cascade,
  name          text not null,
  name_arabic   text,
  slug          text not null unique,
  address       text,
  lat           numeric(10,7),
  lng           numeric(10,7),
  phone         text,
  is_online     boolean not null default true,
  busy_mode     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Add deferred FK now that franchises table exists
alter table restaurants
  add constraint fk_main_franchise
  foreign key (main_franchise_id) references franchises(id) on delete set null
  deferrable initially deferred;

-- =============================================================================
-- ADMINS
-- =============================================================================
create type admin_role as enum ('owner', 'manager', 'staff');

create table if not exists admins (
  id                      serial primary key,
  restaurant_id           int not null references restaurants(id) on delete cascade,
  email                   text not null unique,
  password_hash           text not null,
  role                    admin_role not null default 'staff',
  is_active               boolean not null default true,
  reset_token             text,
  reset_token_expires_at  timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- =============================================================================
-- CUSTOMERS
-- =============================================================================
create table if not exists customers (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   int not null references restaurants(id) on delete cascade,
  phone_number    text not null,
  person_name     text,
  email           text,
  is_visitor      boolean not null default false,
  referral_code   text unique,
  referred_by     uuid references customers(id) on delete set null,
  points          int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (restaurant_id, phone_number)
);

-- =============================================================================
-- DELIVERY ADDRESSES
-- =============================================================================
create table if not exists delivery_addresses (
  id              serial primary key,
  customer_id     uuid not null references customers(id) on delete cascade,
  restaurant_id   int not null references restaurants(id) on delete cascade,
  label           text,
  address_line    text not null,
  area            text,
  lat             numeric(10,7),
  lng             numeric(10,7),
  is_default      boolean not null default false,
  created_at      timestamptz not null default now()
);

-- =============================================================================
-- CATEGORIES
-- =============================================================================
create table if not exists categories (
  id              serial primary key,
  restaurant_id   int not null references restaurants(id) on delete cascade,
  name            text not null,
  name_arabic     text,
  image_url       text,
  sort_order      int not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- =============================================================================
-- CATEGORY TIME AVAILABILITY
-- =============================================================================
create table if not exists category_time_availability (
  id            serial primary key,
  category_id   int not null references categories(id) on delete cascade,
  day_of_week   int not null check (day_of_week between 0 and 6),  -- 0=Sun
  start_time    time not null,
  end_time      time not null
);

-- =============================================================================
-- ITEMS
-- =============================================================================
create table if not exists items (
  id              serial primary key,
  restaurant_id   int not null references restaurants(id) on delete cascade,
  category_id     int not null references categories(id) on delete cascade,
  parent_item_id  int references items(id) on delete cascade,  -- sub-items
  name            text not null,
  name_arabic     text,
  description     text,
  description_arabic text,
  price           numeric(10,2) not null default 0,
  image_url       text,
  sort_order      int not null default 0,
  is_active       boolean not null default true,
  is_top_product  boolean not null default false,
  calories        int,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- =============================================================================
-- ITEM TIME AVAILABILITY
-- =============================================================================
create table if not exists item_time_availability (
  id          serial primary key,
  item_id     int not null references items(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time  time not null,
  end_time    time not null
);

-- =============================================================================
-- ADDON GROUPS
-- =============================================================================
create table if not exists addon_groups (
  id            serial primary key,
  restaurant_id int not null references restaurants(id) on delete cascade,
  item_id       int not null references items(id) on delete cascade,
  name          text not null,
  name_arabic   text,
  is_required   boolean not null default false,
  min_select    int not null default 0,
  max_select    int not null default 1,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- =============================================================================
-- ADDON VALUES
-- =============================================================================
create table if not exists addon_values (
  id            serial primary key,
  addon_group_id int not null references addon_groups(id) on delete cascade,
  restaurant_id  int not null references restaurants(id) on delete cascade,
  name           text not null,
  name_arabic    text,
  price          numeric(10,2) not null default 0,
  is_active      boolean not null default true,
  sort_order     int not null default 0
);

-- =============================================================================
-- SCHEDULE SLOTS (franchise open/close schedule)
-- =============================================================================
create table if not exists schedule_slots (
  id            serial primary key,
  franchise_id  int not null references franchises(id) on delete cascade,
  day_of_week   int not null check (day_of_week between 0 and 6),
  open_time     time not null,
  close_time    time not null
);

-- =============================================================================
-- PROMO CODES
-- =============================================================================
create type promo_type as enum ('percentage', 'fixed', 'free_delivery');

create table if not exists promo_codes (
  id              serial primary key,
  restaurant_id   int not null references restaurants(id) on delete cascade,
  code            text not null,
  promo_type      promo_type not null default 'fixed',
  value           numeric(10,2) not null default 0,
  min_order       numeric(10,2) not null default 0,
  max_uses        int,
  uses_count      int not null default 0,
  per_customer    int not null default 1,
  is_active       boolean not null default true,
  expires_at      timestamptz,
  created_at      timestamptz not null default now(),
  unique (restaurant_id, code)
);

-- =============================================================================
-- POINTING SYSTEMS (loyalty)
-- =============================================================================
create table if not exists pointing_systems (
  id                      serial primary key,
  restaurant_id           int not null references restaurants(id) on delete cascade unique,
  points_per_unit         numeric(10,4) not null default 1,
  minimum_spend           numeric(10,2) not null default 0,
  redeem_value            numeric(10,2) not null default 1,
  points_required_to_redeem int not null default 100,
  expiry_days             int,
  is_active               boolean not null default true,
  created_at              timestamptz not null default now()
);

-- =============================================================================
-- FRANCHISE PACKAGE OFFERS
-- =============================================================================
create table if not exists franchise_package_offers (
  id            serial primary key,
  franchise_id  int not null references franchises(id) on delete cascade,
  restaurant_id int not null references restaurants(id) on delete cascade,
  name          text not null,
  name_arabic   text,
  price         numeric(10,2) not null,
  image_url     text,
  is_active     boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- =============================================================================
-- RECEIPTS (orders)
-- =============================================================================
create type receipt_state as enum (
  'PENDING',
  'ACCEPTED',
  'READY',
  'ON_WAY_TO_PICKUP',
  'ON_WAY_TO_DELIVERY',
  'DELIVERED',
  'CANCELLED'
);

create type order_type as enum ('DELIVERY', 'TAKE_OUT', 'DINE_IN', 'DELIVERYV2');
create type payment_method as enum ('cash', 'online_card', 'card_on_delivery', 'pos', 'none');

create table if not exists receipts (
  id                uuid primary key default uuid_generate_v4(),
  restaurant_id     int not null references restaurants(id) on delete restrict,
  franchise_id      int not null references franchises(id) on delete restrict,
  customer_id       uuid references customers(id) on delete set null,
  order_number      int not null,                -- sequential per franchise per day
  state             receipt_state not null default 'PENDING',
  order_type        order_type not null,
  payment_method    payment_method not null default 'cash',
  subtotal          numeric(10,2) not null,
  delivery_fee      numeric(10,2) not null default 0,
  discount          numeric(10,2) not null default 0,
  total             numeric(10,2) not null,
  notes             text,
  address_snapshot  jsonb,                        -- delivery address at order time
  points_earned     int not null default 0,
  points_redeemed   int not null default 0,
  promo_code        text,
  promo_discount    numeric(10,2) not null default 0,
  paymob_order_id   text,
  paymob_txn_id     text,
  is_paid           boolean not null default false,
  estimated_minutes int,
  table_number      text,
  rider_id          int,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Per-franchise sequential order number (resets are handled at app layer)
create sequence if not exists order_number_seq start 1 increment 1;

-- =============================================================================
-- RECEIPT ITEMS
-- =============================================================================
create table if not exists receipt_items (
  id            serial primary key,
  receipt_id    uuid not null references receipts(id) on delete cascade,
  item_id       int references items(id) on delete set null,
  name          text not null,    -- snapshot at order time
  name_arabic   text,
  price         numeric(10,2) not null,
  quantity      int not null default 1,
  addons        jsonb not null default '[]',   -- [{name, price, qty}]
  notes         text
);

-- =============================================================================
-- LOYALTY TRANSACTIONS
-- =============================================================================
create type loyalty_tx_type as enum ('earn', 'redeem', 'expire', 'adjust');

create table if not exists loyalty_transactions (
  id            serial primary key,
  customer_id   uuid not null references customers(id) on delete cascade,
  restaurant_id int not null references restaurants(id) on delete cascade,
  receipt_id    uuid references receipts(id) on delete set null,
  type          loyalty_tx_type not null,
  points        int not null,      -- positive = earned, negative = redeemed/expired
  balance_after int not null,
  created_at    timestamptz not null default now()
);

-- =============================================================================
-- REFERRALS
-- =============================================================================
create table if not exists referrals (
  id              serial primary key,
  referrer_id     uuid not null references customers(id) on delete cascade,
  referred_id     uuid not null references customers(id) on delete cascade,
  restaurant_id   int not null references restaurants(id) on delete cascade,
  points_awarded  int not null default 0,
  created_at      timestamptz not null default now(),
  unique (referrer_id, referred_id)
);

-- =============================================================================
-- FEEDBACK
-- =============================================================================
create table if not exists feedback (
  id            serial primary key,
  restaurant_id int not null references restaurants(id) on delete cascade,
  franchise_id  int references franchises(id) on delete set null,
  customer_id   uuid references customers(id) on delete set null,
  receipt_id    uuid references receipts(id) on delete set null,
  rating        int not null check (rating between 1 and 5),
  comment       text,
  is_read       boolean not null default false,
  created_at    timestamptz not null default now()
);

-- =============================================================================
-- NOTIFICATIONS (in-app / push)
-- =============================================================================
create table if not exists notifications (
  id            serial primary key,
  restaurant_id int not null references restaurants(id) on delete cascade,
  customer_id   uuid references customers(id) on delete cascade,
  title         text not null,
  body          text,
  is_read       boolean not null default false,
  created_at    timestamptz not null default now()
);

-- =============================================================================
-- ADMIN ANALYTICS
-- =============================================================================
create table if not exists admin_analytics (
  id            serial primary key,
  restaurant_id int not null references restaurants(id) on delete cascade,
  admin_id      int references admins(id) on delete set null,
  event         text not null,
  created_at    timestamptz not null default now()
);

-- =============================================================================
-- FOODICS CREDENTIALS
-- =============================================================================
create table if not exists foodics_credentials (
  id            serial primary key,
  restaurant_id int not null references restaurants(id) on delete cascade unique,
  access_token  text not null,
  refresh_token text,
  expires_at    timestamptz,
  business_reference text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- =============================================================================
-- FOODICS SYNCS (audit log)
-- =============================================================================
create type foodics_sync_status as enum ('pending', 'running', 'success', 'error');

create table if not exists foodics_syncs (
  id            serial primary key,
  restaurant_id int not null references restaurants(id) on delete cascade,
  status        foodics_sync_status not null default 'pending',
  started_at    timestamptz,
  finished_at   timestamptz,
  error         text,
  items_synced  int not null default 0,
  created_at    timestamptz not null default now()
);

-- =============================================================================
-- CUSTOM DOMAINS (Cloudflare provisioning)
-- =============================================================================
create table if not exists custom_domains (
  id              serial primary key,
  restaurant_id   int not null references restaurants(id) on delete cascade,
  domain          text not null unique,
  cloudflare_zone_id text,
  dns_record_id   text,
  is_verified     boolean not null default false,
  verified_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================
create index if not exists idx_franchises_restaurant on franchises(restaurant_id);
create index if not exists idx_admins_restaurant     on admins(restaurant_id);
create index if not exists idx_customers_restaurant  on customers(restaurant_id);
create index if not exists idx_customers_phone       on customers(restaurant_id, phone_number);
create index if not exists idx_categories_restaurant on categories(restaurant_id);
create index if not exists idx_items_category        on items(category_id);
create index if not exists idx_items_restaurant      on items(restaurant_id);
create index if not exists idx_addon_groups_item     on addon_groups(item_id);
create index if not exists idx_receipts_restaurant   on receipts(restaurant_id);
create index if not exists idx_receipts_franchise    on receipts(franchise_id);
create index if not exists idx_receipts_customer     on receipts(customer_id);
create index if not exists idx_receipts_state        on receipts(state);
create index if not exists idx_receipts_created      on receipts(created_at desc);
create index if not exists idx_loyalty_tx_customer   on loyalty_transactions(customer_id);
create index if not exists idx_notifications_customer on notifications(customer_id, is_read);

-- =============================================================================
-- ROW-LEVEL SECURITY
-- =============================================================================
-- We use the service-role key in the backend, which bypasses RLS.
-- RLS is a defence-in-depth layer — it prevents direct SQL or anon-key leakage.

alter table restaurants         enable row level security;
alter table franchises          enable row level security;
alter table admins              enable row level security;
alter table customers           enable row level security;
alter table categories          enable row level security;
alter table items               enable row level security;
alter table addon_groups        enable row level security;
alter table addon_values        enable row level security;
alter table receipts            enable row level security;
alter table receipt_items       enable row level security;
alter table loyalty_transactions enable row level security;
alter table feedback            enable row level security;
alter table notifications       enable row level security;
alter table promo_codes         enable row level security;
alter table pointing_systems    enable row level security;

-- Service role bypasses all RLS — no explicit policy needed for service role.
-- Deny everything to anon and authenticated roles by default:
create policy "deny anon restaurants"    on restaurants    for all to anon using (false);
create policy "deny anon franchises"     on franchises     for all to anon using (false);
create policy "deny anon admins"         on admins         for all to anon using (false);
create policy "deny anon customers"      on customers      for all to anon using (false);
create policy "deny anon categories"     on categories     for all to anon using (false);
create policy "deny anon items"          on items          for all to anon using (false);
create policy "deny anon addon_groups"   on addon_groups   for all to anon using (false);
create policy "deny anon addon_values"   on addon_values   for all to anon using (false);
create policy "deny anon receipts"       on receipts       for all to anon using (false);
create policy "deny anon receipt_items"  on receipt_items  for all to anon using (false);
create policy "deny anon loyalty_tx"     on loyalty_transactions for all to anon using (false);
create policy "deny anon feedback"       on feedback       for all to anon using (false);
create policy "deny anon notifications"  on notifications  for all to anon using (false);
create policy "deny anon promos"         on promo_codes    for all to anon using (false);
create policy "deny anon pointing"       on pointing_systems for all to anon using (false);

-- =============================================================================
-- STORED PROCEDURES — points management
-- =============================================================================

-- award_points: atomically credit points and log the transaction
create or replace function award_points(
  p_customer_id   uuid,
  p_restaurant_id int,
  p_receipt_id    uuid,
  p_points        int
) returns void language plpgsql as $$
declare
  v_balance int;
begin
  update customers
     set points = points + p_points, updated_at = now()
   where id = p_customer_id and restaurant_id = p_restaurant_id
  returning points into v_balance;

  if not found then
    raise exception 'Customer % not found for restaurant %', p_customer_id, p_restaurant_id;
  end if;

  insert into loyalty_transactions
    (customer_id, restaurant_id, receipt_id, type, points, balance_after)
  values
    (p_customer_id, p_restaurant_id, p_receipt_id, 'earn', p_points, v_balance);
end;
$$;

-- redeem_points: debit points; errors if balance insufficient
create or replace function redeem_points(
  p_customer_id   uuid,
  p_restaurant_id int,
  p_receipt_id    uuid,
  p_points        int
) returns void language plpgsql as $$
declare
  v_balance int;
begin
  update customers
     set points = points - p_points, updated_at = now()
   where id = p_customer_id and restaurant_id = p_restaurant_id
     and points >= p_points
  returning points into v_balance;

  if not found then
    raise exception 'Insufficient points or customer not found';
  end if;

  insert into loyalty_transactions
    (customer_id, restaurant_id, receipt_id, type, points, balance_after)
  values
    (p_customer_id, p_restaurant_id, p_receipt_id, 'redeem', -p_points, v_balance);
end;
$$;

-- =============================================================================
-- HELPER FUNCTION — bump menu version
-- =============================================================================
create or replace function bump_menu_version(p_restaurant_id int)
returns void language sql as $$
  update restaurants set menu_version = menu_version + 1, updated_at = now()
   where id = p_restaurant_id;
$$;
