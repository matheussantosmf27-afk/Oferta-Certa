-- 013: "Raio-X do preço" — preço de todos os vendedores do produto e reputação do vendedor (API oficial do ML).
-- Sem DROP.

alter table public.products
  add column if not exists market_offers integer,
  add column if not exists market_min numeric(12,2),
  add column if not exists market_median numeric(12,2),
  add column if not exists market_max numeric(12,2),
  add column if not exists market_checked_at timestamptz,
  add column if not exists seller_name text,
  add column if not exists seller_level smallint,
  add column if not exists seller_power text,
  add column if not exists seller_sales integer,
  add column if not exists official_store boolean,
  add column if not exists warranty text;

-- Um registro por produto e dia (horário de São Paulo): faixa de preço entre vendedores.
create table if not exists public.product_market_history (
  product_id uuid not null references public.products(id) on delete cascade,
  day date not null,
  offers integer not null,
  min numeric(12,2) not null,
  median numeric(12,2) not null,
  max numeric(12,2) not null,
  primary key (product_id, day)
);
alter table public.product_market_history enable row level security;

/** Grava o resumo de mercado dos produtos publicados vistos na coleta (só service_role). */
create or replace function public.radar_update_market(p_marketplace_slug text, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_marketplace uuid;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  item jsonb;
  v_product uuid;
  v_count integer := 0;
begin
  select id into v_marketplace from public.marketplaces where slug = p_marketplace_slug;
  if v_marketplace is null then
    return 0;
  end if;

  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    if coalesce((item ->> 'offers_count')::integer, 0) < 1 or coalesce((item ->> 'min')::numeric, 0) <= 0 then
      continue;
    end if;

    update public.products p
       set market_offers = (item ->> 'offers_count')::integer,
           market_min = (item ->> 'min')::numeric,
           market_median = (item ->> 'median')::numeric,
           market_max = (item ->> 'max')::numeric,
           market_checked_at = now(),
           official_store = coalesce((item ->> 'official_store')::boolean, p.official_store),
           warranty = coalesce(nullif(item ->> 'warranty', ''), p.warranty),
           seller_name = case when item -> 'seller' is not null and jsonb_typeof(item -> 'seller') = 'object' then nullif(item #>> '{seller,name}', '') else p.seller_name end,
           seller_level = case when jsonb_typeof(item -> 'seller') = 'object' then nullif(item #>> '{seller,level}', '')::smallint else p.seller_level end,
           seller_power = case when jsonb_typeof(item -> 'seller') = 'object' then nullif(item #>> '{seller,power_seller}', '') else p.seller_power end,
           seller_sales = case when jsonb_typeof(item -> 'seller') = 'object' then nullif(item #>> '{seller,sales}', '')::integer else p.seller_sales end
     where p.marketplace_id = v_marketplace
       and p.external_id = item ->> 'external_id'
       and p.status = 'active'
    returning p.id into v_product;

    if v_product is not null then
      insert into public.product_market_history (product_id, day, offers, min, median, max)
      values (v_product, v_today, (item ->> 'offers_count')::integer, (item ->> 'min')::numeric, (item ->> 'median')::numeric, (item ->> 'max')::numeric)
      on conflict (product_id, day) do update set
        offers = excluded.offers, min = excluded.min, median = excluded.median, max = excluded.max;
      v_count := v_count + 1;
    end if;
    v_product := null;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.radar_update_market(text, jsonb) from public, anon, authenticated;
grant execute on function public.radar_update_market(text, jsonb) to service_role;

/** Dados públicos do raio-X de um produto ativo: mercado, vendedor e faixa diária dos últimos 90 dias. */
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
