-- 004: execução agendada do Radar (pg_cron + Edge Function), tokens do Mercado Livre e gravação idempotente

-- Desconto calculado no banco (para ordenar a fila); nunca negativo nem inventado.
alter table public.candidate_products
  add column if not exists discount_pct numeric generated always as (
    case when original_price is not null and original_price > price and original_price > 0
      then round(((original_price - price) / original_price) * 100, 1)
      else null end
  ) stored;

create index if not exists candidate_products_discount_idx on public.candidate_products (discount_pct desc nulls last);

------------------------------------------------------------------------------
-- Tokens de integrações (somente service role; sem policies = ninguém mais lê)
------------------------------------------------------------------------------
create table if not exists public.integration_tokens (
  provider text primary key,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.integration_tokens enable row level security;

-- Estado da conexão para o painel (sem expor tokens).
create or replace function public.integration_status(p_provider text)
returns table (connected boolean, expires_at timestamptz, updated_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (t.refresh_token is not null or (t.access_token is not null and t.expires_at > now())), t.expires_at, t.updated_at
  from public.integration_tokens t
  where t.provider = p_provider and public.is_admin();
$$;
revoke execute on function public.integration_status(text) from public, anon;
grant execute on function public.integration_status(text) to authenticated;

------------------------------------------------------------------------------
-- Segredo compartilhado entre o agendador e a Edge Function (guardado no Vault)
------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'radar_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'radar_cron_secret', 'Autentica o agendador do Radar');
  end if;
end $$;

create or replace function public.radar_check_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'radar_cron_secret' and decrypted_secret = p_secret and length(coalesce(p_secret, '')) >= 32
  );
$$;
revoke execute on function public.radar_check_secret(text) from public, anon, authenticated;
grant execute on function public.radar_check_secret(text) to service_role;

-- Chama a Edge Function de coleta (usado pelo pg_cron).
create or replace function public.radar_invoke(p_trigger text default 'schedule')
returns bigint
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_secret text;
  v_request bigint;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'radar_cron_secret';
  select net.http_post(
    url := 'https://zajsuizqgysaimvdtjbu.supabase.co/functions/v1/radar-collect',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-radar-secret', v_secret),
    body := jsonb_build_object('trigger', coalesce(p_trigger, 'schedule')),
    timeout_milliseconds := 150000
  ) into v_request;
  return v_request;
end;
$$;
revoke execute on function public.radar_invoke(text) from public, anon, authenticated;

------------------------------------------------------------------------------
-- Gravação dos candidatos: idempotente, preserva revisão e atualiza preço publicado
------------------------------------------------------------------------------
create or replace function public.radar_upsert_candidates(p_marketplace_slug text, p_search_term text, p_category_id uuid, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_marketplace_id uuid;
  v_count integer := 0;
  item jsonb;
  v_candidate public.candidate_products%rowtype;
  v_price numeric;
begin
  select id into v_marketplace_id from public.marketplaces where slug = p_marketplace_slug;
  if v_marketplace_id is null then
    raise exception 'Marketplace % não cadastrado', p_marketplace_slug;
  end if;

  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_price := (item ->> 'price')::numeric;

    insert into public.candidate_products as c (
      marketplace_id, external_id, title, permalink, image_url, price, original_price, currency,
      free_shipping, rating, reviews_count, sold_quantity, condition, brand, search_term,
      suggested_category_id, score, score_breakdown, raw
    ) values (
      v_marketplace_id,
      item ->> 'external_id',
      item ->> 'title',
      item ->> 'permalink',
      item ->> 'image_url',
      v_price,
      nullif(item ->> 'original_price', '')::numeric,
      coalesce(item ->> 'currency', 'BRL'),
      coalesce((item ->> 'free_shipping')::boolean, false),
      nullif(item ->> 'rating', '')::numeric,
      nullif(item ->> 'reviews_count', '')::integer,
      nullif(item ->> 'sold_quantity', '')::integer,
      item ->> 'condition',
      item ->> 'brand',
      p_search_term,
      p_category_id,
      coalesce((item ->> 'score')::numeric, 0),
      coalesce(item -> 'score_breakdown', '{}'::jsonb),
      item -> 'raw'
    )
    on conflict (marketplace_id, external_id) do update set
      title = excluded.title,
      permalink = excluded.permalink,
      image_url = excluded.image_url,
      price = excluded.price,
      original_price = excluded.original_price,
      free_shipping = excluded.free_shipping,
      sold_quantity = excluded.sold_quantity,
      condition = excluded.condition,
      brand = coalesce(excluded.brand, c.brand),
      score = excluded.score,
      score_breakdown = excluded.score_breakdown,
      raw = excluded.raw,
      suggested_category_id = coalesce(c.suggested_category_id, excluded.suggested_category_id),
      times_seen = c.times_seen + 1,
      last_seen_at = now()
    returning * into v_candidate;

    -- Produto já publicado: acompanha o preço e registra histórico quando muda.
    if v_candidate.product_id is not null then
      update public.products p
         set current_price = v_candidate.price,
             old_price = case when v_candidate.original_price > v_candidate.price then v_candidate.original_price else null end,
             free_shipping = v_candidate.free_shipping,
             last_price_update = now()
       where p.id = v_candidate.product_id;

      insert into public.product_price_history (product_id, price)
      select v_candidate.product_id, v_candidate.price
      where not exists (
        select 1 from public.product_price_history h
        where h.product_id = v_candidate.product_id
          and h.recorded_at = (select max(recorded_at) from public.product_price_history where product_id = v_candidate.product_id)
          and h.price = v_candidate.price
      );
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
revoke execute on function public.radar_upsert_candidates(text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.radar_upsert_candidates(text, text, uuid, jsonb) to service_role;

------------------------------------------------------------------------------
-- Agendamento: a cada 3 horas
------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'radar-collect') then
    perform cron.unschedule('radar-collect');
  end if;
  perform cron.schedule('radar-collect', '7 */3 * * *', $cron$select public.radar_invoke('schedule');$cron$);
end $$;

-- Limpeza: respostas antigas do pg_net e execuções com mais de 60 dias.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'radar-cleanup') then
    perform cron.unschedule('radar-cleanup');
  end if;
  perform cron.schedule('radar-cleanup', '30 4 * * *', $cron$delete from public.radar_runs where started_at < now() - interval '60 days';$cron$);
end $$;
