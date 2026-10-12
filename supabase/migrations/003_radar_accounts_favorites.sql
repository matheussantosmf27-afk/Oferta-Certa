-- 003: contas de clientes, favoritos, Radar de Ofertas e fluxo de publicação

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
create extension if not exists unaccent with schema extensions;

------------------------------------------------------------------------------
-- Utilitário: slug a partir de texto
------------------------------------------------------------------------------
create or replace function public.slugify(p_text text)
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select trim(both '-' from regexp_replace(lower(extensions.unaccent(coalesce(p_text, ''))), '[^a-z0-9]+', '-', 'g'));
$$;

------------------------------------------------------------------------------
-- Perfis: nome, preferência de comunicação e criação automática no cadastro
------------------------------------------------------------------------------
alter table public.profiles
  add column if not exists full_name text,
  add column if not exists marketing_opt_in boolean not null default false;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, email)
select u.id, u.email from auth.users u
where u.email is not null
on conflict (id) do nothing;

------------------------------------------------------------------------------
-- Marketplaces: domínios aceitos para links de afiliado
------------------------------------------------------------------------------
alter table public.marketplaces
  add column if not exists affiliate_hosts text[] not null default array[]::text[];

------------------------------------------------------------------------------
-- Produtos: campos opcionais, origem e deduplicação
------------------------------------------------------------------------------
alter table public.products
  alter column short_description set default '',
  alter column description set default '',
  alter column brand set default '';

alter table public.products
  add column if not exists source_url text,
  add column if not exists rating numeric check (rating is null or (rating >= 0 and rating <= 5)),
  add column if not exists reviews_count integer check (reviews_count is null or reviews_count >= 0);

alter table public.products
  drop constraint if exists products_marketplace_external_id_key;
alter table public.products
  add constraint products_marketplace_external_id_key unique (marketplace_id, external_id);

create index if not exists products_status_idx on public.products (status);

------------------------------------------------------------------------------
-- Catálogo público (sem affiliate_url)
------------------------------------------------------------------------------
drop function if exists public.get_public_products(uuid);

create function public.get_public_products(p_product_id uuid default null)
returns table (
  id uuid,
  name text,
  slug text,
  short_description text,
  description text,
  brand text,
  category_id uuid,
  category_slug text,
  category_name text,
  marketplace_id uuid,
  marketplace_slug text,
  marketplace_name text,
  image_url text,
  gallery text[],
  current_price numeric,
  old_price numeric,
  discount_percentage integer,
  installments text,
  installment_value numeric,
  free_shipping boolean,
  rating numeric,
  reviews_count integer,
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
    p.id, p.name, p.slug, p.short_description, p.description, p.brand,
    c.id, c.slug, c.name,
    m.id, m.slug, m.name,
    p.image_url, p.gallery, p.current_price, p.old_price,
    case
      when p.old_price is not null and p.old_price > p.current_price and p.old_price > 0
        then round(((p.old_price - p.current_price) / p.old_price) * 100)::integer
      else null
    end,
    p.installments, p.installment_value, p.free_shipping, p.rating, p.reviews_count,
    p.featured, p.trending, p.best_value, p.flash_deal,
    p.created_at, p.updated_at, p.last_price_update
  from public.products p
  join public.categories c on c.id = p.category_id
  join public.marketplaces m on m.id = p.marketplace_id
  where p.status = 'active'
    and coalesce(p.affiliate_url, '') <> ''
    and (p_product_id is null or p.id = p_product_id);
$$;

revoke execute on function public.get_public_products(uuid) from public;
grant execute on function public.get_public_products(uuid) to anon, authenticated;

-- Resolve o link de compra de UM produto ativo (usado pela rota /go/[id] no servidor).
create or replace function public.get_product_redirect(p_product_id uuid)
returns table (id uuid, marketplace_id uuid, affiliate_url text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.marketplace_id, p.affiliate_url
  from public.products p
  where p.id = p_product_id
    and p.status = 'active'
    and coalesce(p.affiliate_url, '') <> '';
$$;

revoke execute on function public.get_product_redirect(uuid) from public;
grant execute on function public.get_product_redirect(uuid) to anon, authenticated;

------------------------------------------------------------------------------
-- Favoritos por usuário
------------------------------------------------------------------------------
create table if not exists public.favorites (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

alter table public.favorites enable row level security;
create policy "Self select favorites" on public.favorites for select to authenticated using (auth.uid() = user_id);
create policy "Self insert favorites" on public.favorites for insert to authenticated with check (auth.uid() = user_id);
create policy "Self delete favorites" on public.favorites for delete to authenticated using (auth.uid() = user_id);

------------------------------------------------------------------------------
-- Radar de Ofertas
------------------------------------------------------------------------------
do $$ begin
  create type public.candidate_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.candidate_products (
  id uuid primary key default gen_random_uuid(),
  marketplace_id uuid not null references public.marketplaces(id) on delete restrict,
  external_id text not null,
  title text not null,
  permalink text not null,
  image_url text,
  price numeric not null check (price >= 0),
  original_price numeric check (original_price is null or original_price >= 0),
  currency text not null default 'BRL',
  free_shipping boolean not null default false,
  rating numeric check (rating is null or (rating >= 0 and rating <= 5)),
  reviews_count integer check (reviews_count is null or reviews_count >= 0),
  sold_quantity integer,
  condition text,
  brand text,
  search_term text,
  suggested_category_id uuid references public.categories(id) on delete set null,
  score numeric not null default 0,
  score_breakdown jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  status public.candidate_status not null default 'pending',
  affiliate_url text,
  product_id uuid references public.products(id) on delete set null,
  rejection_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  raw jsonb,
  times_seen integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint candidate_products_marketplace_external_key unique (marketplace_id, external_id)
);

create index if not exists candidate_products_status_score_idx on public.candidate_products (status, score desc);
create index if not exists candidate_products_first_seen_idx on public.candidate_products (first_seen_at);

create trigger set_timestamps_candidate_products
  before insert or update on public.candidate_products
  for each row execute function public.set_timestamps();

alter table public.candidate_products enable row level security;
create policy "Admin full access candidate_products" on public.candidate_products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.radar_search_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  category_id uuid references public.categories(id) on delete set null,
  max_results integer not null default 30 check (max_results between 1 and 50),
  active boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_timestamps_radar_search_terms
  before insert or update on public.radar_search_terms
  for each row execute function public.set_timestamps();

alter table public.radar_search_terms enable row level security;
create policy "Admin full access radar_search_terms" on public.radar_search_terms
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.radar_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null default 'schedule',
  status text not null default 'running' check (status in ('running', 'success', 'partial', 'error')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  terms_count integer not null default 0,
  fetched_count integer not null default 0,
  upserted_count integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  message text
);

-- No máximo uma execução em andamento por vez.
create unique index if not exists radar_runs_single_running_idx on public.radar_runs ((true)) where status = 'running';
create index if not exists radar_runs_started_at_idx on public.radar_runs (started_at desc);

alter table public.radar_runs enable row level security;
create policy "Admin select radar_runs" on public.radar_runs
  for select to authenticated using (public.is_admin());

-- Abre uma execução; devolve null se já houver outra em andamento.
create or replace function public.radar_begin_run(p_trigger text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  update public.radar_runs
     set status = 'error', finished_at = now(), message = 'Tempo esgotado (execução abandonada)'
   where status = 'running' and started_at < now() - interval '20 minutes';

  insert into public.radar_runs (trigger) values (coalesce(p_trigger, 'schedule'))
  on conflict do nothing
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.radar_begin_run(text) from public, anon, authenticated;
grant execute on function public.radar_begin_run(text) to service_role;

------------------------------------------------------------------------------
-- Publicação de um candidato (aprovação com link de afiliado)
------------------------------------------------------------------------------
create or replace function public.publish_candidate(
  p_candidate_id uuid,
  p_affiliate_url text,
  p_category_id uuid,
  p_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.candidate_products%rowtype;
  m public.marketplaces%rowtype;
  v_url text := trim(coalesce(p_affiliate_url, ''));
  v_host text;
  v_name text;
  v_product_id uuid;
  v_old_price numeric;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem publicar produtos' using errcode = '42501';
  end if;

  select * into c from public.candidate_products where id = p_candidate_id for update;
  if not found then
    raise exception 'Candidato não encontrado';
  end if;
  if c.is_demo then
    raise exception 'Candidatos de demonstração não podem ser publicados';
  end if;
  if c.status = 'rejected' then
    raise exception 'Candidato rejeitado não pode ser publicado';
  end if;

  if v_url !~* '^https://[^\s/]+(/\S*)?$' then
    raise exception 'O link de afiliado precisa ser uma URL https válida';
  end if;
  if v_url = c.permalink then
    raise exception 'O link informado é o link original do produto, não um link de afiliado';
  end if;

  select * into m from public.marketplaces where id = c.marketplace_id;
  v_host := lower(substring(v_url from '^https://([^/:?#]+)'));
  if coalesce(array_length(m.affiliate_hosts, 1), 0) > 0 and not exists (
    select 1 from unnest(m.affiliate_hosts) h
    where v_host = lower(h) or v_host like '%.' || lower(h)
  ) then
    raise exception 'O domínio % não está na lista de domínios de afiliado de %', v_host, m.name;
  end if;

  if not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'Categoria inválida';
  end if;

  v_name := coalesce(nullif(trim(p_name), ''), c.title);

  -- Preço anterior só é usado quando é maior que o atual (nunca inventa desconto).
  v_old_price := case when c.original_price is not null and c.original_price > c.price then c.original_price else null end;

  insert into public.products (
    name, slug, short_description, description, brand, category_id, marketplace_id,
    external_id, affiliate_url, source_url, image_url, current_price, old_price,
    free_shipping, rating, reviews_count, status, last_price_update
  ) values (
    v_name,
    left(public.slugify(v_name), 80) || '-' || left(replace(gen_random_uuid()::text, '-', ''), 6),
    '', '', coalesce(c.brand, ''), p_category_id, c.marketplace_id,
    c.external_id, v_url, c.permalink, coalesce(c.image_url, ''), c.price, v_old_price,
    c.free_shipping, c.rating, c.reviews_count, 'active', now()
  )
  on conflict (marketplace_id, external_id) do update set
    name = excluded.name,
    category_id = excluded.category_id,
    affiliate_url = excluded.affiliate_url,
    source_url = excluded.source_url,
    image_url = excluded.image_url,
    current_price = excluded.current_price,
    old_price = excluded.old_price,
    free_shipping = excluded.free_shipping,
    rating = excluded.rating,
    reviews_count = excluded.reviews_count,
    status = 'active',
    last_price_update = now()
  returning id into v_product_id;

  insert into public.product_price_history (product_id, price) values (v_product_id, c.price);

  update public.candidate_products
     set status = 'approved',
         affiliate_url = v_url,
         product_id = v_product_id,
         suggested_category_id = p_category_id,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         rejection_reason = null
   where id = c.id;

  return v_product_id;
end;
$$;

revoke execute on function public.publish_candidate(uuid, text, uuid, text) from public, anon;
grant execute on function public.publish_candidate(uuid, text, uuid, text) to authenticated;

------------------------------------------------------------------------------
-- Dados estruturais (sem produtos fictícios)
------------------------------------------------------------------------------
insert into public.marketplaces (slug, name, active, affiliate_hosts) values
  ('mercado-livre', 'Mercado Livre', true, array['mercadolivre.com', 'mercadolivre.com.br', 'mercadolibre.com', 'meli.la'])
on conflict (slug) do update set affiliate_hosts = excluded.affiliate_hosts;

insert into public.categories (slug, name, description, icon) values
  ('celulares', 'Celulares', 'Smartphones e acessórios.', '📱'),
  ('informatica', 'Informática', 'Notebooks, periféricos e componentes.', '💻'),
  ('tv-e-audio', 'TV e Áudio', 'Smart TVs, fones e caixas de som.', '📺'),
  ('casa', 'Casa', 'Utilidades e organização para a casa.', '🏠'),
  ('eletrodomesticos', 'Eletrodomésticos', 'Cozinha, limpeza e climatização.', '🔌'),
  ('games', 'Games', 'Consoles, jogos e acessórios.', '🎮'),
  ('ferramentas', 'Ferramentas', 'Ferramentas elétricas e manuais.', '🛠️'),
  ('automotivo', 'Automotivo', 'Acessórios e cuidados para o carro.', '🚗'),
  ('beleza', 'Beleza', 'Cuidados pessoais e perfumaria.', '💄'),
  ('esportes', 'Esportes', 'Fitness, bicicletas e esportes.', '⚽')
on conflict (slug) do nothing;

insert into public.radar_search_terms (term, category_id, max_results)
select t.term, c.id, 30
from (values
  ('smartphone', 'celulares'),
  ('notebook', 'informatica'),
  ('ssd', 'informatica'),
  ('smart tv', 'tv-e-audio'),
  ('fone bluetooth', 'tv-e-audio'),
  ('air fryer', 'eletrodomesticos'),
  ('aspirador robo', 'eletrodomesticos'),
  ('controle ps5', 'games'),
  ('furadeira', 'ferramentas'),
  ('perfume', 'beleza')
) as t(term, category_slug)
join public.categories c on c.slug = t.category_slug
on conflict (term) do nothing;
