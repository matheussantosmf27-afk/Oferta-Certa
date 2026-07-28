-- Initial Supabase schema for Oferta Certa
-- This migration creates the public schema objects required by the application.

create extension if not exists "pgcrypto";

create type public.product_status as enum ('draft', 'active', 'inactive', 'expired');
create type public.coupon_discount_type as enum ('percent', 'amount');
create type public.coupon_status as enum ('active', 'expired', 'scheduled');
create type public.article_status as enum ('draft', 'active');
create type public.profile_role as enum ('user', 'admin');
create type public.promotion_status as enum ('draft', 'active', 'expired');

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  icon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.marketplaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  logo text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text not null,
  marketplace text not null,
  discount_type coupon_discount_type not null,
  discount_value numeric not null check (discount_value > 0),
  minimum_purchase numeric check (minimum_purchase >= 0),
  valid_until timestamptz not null,
  status coupon_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text not null,
  description text not null,
  brand text not null,
  category_id uuid not null references public.categories(id) on delete restrict,
  marketplace_id uuid not null references public.marketplaces(id) on delete restrict,
  external_id text,
  affiliate_url text not null,
  image_url text not null,
  gallery text[] not null default array[]::text[],
  current_price numeric not null check (current_price >= 0),
  old_price numeric check (old_price >= 0),
  discount_percentage integer check (discount_percentage >= 0 and discount_percentage <= 100),
  installments text,
  installment_value numeric check (installment_value >= 0),
  free_shipping boolean not null default false,
  coupon_id uuid references public.coupons(id) on delete set null,
  status product_status not null default 'draft',
  featured boolean not null default false,
  trending boolean not null default false,
  best_value boolean not null default false,
  flash_deal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_price_update timestamptz not null default now()
);

create table public.product_price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  price numeric not null check (price >= 0),
  recorded_at timestamptz not null default now()
);

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  summary text not null,
  content text not null,
  image_url text,
  author text not null,
  category text,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  seo_title text,
  meta_description text,
  status article_status not null default 'draft'
);

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  marketplace_id uuid references public.marketplaces(id) on delete set null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default true,
  status promotion_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotions_dates_check check (ends_at is null or ends_at >= starts_at)
);

create table public.banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image_url text,
  call_to_action text,
  href text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  value jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now(),
  constraint newsletter_subscribers_email_check check (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role profile_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clicks (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  marketplace_id uuid references public.marketplaces(id) on delete set null,
  referrer text,
  source text,
  medium text,
  campaign text,
  device_type text,
  created_at timestamptz not null default now(),
  constraint clicks_product_or_marketplace_check check (product_id is not null or marketplace_id is not null)
);

create index products_category_id_idx on public.products (category_id);
create index products_marketplace_id_idx on public.products (marketplace_id);
create index product_price_history_product_id_idx on public.product_price_history (product_id);
create index articles_published_at_idx on public.articles (published_at);
create index promotions_marketplace_id_idx on public.promotions (marketplace_id);
create index banners_active_idx on public.banners (active);
create index clicks_product_id_idx on public.clicks (product_id);
create index clicks_marketplace_id_idx on public.clicks (marketplace_id);
create index clicks_created_at_idx on public.clicks (created_at);

create or replace function public.set_timestamps()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
  else
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.set_created_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.set_profile_id()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.id := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.protect_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and old.role <> new.role and not public.is_admin() then
    raise exception 'Role can only be changed by an administrator';
  end if;
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

create or replace function public.get_public_products(p_product_id uuid default null)
returns table (
  id uuid,
  name text,
  slug text,
  short_description text,
  description text,
  brand text,
  category_id uuid,
  marketplace_id uuid,
  external_id text,
  image_url text,
  gallery text[],
  current_price numeric,
  old_price numeric,
  discount_percentage integer,
  installments text,
  installment_value numeric,
  free_shipping boolean,
  coupon_id uuid,
  status product_status,
  featured boolean,
  trending boolean,
  best_value boolean,
  flash_deal boolean,
  created_at timestamptz,
  updated_at timestamptz,
  last_price_update timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    id,
    name,
    slug,
    short_description,
    description,
    brand,
    category_id,
    marketplace_id,
    external_id,
    image_url,
    gallery,
    current_price,
    old_price,
    discount_percentage,
    installments,
    installment_value,
    free_shipping,
    coupon_id,
    status,
    featured,
    trending,
    best_value,
    flash_deal,
    created_at,
    updated_at,
    last_price_update
  from public.products
  where status = 'active'
    and (p_product_id is null or id = p_product_id);
$$;

grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.get_public_products(uuid) to authenticated, anon;

create trigger set_timestamps_categories
  before insert or update on public.categories
  for each row execute function public.set_timestamps();
create trigger set_timestamps_marketplaces
  before insert or update on public.marketplaces
  for each row execute function public.set_timestamps();
create trigger set_timestamps_coupons
  before insert or update on public.coupons
  for each row execute function public.set_timestamps();
create trigger set_timestamps_products
  before insert or update on public.products
  for each row execute function public.set_timestamps();
create trigger set_timestamps_articles
  before insert or update on public.articles
  for each row execute function public.set_timestamps();
create trigger set_timestamps_promotions
  before insert or update on public.promotions
  for each row execute function public.set_timestamps();
create trigger set_timestamps_banners
  before insert or update on public.banners
  for each row execute function public.set_timestamps();
create trigger set_timestamps_settings
  before insert or update on public.settings
  for each row execute function public.set_timestamps();
create trigger set_timestamps_profiles
  before insert or update on public.profiles
  for each row execute function public.set_timestamps();
create trigger set_created_at_newsletter_subscribers
  before insert on public.newsletter_subscribers
  for each row execute function public.set_created_at();
create trigger set_created_at_clicks
  before insert on public.clicks
  for each row execute function public.set_created_at();
create trigger set_profile_id_before_insert
  before insert on public.profiles
  for each row execute function public.set_profile_id();
create trigger protect_profile_role_change
  before update on public.profiles
  for each row execute function public.protect_profile_role_change();

alter table public.categories enable row level security;
create policy "Public select categories" on public.categories for select using (true);
create policy "Admin full access categories" on public.categories for all using (public.is_admin()) with check (public.is_admin());

alter table public.marketplaces enable row level security;
create policy "Public select marketplaces" on public.marketplaces for select using (true);
create policy "Admin full access marketplaces" on public.marketplaces for all using (public.is_admin()) with check (public.is_admin());

alter table public.coupons enable row level security;
create policy "Public select coupons" on public.coupons for select using (status = 'active' and valid_until >= now());
create policy "Admin full access coupons" on public.coupons for all using (public.is_admin()) with check (public.is_admin());

alter table public.products enable row level security;
create policy "Admin full access products" on public.products for all using (public.is_admin()) with check (public.is_admin());

alter table public.product_price_history enable row level security;
create policy "Admin full access product_price_history" on public.product_price_history for all using (public.is_admin()) with check (public.is_admin());

alter table public.articles enable row level security;
create policy "Public select articles" on public.articles for select using (status = 'active');
create policy "Admin full access articles" on public.articles for all using (public.is_admin()) with check (public.is_admin());

alter table public.promotions enable row level security;
create policy "Public select promotions" on public.promotions for select using (
  active
  and starts_at <= now()
  and (ends_at is null or ends_at >= now())
  and status = 'active'
);
create policy "Admin full access promotions" on public.promotions for all using (public.is_admin()) with check (public.is_admin());

alter table public.banners enable row level security;
create policy "Public select banners" on public.banners for select using (active = true);
create policy "Admin full access banners" on public.banners for all using (public.is_admin()) with check (public.is_admin());

alter table public.settings enable row level security;
create policy "Public select settings" on public.settings for select using (true);
create policy "Admin full access settings" on public.settings for all using (public.is_admin()) with check (public.is_admin());

alter table public.newsletter_subscribers enable row level security;
create policy "Allow insert newsletter subscribers" on public.newsletter_subscribers for insert with check (
  auth.role() in ('anon', 'authenticated')
  and email is not null
  and email <> ''
  and email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
);
create policy "Admin full access newsletter subscribers" on public.newsletter_subscribers for all using (public.is_admin()) with check (public.is_admin());

alter table public.profiles enable row level security;
create policy "Self select profiles" on public.profiles for select using (auth.uid() = id);
create policy "Admin select profiles" on public.profiles for select using (public.is_admin());
create policy "Self insert profiles" on public.profiles for insert with check (
  auth.role() = 'authenticated'
  and auth.uid() = id
  and role = 'user'
  and email is not null
  and email <> ''
);
create policy "Admin insert profiles" on public.profiles for insert with check (public.is_admin());
create policy "Self update profiles" on public.profiles for update using (auth.uid() = id) with check (
  auth.uid() = id
  and role = 'user'
  and email is not null
  and email <> ''
);
create policy "Admin update profiles" on public.profiles for update using (public.is_admin()) with check (public.is_admin());
create policy "Admin delete profiles" on public.profiles for delete using (public.is_admin());

alter table public.clicks enable row level security;
create policy "Admin full access clicks" on public.clicks for all using (public.is_admin()) with check (public.is_admin());
