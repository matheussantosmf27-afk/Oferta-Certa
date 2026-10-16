-- 019: a vitrine não repete o mesmo produto. Variantes de tamanho/cor chegam do catálogo do Mercado Livre
-- com o mesmo nome e ids diferentes (ex.: 22 "Tênis Olympikus Beats"). Nada é apagado nem inativado:
-- todas continuam no banco, com preço acompanhado; a vitrine mostra só a mais barata de cada nome
-- por marketplace, e se ela sair, a próxima aparece sozinha.

create index if not exists products_active_name_idx
  on public.products (marketplace_id, lower(name), current_price, id)
  where status = 'active';

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
  and coalesce(p.affiliate_url, '') <> ''
  -- Variantes (tamanho/cor) do mesmo produto têm o mesmo nome: a vitrine mostra só a mais barata.
  and not exists (
    select 1 from public.products q
    where q.status = 'active'
      and coalesce(q.affiliate_url, '') <> ''
      and q.marketplace_id = p.marketplace_id
      and lower(q.name) = lower(p.name)
      and (q.current_price < p.current_price or (q.current_price = p.current_price and q.id < p.id))
  );

comment on view public.public_products is
  'Vitrine pública: produtos ativos com link, sem colunas administrativas; desconto só quando corroborado; uma variante (a mais barata) por nome e marketplace.';

grant select on public.public_products to anon, authenticated;
