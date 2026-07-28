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
  discount_value numeric not null,
  minimum_purchase numeric,
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
  category_id uuid not null references public.categories(id) on delete cascade,
  marketplace_id uuid not null references public.marketplaces(id) on delete cascade,
  external_id text,
  affiliate_url text not null,
  image_url text not null,
  gallery text[] not null default array[]::text[],
  current_price numeric not null,
  old_price numeric,
  discount_percentage integer,
  installments text,
  installment_value numeric,
  free_shipping boolean not null default false,
  coupon_id uuid references public.coupons(id),
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
  price numeric not null,
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
  updated_at timestamptz not null default now()
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
  created_at timestamptz not null default now()
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
  product_id uuid references public.products(id),
  marketplace_id uuid references public.marketplaces(id),
  referrer text,
  source text,
  medium text,
  campaign text,
  device_type text,
  created_at timestamptz not null default now()
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

create or replace function public.is_admin() returns boolean language sql stable as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

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
create policy "Public select products" on public.products for select using (status = 'active');
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
  and new.created_at is null
);
create policy "Admin full access newsletter subscribers" on public.newsletter_subscribers for all using (public.is_admin()) with check (public.is_admin());

alter table public.profiles enable row level security;
create policy "Self select profiles" on public.profiles for select using (auth.uid() = id);
create policy "Admin select profiles" on public.profiles for select using (public.is_admin());
create policy "Self insert profiles" on public.profiles for insert with check (
  auth.uid() = new.id
  and new.role = 'user'
);
create policy "Admin insert profiles" on public.profiles for insert with check (public.is_admin());
create policy "Self update profiles" on public.profiles for update using (auth.uid() = id) with check (
  auth.uid() = new.id
  and new.role = 'user'
);
create policy "Admin update profiles" on public.profiles for update using (public.is_admin()) with check (public.is_admin());
create policy "Admin delete profiles" on public.profiles for delete using (public.is_admin());

alter table public.clicks enable row level security;
create policy "Allow insert clicks" on public.clicks for insert with check (
  auth.role() in ('anon', 'authenticated')
  and new.created_at is null
  and (new.product_id is not null or new.marketplace_id is not null)
);
create policy "Admin select clicks" on public.clicks for select using (public.is_admin());
create policy "Admin modify clicks" on public.clicks for all using (public.is_admin()) with check (public.is_admin());
