-- Supabase schema for Oferta Certa

create extension if not exists "uuid-ossp";

create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists marketplaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  logo text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists coupons (
  id uuid primary key default uuid_generate_v4(),
  code text not null,
  title text not null,
  description text not null,
  marketplace text not null,
  discount_type text not null,
  discount_value numeric not null,
  minimum_purchase numeric,
  valid_until timestamptz not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  short_description text not null,
  description text not null,
  brand text not null,
  category_id uuid not null references categories(id) on delete cascade,
  marketplace_id uuid not null references marketplaces(id) on delete cascade,
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
  coupon_id uuid references coupons(id),
  status text not null default 'draft',
  featured boolean not null default false,
  trending boolean not null default false,
  best_value boolean not null default false,
  flash_deal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_price_update timestamptz not null default now()
);

create table if not exists clicks (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references products(id),
  marketplace_id uuid references marketplaces(id),
  referrer text,
  source text,
  medium text,
  campaign text,
  device_type text,
  session_id text,
  created_at timestamptz not null default now()
);

create table if not exists articles (
  id uuid primary key default uuid_generate_v4(),
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
  status text not null default 'draft'
);

create table if not exists product_price_history (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  price numeric not null,
  recorded_at timestamptz not null default now()
);

create table if not exists newsletter_subscribers (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists banners (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  subtitle text,
  image_url text,
  call_to_action text,
  href text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists settings (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
