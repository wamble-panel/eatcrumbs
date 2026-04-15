-- =============================================================================
-- RLS Gap Fix — enable RLS and deny anon on tables missed in 001
-- =============================================================================
-- All backend access uses the service-role key (bypasses RLS).
-- These policies block direct anon/authenticated key access as defence-in-depth.

-- organizations (low-sensitivity, but consistent)
alter table organizations             enable row level security;
create policy "deny anon organizations"        on organizations             for all to anon using (false);
create policy "deny auth organizations"        on organizations             for all to authenticated using (false);

-- delivery_addresses (customer PII — high sensitivity)
alter table delivery_addresses        enable row level security;
create policy "deny anon delivery_addresses"   on delivery_addresses        for all to anon using (false);
create policy "deny auth delivery_addresses"   on delivery_addresses        for all to authenticated using (false);

-- category_time_availability
alter table category_time_availability enable row level security;
create policy "deny anon cat_time"             on category_time_availability for all to anon using (false);
create policy "deny auth cat_time"             on category_time_availability for all to authenticated using (false);

-- item_time_availability
alter table item_time_availability    enable row level security;
create policy "deny anon item_time"            on item_time_availability    for all to anon using (false);
create policy "deny auth item_time"            on item_time_availability    for all to authenticated using (false);

-- schedule_slots
alter table schedule_slots            enable row level security;
create policy "deny anon schedule_slots"       on schedule_slots            for all to anon using (false);
create policy "deny auth schedule_slots"       on schedule_slots            for all to authenticated using (false);

-- franchise_package_offers
alter table franchise_package_offers  enable row level security;
create policy "deny anon franchise_packages"   on franchise_package_offers  for all to anon using (false);
create policy "deny auth franchise_packages"   on franchise_package_offers  for all to authenticated using (false);

-- referrals (customer relationship data)
alter table referrals                 enable row level security;
create policy "deny anon referrals"            on referrals                 for all to anon using (false);
create policy "deny auth referrals"            on referrals                 for all to authenticated using (false);

-- admin_analytics
alter table admin_analytics           enable row level security;
create policy "deny anon admin_analytics"      on admin_analytics           for all to anon using (false);
create policy "deny auth admin_analytics"      on admin_analytics           for all to authenticated using (false);

-- foodics_credentials (OAuth tokens — very sensitive)
alter table foodics_credentials       enable row level security;
create policy "deny anon foodics_credentials"  on foodics_credentials       for all to anon using (false);
create policy "deny auth foodics_credentials"  on foodics_credentials       for all to authenticated using (false);

-- foodics_syncs
alter table foodics_syncs             enable row level security;
create policy "deny anon foodics_syncs"        on foodics_syncs             for all to anon using (false);
create policy "deny auth foodics_syncs"        on foodics_syncs             for all to authenticated using (false);

-- custom_domains (domain configuration)
alter table custom_domains            enable row level security;
create policy "deny anon custom_domains"       on custom_domains            for all to anon using (false);
create policy "deny auth custom_domains"       on custom_domains            for all to authenticated using (false);

-- receipts needs an authenticated SELECT policy for Supabase Realtime.
-- The anon deny policy from 001 blocks direct data access; this policy
-- allows the Realtime service (which runs as 'authenticated') to read
-- rows so it can broadcast change events to subscribers.
-- IMPORTANT: Realtime subscribers must still validate ownership client-side.
create policy "realtime receipts select" on receipts
  for select to authenticated using (true);
