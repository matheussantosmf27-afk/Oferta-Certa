-- 012: lojas parceiras (Shopee, AliExpress com API; Amazon manual) na mesma esteira do Radar.
-- Sem DROP: create or replace / if not exists.

------------------------------------------------------------------------------
-- 1. Lojas
------------------------------------------------------------------------------
-- Dias que um preço sem atualização automática continua valendo (null = atualizado pela coleta).
alter table public.marketplaces add column if not exists price_max_age_days integer;

insert into public.marketplaces (slug, name, active, affiliate_hosts, price_max_age_days) values
  ('shopee', 'Shopee', true, array['shopee.com.br', 's.shopee.com.br', 'shope.ee'], null),
  ('aliexpress', 'AliExpress', true, array['aliexpress.com', 'aliexpress.us', 's.click.aliexpress.com', 'a.aliexpress.com'], null),
  ('amazon', 'Amazon', true, array['amazon.com.br', 'amzn.to'], 7)
on conflict (slug) do update set
  affiliate_hosts = excluded.affiliate_hosts,
  price_max_age_days = excluded.price_max_age_days;

-- Em quais lojas cada termo do Radar é pesquisado.
alter table public.radar_search_terms
  add column if not exists marketplaces text[] not null default array['mercado-livre', 'shopee', 'aliexpress'];

-- Coleta de origem de cada execução ('mercado-livre' ou 'parceiros').
alter table public.radar_runs add column if not exists source text not null default 'mercado-livre';

------------------------------------------------------------------------------
-- 2. Gravação dos candidatos guarda o link de afiliado das lojas parceiras
------------------------------------------------------------------------------
create or replace function public.radar_upsert_candidates(
  p_marketplace_slug text,
  p_search_term text,
  p_category_id uuid,
  p_items jsonb,
  p_run_id uuid
)
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
  v_leaf text;
  v_known boolean;
  v_category uuid;
  v_features text[];
  v_gallery text[];
  v_specs jsonb;
  v_affiliate text;
begin
  select id into v_marketplace_id from public.marketplaces where slug = p_marketplace_slug;
  if v_marketplace_id is null then
    raise exception 'Marketplace % não cadastrado', p_marketplace_slug;
  end if;

  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_price := (item ->> 'price')::numeric;
    v_leaf := nullif(item #>> '{raw,category_id}', '');
    v_known := v_leaf is not null and exists (select 1 from public.ml_categories where id = v_leaf);
    v_category := public.ml_resolve_category(v_leaf, p_category_id);
    v_features := coalesce(array(select jsonb_array_elements_text(case when jsonb_typeof(item -> 'features') = 'array' then item -> 'features' else '[]'::jsonb end)), '{}');
    v_gallery := coalesce(array(select jsonb_array_elements_text(case when jsonb_typeof(item -> 'gallery') = 'array' then item -> 'gallery' else '[]'::jsonb end)), '{}');
    -- Lojas parceiras: link de afiliado gerado pela API da loja (só https).
    v_affiliate := case when coalesce(item ->> 'affiliate_url', '') ~* '^https://\S+$' then item ->> 'affiliate_url' else null end;
    v_specs := case when jsonb_typeof(item -> 'specs') = 'array' then item -> 'specs' else '[]'::jsonb end;

    insert into public.candidate_products as c (
      marketplace_id, external_id, title, permalink, image_url, price, original_price, currency,
      free_shipping, rating, reviews_count, sold_quantity, condition, brand, search_term,
      suggested_category_id, score, score_breakdown, raw, last_run_id,
      description, features, specs, gallery, affiliate_url
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
      v_category,
      coalesce((item ->> 'score')::numeric, 0),
      coalesce(item -> 'score_breakdown', '{}'::jsonb),
      item -> 'raw',
      p_run_id,
      nullif(item ->> 'description', ''),
      v_features,
      v_specs,
      v_gallery,
      v_affiliate
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
      suggested_category_id = case
        when c.status = 'pending' and v_known then v_category
        else coalesce(c.suggested_category_id, excluded.suggested_category_id)
      end,
      last_run_id = coalesce(excluded.last_run_id, c.last_run_id),
      -- Conteúdo novo só substitui o antigo quando veio preenchido (a busca traz menos que o detalhe).
      description = coalesce(excluded.description, c.description),
      features = case when coalesce(array_length(excluded.features, 1), 0) > 0 then excluded.features else c.features end,
      specs = case when jsonb_array_length(excluded.specs) >= jsonb_array_length(c.specs) then excluded.specs else c.specs end,
      gallery = case when coalesce(array_length(excluded.gallery, 1), 0) > 0 then excluded.gallery else c.gallery end,
      -- Candidato ainda não publicado recebe o link mais recente; publicado mantém o do produto.
      affiliate_url = case when c.product_id is null then coalesce(excluded.affiliate_url, c.affiliate_url) else c.affiliate_url end,
      times_seen = c.times_seen + 1,
      last_seen_at = now()
    returning * into v_candidate;

    if v_candidate.product_id is not null then
      update public.products p
         set current_price = v_candidate.price,
             old_price = case when v_candidate.original_price > v_candidate.price then v_candidate.original_price else null end,
             free_shipping = v_candidate.free_shipping,
             last_price_update = now(),
             missing_offer_count = 0,
             offer_checked_at = now()
       where p.id = v_candidate.product_id;

      perform public.fill_product_content(v_candidate.product_id, v_candidate.description, v_candidate.features, v_candidate.specs, v_candidate.gallery);

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
revoke execute on function public.radar_upsert_candidates(text, text, uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.radar_upsert_candidates(text, text, uuid, jsonb, uuid) to service_role;

------------------------------------------------------------------------------
-- 3. Publicação automática: etiqueta do ML só para o ML; parceiras usam o link da API
------------------------------------------------------------------------------
create or replace function public.publish_candidate_internal(
  p_candidate_id uuid,
  p_affiliate_url text,
  p_run_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s public.automation_settings%rowtype;
  c public.candidate_products%rowtype;
  v_slug text;
  v_url text := trim(coalesce(p_affiliate_url, ''));
  v_run_count integer;
  v_day_count integer;
  v_params text[];
begin
  select * into s from public.automation_settings where id for share;
  if not found or not s.auto_publish_enabled then
    raise exception 'Publicação automática desligada';
  end if;

  select * into c from public.candidate_products where id = p_candidate_id for update;
  if not found then
    raise exception 'Candidato não encontrado';
  end if;
  select slug into v_slug from public.marketplaces where id = c.marketplace_id;

  -- Elegibilidade (espelha autoPublishBlockers em _shared/autopublish.ts).
  if c.status <> 'pending' or c.is_demo then
    raise exception 'Candidato não está pendente';
  end if;
  if c.score <= s.auto_publish_min_score then
    raise exception 'Pontuação % não supera o mínimo %', c.score, s.auto_publish_min_score;
  end if;
  if coalesce(c.score_breakdown -> '_alertas', '[]'::jsonb) ? 'desconto_suspeito' then
    raise exception 'Desconto suspeito';
  end if;
  if c.discount_pct is not null and c.discount_pct > s.auto_publish_max_discount then
    raise exception 'Desconto de % %% acima do limite de % %%', c.discount_pct, s.auto_publish_max_discount;
  end if;
  if s.auto_publish_block_foreign_titles and coalesce(c.score_breakdown -> '_alertas', '[]'::jsonb) ? 'titulo_estrangeiro' then
    raise exception 'Título estrangeiro';
  end if;
  if coalesce(trim(c.image_url), '') = '' or c.price is null or c.price <= 0 then
    raise exception 'Candidato sem imagem ou preço';
  end if;
  if c.suggested_category_id is null then
    raise exception 'Candidato sem categoria';
  end if;
  if p_run_id is null or c.last_run_id is distinct from p_run_id then
    raise exception 'Vendedor não confirmado nesta coleta';
  end if;

  if v_slug = 'mercado-livre' then
    if s.ml_matt_word is null or s.ml_matt_tool is null then
      raise exception 'Etiqueta de afiliado não configurada';
    end if;
    select array_agg(kv) into v_params
      from regexp_split_to_table(split_part(split_part(v_url, '#', 1), '?', 2), '&') kv;
    if not (coalesce(v_params, '{}') @> array['matt_word=' || s.ml_matt_word, 'matt_tool=' || s.ml_matt_tool]) then
      raise exception 'Link sem a etiqueta de afiliado configurada';
    end if;
  else
    -- Lojas parceiras: só o link que a API da loja gerou com a conta de afiliado.
    if c.affiliate_url is null or v_url <> c.affiliate_url then
      raise exception 'Link de afiliado diferente do gerado pela API da loja';
    end if;
  end if;

  if exists (select 1 from public.products p where p.marketplace_id = c.marketplace_id and p.external_id = c.external_id) then
    raise exception 'Produto já existe no catálogo';
  end if;

  select count(*) into v_run_count from public.products where publish_mode = 'auto' and published_run_id = p_run_id;
  if v_run_count >= s.auto_publish_max_per_run then
    raise exception 'Limite por execução atingido';
  end if;
  select count(*) into v_day_count from public.products
   where publish_mode = 'auto'
     and published_at >= (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo');
  if v_day_count >= s.auto_publish_max_per_day then
    raise exception 'Limite diário atingido';
  end if;

  return public.publish_candidate_core(c.id, v_url, c.suggested_category_id, null, 'auto', null, p_run_id);
end;
$$;
revoke execute on function public.publish_candidate_internal(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.publish_candidate_internal(uuid, text, uuid) to service_role;

------------------------------------------------------------------------------
-- 4. Agendamento da coleta das lojas parceiras (30 min depois da do ML)
------------------------------------------------------------------------------
create or replace function public.radar_invoke_partners(p_trigger text default 'schedule')
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
    body := jsonb_build_object('trigger', coalesce(p_trigger, 'schedule'), 'source', 'parceiros'),
    timeout_milliseconds := 150000
  ) into v_request;
  return v_request;
end;
$$;
revoke execute on function public.radar_invoke_partners(text) from public, anon, authenticated;

------------------------------------------------------------------------------
-- 5. Preços sem atualização automática (Amazon manual) expiram
------------------------------------------------------------------------------
create or replace function public.expire_stale_prices()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.products p
     set status = 'inactive', inactive_reason = 'preco_desatualizado', updated_at = now()
    from public.marketplaces m
   where m.id = p.marketplace_id
     and m.price_max_age_days is not null
     and p.status = 'active'
     and p.last_price_update < now() - make_interval(days => m.price_max_age_days);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.expire_stale_prices() from public, anon, authenticated;

do $$
begin
  perform cron.schedule('radar-partners', '37 */3 * * *', 'select public.radar_invoke_partners(''schedule'');');
  perform cron.schedule('expire-stale-prices', '50 4 * * *', 'select public.expire_stale_prices();');
end;
$$;
