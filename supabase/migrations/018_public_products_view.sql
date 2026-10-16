-- 018: vitrine rápida. A função get_public_products montava a lista inteira de produtos e só depois o
-- PostgREST aplicava filtro/ordem/limite: com ~2.500 produtos cada chamada levava ~230 ms e, com várias
-- chamadas simultâneas (build da Vercel, pré-carregamento de links), o banco estourava o tempo limite.
-- A view abaixo é "aberta" pelo planejador: filtros como slug=..., categoria, ordem e limite usam índices.
-- Expõe só as colunas públicas (mesmas da função); produtos inativos ou sem link não aparecem.
-- Sem DROP de dados.

create or replace view public.public_products as
select
  p.id, p.name, p.slug, p.short_description, p.description, p.brand,
  c.id as category_id, c.slug as category_slug, c.name as category_name,
  m.id as marketplace_id, m.slug as marketplace_slug, m.name as marketplace_name,
  p.image_url, p.gallery, p.current_price,
  case when d.pct is not null then p.old_price end as old_price,
  d.pct as discount_percentage,
  p.installments, p.installment_value, p.free_shipping, p.rating, p.reviews_count,
  p.featured, p.trending, p.best_value, p.flash_deal,
  p.created_at, p.updated_at, p.last_price_update
from public.products p
join public.categories c on c.id = p.category_id
join public.marketplaces m on m.id = p.marketplace_id
cross join lateral (
  -- Mesmo critério de product_trusted_discount (016): só desconto confirmado/compatível e calculado
  -- sobre o preço atual.
  select case
    when p.discount_status in ('confirmado', 'compativel')
     and p.discount_status_price = p.current_price
     and p.discount_status_old is not distinct from p.old_price
     and p.old_price > p.current_price and p.current_price > 0
    then round(((p.old_price - p.current_price) / p.old_price) * 100)::integer
  end as pct
) d
where p.status = 'active'
  and coalesce(p.affiliate_url, '') <> '';

comment on view public.public_products is
  'Vitrine pública: produtos ativos com link, sem colunas administrativas; desconto só quando corroborado.';

revoke all on public.public_products from public, anon, authenticated;
grant select on public.public_products to anon, authenticated;

-- Índices para as consultas da vitrine (só produtos ativos).
create index if not exists products_active_recent_idx on public.products (last_price_update desc) where status = 'active';
create index if not exists products_active_category_idx on public.products (category_id, last_price_update desc) where status = 'active';
create index if not exists products_active_featured_idx on public.products (last_price_update desc) where status = 'active' and featured;

-- A função antiga passa a ler a view (mesma assinatura e resultado, para quem ainda a chama).
create or replace function public.get_public_products(p_product_id uuid default null)
returns table (
  id uuid, name text, slug text, short_description text, description text, brand text,
  category_id uuid, category_slug text, category_name text,
  marketplace_id uuid, marketplace_slug text, marketplace_name text,
  image_url text, gallery text[], current_price numeric, old_price numeric, discount_percentage integer,
  installments text, installment_value numeric, free_shipping boolean, rating numeric, reviews_count integer,
  featured boolean, trending boolean, best_value boolean, flash_deal boolean,
  created_at timestamptz, updated_at timestamptz, last_price_update timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select v.* from public.public_products v
   where p_product_id is null or v.id = p_product_id;
$$;
revoke all on function public.get_public_products(uuid) from public;
grant execute on function public.get_public_products(uuid) to anon, authenticated;
