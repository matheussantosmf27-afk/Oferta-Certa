-- 014: descontos confiáveis, histórico com origem e observação diária, e indicador real do radar.
-- Sem DROP: create or replace / if not exists. Nada do histórico existente é alterado.

------------------------------------------------------------------------------
-- 1. Histórico de preço: origem do registro e observação diária
------------------------------------------------------------------------------
-- 'coleta' = conferido pelo Radar; 'manual' = salvo no painel.
alter table public.product_price_history add column if not exists source text not null default 'coleta';
create index if not exists product_price_history_product_recorded_idx on public.product_price_history (product_id, recorded_at desc);

/**
 * Sempre que a coleta confere um produto (offer_checked_at muda), registra o preço se ele mudou
 * ou se o último registro tem mais de 20 horas. Assim o histórico mostra que o preço foi conferido,
 * sem duplicar registros a cada coleta.
 */
create or replace function public.record_price_observation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_last_price numeric;
  v_last_at timestamptz;
begin
  if new.current_price is null or new.current_price <= 0 then
    return new;
  end if;
  select h.price, h.recorded_at into v_last_price, v_last_at
    from public.product_price_history h
   where h.product_id = new.id
   order by h.recorded_at desc
   limit 1;
  if v_last_at is null or v_last_price <> new.current_price or v_last_at < now() - interval '20 hours' then
    insert into public.product_price_history (product_id, price, source) values (new.id, new.current_price, 'coleta');
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'products_record_price_observation') then
    create trigger products_record_price_observation
      after update of offer_checked_at on public.products
      for each row
      when (new.status = 'active' and new.offer_checked_at is distinct from old.offer_checked_at)
      execute function public.record_price_observation();
  end if;
end;
$$;

------------------------------------------------------------------------------
-- 2. Status do desconto
------------------------------------------------------------------------------
/**
 * O "preço anterior" informado pela loja só vira desconto exibido quando há corroboração:
 * - 'confirmado': o Oferta Certa já registrou o produto perto desse preço (histórico de 7+ dias);
 * - 'compativel': outros vendedores do mesmo produto cobram hoje até esse preço (com folga de 10%);
 * - 'acima_do_mercado': o preço anterior passa do que qualquer vendedor cobra hoje;
 * - 'nao_confirmado': sem dados para confirmar (ou desconto acima de 70%).
 * Sem preço anterior maior que o atual: null.
 */
create or replace function public.product_discount_status(
  p_product_id uuid,
  p_price numeric,
  p_old numeric,
  p_market_offers integer,
  p_market_max numeric,
  p_market_checked timestamptz
)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_span interval;
  v_peak numeric;
begin
  if p_old is null or p_price is null or p_price <= 0 or p_old <= p_price then
    return null;
  end if;
  if (p_old - p_price) / p_old > 0.70 then
    return 'nao_confirmado';
  end if;

  select max(h.recorded_at) - min(h.recorded_at),
         max(h.price) filter (where h.recorded_at > now() - interval '90 days')
    into v_span, v_peak
    from public.product_price_history h
   where h.product_id = p_product_id;
  if v_span >= interval '7 days' and v_peak >= p_old * 0.9 then
    return 'confirmado';
  end if;

  if coalesce(p_market_offers, 0) >= 2 and p_market_max is not null and p_market_checked > now() - interval '3 days' then
    if p_old <= p_market_max * 1.1 then
      return 'compativel';
    end if;
    return 'acima_do_mercado';
  end if;
  return 'nao_confirmado';
end;
$$;
revoke all on function public.product_discount_status(uuid, numeric, numeric, integer, numeric, timestamptz) from public, anon, authenticated;

------------------------------------------------------------------------------
-- 3. Catálogo público: desconto e preço anterior só quando corroborados
------------------------------------------------------------------------------
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
  select
    p.id, p.name, p.slug, p.short_description, p.description, p.brand,
    c.id, c.slug, c.name,
    m.id, m.slug, m.name,
    p.image_url, p.gallery, p.current_price,
    case when d.trusted then p.old_price else null end,
    case when d.trusted then round(((p.old_price - p.current_price) / p.old_price) * 100)::integer else null end,
    p.installments, p.installment_value, p.free_shipping, p.rating, p.reviews_count,
    p.featured, p.trending, p.best_value, p.flash_deal,
    p.created_at, p.updated_at, p.last_price_update
  from public.products p
  join public.categories c on c.id = p.category_id
  join public.marketplaces m on m.id = p.marketplace_id
  cross join lateral (
    select public.product_discount_status(p.id, p.current_price, p.old_price, p.market_offers, p.market_max, p.market_checked_at)
           in ('confirmado', 'compativel') as trusted
  ) d
  where p.status = 'active'
    and coalesce(p.affiliate_url, '') <> ''
    and (p_product_id is null or p.id = p_product_id);
$$;
revoke all on function public.get_public_products(uuid) from public;
grant execute on function public.get_public_products(uuid) to anon, authenticated;

------------------------------------------------------------------------------
-- 4. Raio-X: inclui o preço de referência bruto e o status do desconto
------------------------------------------------------------------------------
create or replace function public.get_public_product_insights(p_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'market', case when p.market_offers is null then null else jsonb_build_object(
      'offers', p.market_offers, 'min', p.market_min, 'median', p.market_median, 'max', p.market_max, 'checked_at', p.market_checked_at
    ) end,
    'seller', case when p.seller_name is null and p.seller_level is null then null else jsonb_build_object(
      'name', p.seller_name, 'level', p.seller_level, 'power_seller', p.seller_power, 'sales', p.seller_sales
    ) end,
    'official_store', p.official_store,
    'warranty', p.warranty,
    'reference_price', case when p.old_price > p.current_price then p.old_price else null end,
    'discount_status', public.product_discount_status(p.id, p.current_price, p.old_price, p.market_offers, p.market_max, p.market_checked_at),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('day', h.day, 'offers', h.offers, 'min', h.min, 'median', h.median, 'max', h.max) order by h.day)
      from public.product_market_history h
      where h.product_id = p.id and h.day >= (now() at time zone 'America/Sao_Paulo')::date - 90
    ), '[]'::jsonb)
  )
  from public.products p
  where p.id = p_product_id and p.status = 'active' and coalesce(p.affiliate_url, '') <> '';
$$;
revoke all on function public.get_public_product_insights(uuid) from public;
grant execute on function public.get_public_product_insights(uuid) to anon, authenticated;

------------------------------------------------------------------------------
-- 5. Indicador do radar (home): números reais, sem expor a tabela de execuções
------------------------------------------------------------------------------
create or replace function public.get_radar_status()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'published', (select count(*) from public.products where status = 'active' and coalesce(affiliate_url, '') <> ''),
    'verified_24h', (
      select count(*) from public.products
       where status = 'active' and coalesce(affiliate_url, '') <> ''
         and greatest(offer_checked_at, last_price_update) > now() - interval '24 hours'
    ),
    'last_success_at', (select max(finished_at) from public.radar_runs where status in ('success', 'partial')),
    'last_run_status', (select status from public.radar_runs where status <> 'running' order by started_at desc limit 1),
    'last_run_at', (select finished_at from public.radar_runs where status <> 'running' order by started_at desc limit 1)
  );
$$;
revoke all on function public.get_radar_status() from public;
grant execute on function public.get_radar_status() to anon, authenticated;
