-- M1 foundation: transactional data model, least-privilege grants, RLS, and storage.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create type public.staff_role as enum ('manager', 'orders_manager', 'inventory_manager');
create type public.product_status as enum ('draft', 'published', 'archived');
create type public.order_status as enum ('new', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled', 'returned');
create type public.cod_status as enum ('uncollected', 'collected', 'not_due');
create type public.coupon_type as enum ('percent', 'fixed_minor');
create type public.quiz_status as enum ('draft', 'published', 'retired');
create type public.quiz_question_kind as enum ('preference', 'budget', 'exclusions');

create function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text check (phone is null or char_length(phone) <= 32),
  preferred_locale text not null default 'ar' check (preferred_locale in ('ar', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role public.staff_role not null,
  active boolean not null default true,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function private.has_staff_role(allowed public.staff_role[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_roles sr
    where sr.user_id = (select auth.uid()) and sr.active and sr.role = any(allowed)
  );
$$;
revoke all on function private.has_staff_role(public.staff_role[]) from public, anon;
grant execute on function private.has_staff_role(public.staff_role[]) to authenticated;

create function private.create_profile_for_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120));
  return new;
end;
$$;
revoke all on function private.create_profile_for_new_user() from public, anon, authenticated;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.create_profile_for_new_user();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_ar text not null,
  name_en text not null,
  description_ar text not null default '',
  description_en text not null default '',
  active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  brand text not null,
  name_ar text not null,
  name_en text not null,
  short_description_ar text not null default '',
  short_description_en text not null default '',
  description_ar text not null default '',
  description_en text not null default '',
  category_id uuid references public.categories(id) on delete restrict,
  gender text not null default 'unisex',
  family text not null default '',
  seasons text[] not null default '{}',
  occasions text[] not null default '{}',
  day_night text not null default 'any',
  concentration text not null default '',
  longevity_hours_min numeric(4,1),
  longevity_hours_max numeric(4,1),
  projection smallint check (projection between 1 and 5),
  status public.product_status not null default 'draft',
  featured boolean not null default false,
  recommendation_enabled boolean not null default false,
  priority integer not null default 0,
  seo_title_ar text not null default '',
  seo_title_en text not null default '',
  seo_description_ar text not null default '',
  seo_description_en text not null default '',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (longevity_hours_min is null or longevity_hours_min >= 0),
  check (longevity_hours_max is null or longevity_hours_max >= longevity_hours_min),
  check (status <> 'published' or (brand <> '' and name_ar <> '' and name_en <> ''))
);
create index products_status_category_idx on public.products(status, category_id);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  sku text not null unique,
  size_ml numeric(7,2) not null check (size_ml > 0),
  price_minor bigint not null check (price_minor >= 0),
  compare_at_minor bigint check (compare_at_minor is null or compare_at_minor >= price_minor),
  stock_available integer not null default 0 check (stock_available >= 0),
  low_stock_threshold integer not null default 2 check (low_stock_threshold >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_variants_product_active_idx on public.product_variants(product_id, active);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  storage_path text not null unique,
  alt_ar text not null default '',
  alt_en text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_sort_idx on public.product_images(product_id, sort_order);

create table public.fragrance_notes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_ar text not null,
  name_en text not null,
  created_at timestamptz not null default now()
);
create table public.product_notes (
  product_id uuid not null references public.products(id) on delete restrict,
  note_id uuid not null references public.fragrance_notes(id) on delete restrict,
  layer text not null check (layer in ('top', 'heart', 'base')),
  primary key (product_id, note_id, layer)
);
create index product_notes_note_idx on public.product_notes(note_id, product_id);

create table public.product_attributes (
  product_id uuid primary key references public.products(id) on delete restrict,
  vector jsonb not null,
  profile_version integer not null default 1 check (profile_version > 0),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(vector) = 'object')
);

create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.cart_items (
  cart_id uuid not null references public.carts(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity smallint not null check (quantity between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (cart_id, variant_id)
);
create index cart_items_variant_idx on public.cart_items(variant_id);

create table public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_ar text not null,
  name_en text not null,
  fee_minor bigint not null check (fee_minor >= 0),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code_normalized text not null unique check (code_normalized = upper(code_normalized)),
  type public.coupon_type not null,
  value integer not null check (value > 0),
  max_discount_minor bigint check (max_discount_minor is null or max_discount_minor > 0),
  min_subtotal_minor bigint not null default 0 check (min_subtotal_minor >= 0),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  total_limit integer check (total_limit is null or total_limit > 0),
  per_customer_limit integer check (per_customer_limit is null or per_customer_limit > 0),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < expires_at),
  check ((type = 'percent' and value between 1 and 100) or type = 'fixed_minor')
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  public_number text not null unique,
  user_id uuid not null references public.profiles(id) on delete restrict,
  status public.order_status not null default 'new',
  cod_status public.cod_status not null default 'uncollected',
  payment_method text not null default 'cod' check (payment_method = 'cod'),
  recipient_name text not null,
  phone text not null,
  address_snapshot jsonb not null,
  shipping_zone_id uuid not null references public.shipping_zones(id) on delete restrict,
  currency_code text not null default 'IQD' check (currency_code ~ '^[A-Z]{3}$'),
  currency_exponent smallint not null default 3 check (currency_exponent between 0 and 6),
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  shipping_minor bigint not null check (shipping_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  coupon_id uuid references public.coupons(id) on delete restrict,
  coupon_snapshot jsonb,
  notes text not null default '' check (char_length(notes) <= 1000),
  idempotency_key text not null,
  request_hash text not null,
  version integer not null default 1 check (version > 0),
  collected_at timestamptz,
  collected_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  check (total_minor = subtotal_minor - discount_minor + shipping_minor),
  check (discount_minor <= subtotal_minor),
  check (jsonb_typeof(address_snapshot) = 'object')
);
create index orders_user_created_idx on public.orders(user_id, created_at desc);
create index orders_status_created_idx on public.orders(status, created_at);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  name_ar_snapshot text not null,
  name_en_snapshot text not null,
  sku_snapshot text not null,
  size_ml_snapshot numeric(7,2) not null,
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  quantity smallint not null check (quantity between 1 and 10),
  line_total_minor bigint not null,
  created_at timestamptz not null default now(),
  check (line_total_minor = unit_price_minor * quantity)
);
create index order_items_order_idx on public.order_items(order_id);
create index order_items_variant_idx on public.order_items(variant_id);
create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  order_id uuid not null unique references public.orders(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  state text not null check (state in ('used', 'released')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coupon_redemptions_coupon_user_state_idx on public.coupon_redemptions(coupon_id, user_id, state);
create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  from_status public.order_status,
  to_status public.order_status not null,
  actor_id uuid references public.profiles(id) on delete set null,
  reason text not null default '',
  created_at timestamptz not null default now()
);
create index order_status_history_order_created_idx on public.order_status_history(order_id, created_at);
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('initial', 'order_reserve', 'cancel_release', 'return_restock', 'manual_adjustment')),
  order_id uuid references public.orders(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  event_key text not null unique,
  created_at timestamptz not null default now()
);
create index inventory_movements_variant_created_idx on public.inventory_movements(variant_id, created_at desc);

create table public.quiz_versions (
  id uuid primary key default gen_random_uuid(),
  version_number integer not null unique check (version_number > 0),
  status public.quiz_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index one_published_quiz_version on public.quiz_versions(status) where status = 'published';
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_version_id uuid not null references public.quiz_versions(id) on delete restrict,
  key text not null,
  title_ar text not null,
  title_en text not null,
  hint_ar text not null default '',
  hint_en text not null default '',
  kind public.quiz_question_kind not null,
  required boolean not null default false,
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (quiz_version_id, key)
);
create table public.quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions(id) on delete restrict,
  label_ar text not null,
  label_en text not null,
  image_path text,
  target_vector jsonb not null default '{}',
  dimension_weights jsonb not null default '{}',
  filter_payload jsonb not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(target_vector) = 'object'),
  check (jsonb_typeof(dimension_weights) = 'object'),
  check (jsonb_typeof(filter_payload) = 'object')
);
create index quiz_options_question_sort_idx on public.quiz_options(question_id, sort_order);
create table public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  anonymous_token_hash text unique,
  quiz_version_id uuid not null references public.quiz_versions(id) on delete restrict,
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((user_id is not null) <> (anonymous_token_hash is not null))
);
create index quiz_sessions_user_created_idx on public.quiz_sessions(user_id, created_at desc);
create table public.quiz_answers (
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete restrict,
  option_id uuid not null references public.quiz_options(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (session_id, question_id)
);
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.quiz_sessions(id) on delete restrict,
  profile_snapshot jsonb not null,
  algorithm_version text not null,
  catalog_snapshot_hash text not null,
  locale text not null check (locale in ('ar', 'en')),
  explanation_source text not null check (explanation_source in ('gemini', 'fallback')),
  explanation_status text not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table public.recommendation_items (
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  rank smallint not null check (rank between 1 and 3),
  score numeric(5,2) not null check (score between 0 and 100),
  product_profile_snapshot jsonb not null,
  explanation text,
  primary key (recommendation_id, product_id),
  unique (recommendation_id, rank)
);

create table private.store_settings (
  id boolean primary key default true check (id),
  store_name_ar text not null default 'Maison Sillage',
  store_name_en text not null default 'Maison Sillage',
  logo_path text,
  hero_image_path text,
  accent_color text not null default '#b68b54',
  contact_phone text,
  default_locale text not null default 'ar' check (default_locale in ('ar', 'en')),
  currency_code text not null default 'IQD',
  currency_exponent smallint not null default 3 check (currency_exponent between 0 and 6),
  timezone text not null default 'Asia/Baghdad',
  updated_at timestamptz not null default now()
);
insert into private.store_settings(id) values (true);
create table private.telegram_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  chat_id text,
  include_customer_details boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into private.telegram_settings(id) values (true);
create table private.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  event_type text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts smallint not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  telegram_message_id text,
  last_error_code text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_id, event_type)
);
create index notification_outbox_due_idx on private.notification_outbox(status, next_attempt_at);
create table private.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  safe_metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  check (jsonb_typeof(safe_metadata) = 'object')
);
create index audit_logs_entity_created_idx on private.audit_logs(entity_type, entity_id, created_at desc);
create table private.rate_limit_buckets (
  bucket_key text not null,
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  expires_at timestamptz not null,
  primary key (bucket_key, window_start)
);
create index rate_limit_buckets_expiry_idx on private.rate_limit_buckets(expires_at);

-- No client receives table-wide access by default. Expose only safe catalog fields.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated;
grant select on public.categories, public.products, public.product_images, public.fragrance_notes, public.product_notes to anon, authenticated;
grant select (id, product_id, size_ml, price_minor, compare_at_minor, active, created_at, updated_at) on public.product_variants to anon, authenticated;
grant select, update (full_name, phone, preferred_locale) on public.profiles to authenticated;
grant select on public.staff_roles to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select, insert, update, delete on public.carts, public.cart_items to authenticated;
grant select on public.orders, public.order_items, public.order_status_history, public.coupon_redemptions to authenticated;
grant select on public.shipping_zones to anon, authenticated;
grant select on public.quiz_versions, public.quiz_questions, public.quiz_options to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.staff_roles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.fragrance_notes enable row level security;
alter table public.product_notes enable row level security;
alter table public.product_attributes enable row level security;
alter table public.favorites enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.shipping_zones enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.order_status_history enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.quiz_versions enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_options enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.recommendations enable row level security;
alter table public.recommendation_items enable row level security;
alter table private.store_settings enable row level security;
alter table private.telegram_settings enable row level security;
alter table private.notification_outbox enable row level security;
alter table private.audit_logs enable row level security;
alter table private.rate_limit_buckets enable row level security;

create policy profiles_read_self on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_self on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy staff_roles_read_self on public.staff_roles for select to authenticated using ((select auth.uid()) = user_id);
create policy categories_read_active on public.categories for select to anon, authenticated using (active);
create policy products_read_published on public.products for select to anon, authenticated using (status = 'published');
create policy variants_read_active_published on public.product_variants for select to anon, authenticated using (active and exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));
create policy images_read_published on public.product_images for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));
create policy notes_read on public.fragrance_notes for select to anon, authenticated using (true);
create policy product_notes_read_published on public.product_notes for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));
create policy favorites_owner_read on public.favorites for select to authenticated using ((select auth.uid()) = user_id);
create policy favorites_owner_insert on public.favorites for insert to authenticated with check ((select auth.uid()) = user_id);
create policy favorites_owner_delete on public.favorites for delete to authenticated using ((select auth.uid()) = user_id);
create policy carts_owner_read on public.carts for select to authenticated using ((select auth.uid()) = user_id);
create policy carts_owner_insert on public.carts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy carts_owner_update on public.carts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy cart_items_owner_read on public.cart_items for select to authenticated using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())));
create policy cart_items_owner_insert on public.cart_items for insert to authenticated with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())));
create policy cart_items_owner_update on public.cart_items for update to authenticated using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid()))) with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())));
create policy cart_items_owner_delete on public.cart_items for delete to authenticated using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())));
create policy shipping_zones_read_active on public.shipping_zones for select to anon, authenticated using (active);
create policy orders_owner_read on public.orders for select to authenticated using ((select auth.uid()) = user_id);
create policy order_items_owner_read on public.order_items for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())));
create policy order_history_owner_read on public.order_status_history for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())));
create policy redemption_owner_read on public.coupon_redemptions for select to authenticated using ((select auth.uid()) = user_id);
create policy quiz_versions_read_current on public.quiz_versions for select to anon, authenticated using (status = 'published');
create policy quiz_questions_read_current on public.quiz_questions for select to anon, authenticated using (enabled and exists (select 1 from public.quiz_versions qv where qv.id = quiz_version_id and qv.status = 'published'));
create policy quiz_options_read_current on public.quiz_options for select to anon, authenticated using (exists (select 1 from public.quiz_questions qq join public.quiz_versions qv on qv.id = qq.quiz_version_id where qq.id = question_id and qq.enabled and qv.status = 'published'));
create policy quiz_sessions_owner_read on public.quiz_sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy quiz_sessions_owner_insert on public.quiz_sessions for insert to authenticated with check ((select auth.uid()) = user_id and anonymous_token_hash is null);
create policy quiz_answers_owner_read on public.quiz_answers for select to authenticated using (exists (select 1 from public.quiz_sessions qs where qs.id = session_id and qs.user_id = (select auth.uid())));
create policy recommendations_owner_read on public.recommendations for select to authenticated using (exists (select 1 from public.quiz_sessions qs where qs.id = session_id and qs.user_id = (select auth.uid())));
create policy recommendation_items_owner_read on public.recommendation_items for select to authenticated using (exists (select 1 from public.recommendations r join public.quiz_sessions qs on qs.id = r.session_id where r.id = recommendation_id and qs.user_id = (select auth.uid())));

-- Storage serves published product images publicly; uploads require an active staff role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
       ('catalog-images', 'catalog-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy catalog_images_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'catalog-images');
create policy product_images_staff_read on storage.objects for select to authenticated using (bucket_id = 'product-images' and private.has_staff_role(array['manager', 'inventory_manager']::public.staff_role[]));
create policy product_images_staff_upload on storage.objects for insert to authenticated with check (bucket_id in ('product-images', 'catalog-images') and private.has_staff_role(array['manager', 'inventory_manager']::public.staff_role[]));
create policy product_images_staff_update on storage.objects for update to authenticated using (bucket_id in ('product-images', 'catalog-images') and private.has_staff_role(array['manager', 'inventory_manager']::public.staff_role[])) with check (bucket_id in ('product-images', 'catalog-images') and private.has_staff_role(array['manager', 'inventory_manager']::public.staff_role[]));
create policy product_images_staff_delete on storage.objects for delete to authenticated using (bucket_id in ('product-images', 'catalog-images') and private.has_staff_role(array['manager', 'inventory_manager']::public.staff_role[]));

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger staff_roles_set_updated_at before update on public.staff_roles for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger variants_set_updated_at before update on public.product_variants for each row execute function public.set_updated_at();
create trigger carts_set_updated_at before update on public.carts for each row execute function public.set_updated_at();
create trigger cart_items_set_updated_at before update on public.cart_items for each row execute function public.set_updated_at();
create trigger shipping_zones_set_updated_at before update on public.shipping_zones for each row execute function public.set_updated_at();
create trigger coupons_set_updated_at before update on public.coupons for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger quiz_versions_set_updated_at before update on public.quiz_versions for each row execute function public.set_updated_at();
create trigger coupon_redemptions_set_updated_at before update on public.coupon_redemptions for each row execute function public.set_updated_at();
