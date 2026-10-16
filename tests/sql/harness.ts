// Banco Postgres em memória (PGlite) com o mínimo do esquema do Supabase, para rodar as funções
// SQL reais das migrations nos testes. Nada aqui toca o banco de produção.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'

const MIGRATIONS = join(__dirname, '..', '..', 'supabase', 'migrations')

export function migration(file: string): string {
  return readFileSync(join(MIGRATIONS, file), 'utf8')
}

/** Trecho de uma migration: da linha que começa com `start` até o primeiro `$$;` seguinte. */
export function migrationFunction(file: string, start: string): string {
  const sql = migration(file)
  const from = sql.indexOf(start)
  if (from < 0) throw new Error(`Trecho não encontrado em ${file}: ${start}`)
  const to = sql.indexOf('$$;', from)
  return sql.slice(from, to + 3)
}

// Esquema mínimo, equivalente ao de produção nos pontos usados pelas funções testadas.
const BASE_SCHEMA = `
create schema extensions;
create extension unaccent with schema extensions;
create extension pg_trgm with schema extensions;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema auth, public to anon, authenticated, service_role;

create type public.product_status as enum ('draft', 'active', 'inactive', 'expired');
create table public.profiles (id uuid primary key, role text not null default 'user');
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') $$;

create table public.categories (id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null,
  description text, icon text, ml_category_id text, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.marketplaces (id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null,
  affiliate_hosts text[] default '{}', price_max_age_days integer, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.ml_categories (id text primary key, name text not null, path text[] not null, path_names text[] not null, fetched_at timestamptz default now());
create table public.ml_category_map (ml_category_id text primary key, category_id uuid references public.categories(id) on delete cascade,
  note text, created_at timestamptz default now(), updated_at timestamptz default now());

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text not null unique, short_description text not null default '', description text not null default '',
  brand text not null default '', category_id uuid not null references public.categories(id), marketplace_id uuid not null references public.marketplaces(id),
  external_id text, affiliate_url text not null default '', image_url text not null default '', gallery text[] not null default '{}',
  current_price numeric not null, old_price numeric, discount_percentage integer, installments text, installment_value numeric,
  free_shipping boolean not null default false, status public.product_status not null default 'active',
  featured boolean not null default false, trending boolean not null default false, best_value boolean not null default false, flash_deal boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), last_price_update timestamptz not null default now(),
  rating numeric, reviews_count integer, specs jsonb not null default '[]', features text[] not null default '{}',
  publish_mode text not null default 'manual', published_at timestamptz, published_run_id uuid, offer_checked_at timestamptz,
  market_offers integer, market_max numeric, market_checked_at timestamptz,
  unique (marketplace_id, external_id)
);
create table public.product_price_history (id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  price numeric not null, recorded_at timestamptz not null default now(), source text not null default 'coleta');
create table public.candidate_products (id uuid primary key default gen_random_uuid(), marketplace_id uuid not null references public.marketplaces(id),
  external_id text not null, title text not null default '', raw jsonb, product_id uuid references public.products(id), status text not null default 'pending',
  unique (marketplace_id, external_id));
`

export interface TestDb {
  db: PGlite
  q: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>
}

/** Cria o banco com o esquema mínimo e aplica as funções/migrations informadas. */
export async function createTestDb(extraSql: string[] = []): Promise<TestDb> {
  const db = new PGlite({ extensions: { pg_trgm, unaccent } })
  await db.exec(BASE_SCHEMA)
  for (const sql of extraSql) await db.exec(sql)
  const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows
  return { db, q }
}
