-- 005: publicação automática do Radar (autorizada pelo proprietário em 12/10/2026), com salvaguardas:
-- configuração editável (desligada por padrão), elegibilidade estrita, link de afiliado obrigatório,
-- rastreabilidade (manual x automática), despublicação fácil e expiração de produtos sem vendedor.

------------------------------------------------------------------------------
-- Configuração da automação (linha única; só admin lê/edita — não usar `settings`, que é pública)
------------------------------------------------------------------------------
create table if not exists public.automation_settings (
  id boolean primary key default true check (id),
  auto_publish_enabled boolean not null default false,
  auto_publish_min_score numeric not null default 40 check (auto_publish_min_score between 0 and 100),
  auto_publish_max_per_run integer not null default 20 check (auto_publish_max_per_run between 0 and 200),
  auto_publish_max_per_day integer not null default 100 check (auto_publish_max_per_day between 0 and 1000),
  -- Identificação da conta de afiliado do Mercado Livre (não é senha, mas não fica no código).
  ml_matt_word text check (ml_matt_word is null or ml_matt_word ~ '^[A-Za-z0-9_.-]{1,64}$'),
  ml_matt_tool text check (ml_matt_tool is null or ml_matt_tool ~ '^[A-Za-z0-9_-]{1,64}$'),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Sem etiqueta de afiliado não há como gerar link: a automação não pode ser ligada.
  constraint automation_settings_needs_affiliate check (
    not auto_publish_enabled or (ml_matt_word is not null and ml_matt_tool is not null)
  )
);

alter table public.automation_settings enable row level security;

-- Sem `drop ... if exists`: a 005 foi aplicada só com comandos aditivos (a ferramenta de SQL
-- pede confirmação manual para comandos destrutivos).
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_timestamps_automation_settings') then
    create trigger set_timestamps_automation_settings
      before insert or update on public.automation_settings
      for each row execute function public.set_timestamps();
  end if;
  if not exists (select 1 from pg_policies where tablename = 'automation_settings' and policyname = 'Admin full access automation_settings') then
    create policy "Admin full access automation_settings" on public.automation_settings
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

insert into public.automation_settings (id) values (true) on conflict (id) do nothing;

------------------------------------------------------------------------------
-- Rastreabilidade e acompanhamento
------------------------------------------------------------------------------
alter table public.candidate_products
  add column if not exists publish_mode text check (publish_mode in ('manual', 'auto')),
  add column if not exists published_by uuid references auth.users(id) on delete set null,
  add column if not exists last_run_id uuid references public.radar_runs(id) on delete set null;

alter table public.products
  add column if not exists publish_mode text not null default 'manual' check (publish_mode in ('manual', 'auto')),
  add column if not exists published_by uuid references auth.users(id) on delete set null,
  add column if not exists published_at timestamptz,
  add column if not exists published_run_id uuid references public.radar_runs(id) on delete set null,
  add column if not exists missing_offer_count integer not null default 0 check (missing_offer_count >= 0),
  add column if not exists offer_checked_at timestamptz,
  add column if not exists inactive_reason text;

alter table public.radar_runs
  add column if not exists auto_published_count integer not null default 0,
  add column if not exists refreshed_count integer not null default 0,
  add column if not exists expired_count integer not null default 0;

-- Produtos já publicados pelo painel: manuais, publicados pelo admin que os aprovou.
update public.products p
   set published_at = coalesce(p.published_at, c.reviewed_at, p.created_at),
       published_by = coalesce(p.published_by, c.reviewed_by)
  from public.candidate_products c
 where c.product_id = p.id;
update public.products set published_at = created_at where published_at is null and status = 'active';
update public.candidate_products
   set publish_mode = 'manual', published_by = reviewed_by
 where status = 'approved' and product_id is not null and publish_mode is null;

create index if not exists products_publish_mode_idx on public.products (publish_mode, published_at desc);
create index if not exists products_published_run_idx on public.products (published_run_id);
create index if not exists candidate_products_last_run_idx on public.candidate_products (last_run_id);

------------------------------------------------------------------------------
-- Núcleo de publicação (sem checagem de papel; nunca exposto diretamente)
------------------------------------------------------------------------------
create or replace function public.publish_candidate_core(
  p_candidate_id uuid,
  p_affiliate_url text,
  p_category_id uuid,
  p_name text,
  p_mode text,
  p_actor uuid,
  p_run_id uuid
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
  if p_mode not in ('manual', 'auto') then
    raise exception 'Modo de publicação inválido';
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
  if c.price is null or c.price <= 0 then
    raise exception 'Candidato sem preço válido';
  end if;

  if v_url !~* '^https://[^\s/]+(/\S*)?$' then
    raise exception 'O link de afiliado precisa ser uma URL https válida';
  end if;
  if v_url = c.permalink or split_part(v_url, '#', 1) = split_part(c.permalink, '#', 1) then
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
    free_shipping, rating, reviews_count, status, last_price_update,
    publish_mode, published_by, published_at, published_run_id, missing_offer_count, inactive_reason
  ) values (
    v_name,
    left(public.slugify(v_name), 80) || '-' || left(replace(gen_random_uuid()::text, '-', ''), 6),
    '', '', coalesce(c.brand, ''), p_category_id, c.marketplace_id,
    c.external_id, v_url, c.permalink, coalesce(c.image_url, ''), c.price, v_old_price,
    c.free_shipping, c.rating, c.reviews_count, 'active', now(),
    p_mode, p_actor, now(), p_run_id, 0, null
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
    last_price_update = now(),
    publish_mode = excluded.publish_mode,
    published_by = excluded.published_by,
    published_at = excluded.published_at,
    published_run_id = excluded.published_run_id,
    missing_offer_count = 0,
    inactive_reason = null
  returning id into v_product_id;

  insert into public.product_price_history (product_id, price) values (v_product_id, c.price);

  update public.candidate_products
     set status = 'approved',
         affiliate_url = v_url,
         product_id = v_product_id,
         suggested_category_id = p_category_id,
         publish_mode = p_mode,
         published_by = p_actor,
         -- Publicação automática não tem revisor humano.
         reviewed_by = case when p_mode = 'manual' then p_actor else null end,
         reviewed_at = now(),
         rejection_reason = null
   where id = c.id;

  return v_product_id;
end;
$$;

revoke execute on function public.publish_candidate_core(uuid, text, uuid, text, text, uuid, uuid) from public, anon, authenticated, service_role;

-- Publicação manual pelo painel (mesma assinatura de antes; agora registra o modo).
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
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem publicar produtos' using errcode = '42501';
  end if;
  return public.publish_candidate_core(p_candidate_id, p_affiliate_url, p_category_id, p_name, 'manual', auth.uid(), null);
end;
$$;

revoke execute on function public.publish_candidate(uuid, text, uuid, text) from public, anon;
grant execute on function public.publish_candidate(uuid, text, uuid, text) to authenticated;

------------------------------------------------------------------------------
-- Publicação automática (somente service role / Edge Function)
-- Reconfere TODAS as regras no banco, mesmo que o coletor já as tenha checado.
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
  v_url text := trim(coalesce(p_affiliate_url, ''));
  v_run_count integer;
  v_day_count integer;
  v_params text[];
begin
  select * into s from public.automation_settings where id for share;
  if not found or not s.auto_publish_enabled then
    raise exception 'Publicação automática desligada';
  end if;
  if s.ml_matt_word is null or s.ml_matt_tool is null then
    raise exception 'Etiqueta de afiliado não configurada';
  end if;

  select * into c from public.candidate_products where id = p_candidate_id for update;
  if not found then
    raise exception 'Candidato não encontrado';
  end if;

  -- Elegibilidade (espelha isAutoPublishEligible em _shared/autopublish.ts).
  if c.status <> 'pending' or c.is_demo then
    raise exception 'Candidato não está pendente';
  end if;
  if c.score <= s.auto_publish_min_score then
    raise exception 'Pontuação % não supera o mínimo %', c.score, s.auto_publish_min_score;
  end if;
  if coalesce(c.score_breakdown -> '_alertas', '[]'::jsonb) ? 'desconto_suspeito' then
    raise exception 'Desconto suspeito';
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

  -- O link precisa carregar exatamente a etiqueta configurada (nunca o permalink puro).
  select array_agg(kv) into v_params
    from regexp_split_to_table(split_part(split_part(v_url, '#', 1), '?', 2), '&') kv;
  if not (coalesce(v_params, '{}') @> array['matt_word=' || s.ml_matt_word, 'matt_tool=' || s.ml_matt_tool]) then
    raise exception 'Link sem a etiqueta de afiliado configurada';
  end if;

  -- Nunca sobrescreve um produto que já existe (ex.: publicado manualmente com outro link).
  if exists (select 1 from public.products p where p.marketplace_id = c.marketplace_id and p.external_id = c.external_id) then
    raise exception 'Produto já existe no catálogo';
  end if;

  -- Limites por execução e por dia (fuso de São Paulo).
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
-- Gravação dos candidatos: agora registra a execução em que o vendedor foi confirmado.
-- Nova assinatura com p_run_id OBRIGATÓRIO (sem default), para não haver ambiguidade com a
-- versão antiga de 4 parâmetros, que continua existindo até a Edge Function v4 ser publicada
-- e poderá ser removida numa migration de limpeza.
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
      suggested_category_id, score, score_breakdown, raw, last_run_id
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
      item -> 'raw',
      p_run_id
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
      last_run_id = coalesce(excluded.last_run_id, c.last_run_id),
      times_seen = c.times_seen + 1,
      last_seen_at = now()
    returning * into v_candidate;

    -- Produto já publicado: acompanha o preço e registra histórico quando muda.
    -- Aparecer na busca com oferta válida confirma que ainda há vendedor.
    if v_candidate.product_id is not null then
      update public.products p
         set current_price = v_candidate.price,
             old_price = case when v_candidate.original_price > v_candidate.price then v_candidate.original_price else null end,
             free_shipping = v_candidate.free_shipping,
             last_price_update = now(),
             missing_offer_count = 0,
             offer_checked_at = now()
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
revoke execute on function public.radar_upsert_candidates(text, text, uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.radar_upsert_candidates(text, text, uuid, jsonb, uuid) to service_role;

------------------------------------------------------------------------------
-- Reconsulta de produtos publicados que não apareceram na busca
-- p_items: [{ "product_id": uuid, "available": bool, "price": n, "original_price": n|null, "free_shipping": bool }]
-- Sem vendedor em 2 coletas seguidas → inactive (motivo 'sem_vendedor').
------------------------------------------------------------------------------
create or replace function public.radar_refresh_products(p_items jsonb)
returns table (refreshed integer, expired integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item jsonb;
  v_product public.products%rowtype;
  v_price numeric;
  v_original numeric;
  v_refreshed integer := 0;
  v_expired integer := 0;
begin
  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    select * into v_product from public.products where id = (item ->> 'product_id')::uuid for update;
    if not found then
      continue;
    end if;

    if coalesce((item ->> 'available')::boolean, false) then
      v_price := (item ->> 'price')::numeric;
      if v_price is null or v_price <= 0 then
        continue;
      end if;
      v_original := nullif(item ->> 'original_price', '')::numeric;

      update public.products
         set current_price = v_price,
             old_price = case when v_original > v_price then v_original else null end,
             free_shipping = coalesce((item ->> 'free_shipping')::boolean, free_shipping),
             last_price_update = now(),
             missing_offer_count = 0,
             offer_checked_at = now()
       where id = v_product.id;

      insert into public.product_price_history (product_id, price)
      select v_product.id, v_price
      where not exists (
        select 1 from public.product_price_history h
        where h.product_id = v_product.id
          and h.recorded_at = (select max(recorded_at) from public.product_price_history where product_id = v_product.id)
          and h.price = v_price
      );

      update public.candidate_products
         set price = v_price,
             original_price = case when v_original > v_price then v_original else null end
       where product_id = v_product.id;

      v_refreshed := v_refreshed + 1;
    else
      update public.products
         set missing_offer_count = missing_offer_count + 1,
             offer_checked_at = now(),
             status = case when missing_offer_count + 1 >= 2 and status = 'active' then 'inactive'::public.product_status else status end,
             inactive_reason = case when missing_offer_count + 1 >= 2 and status = 'active' then 'sem_vendedor' else inactive_reason end
       where id = v_product.id;

      if v_product.missing_offer_count + 1 >= 2 and v_product.status = 'active' then
        v_expired := v_expired + 1;
      end if;
    end if;
  end loop;

  return query select v_refreshed, v_expired;
end;
$$;
revoke execute on function public.radar_refresh_products(jsonb) from public, anon, authenticated;
grant execute on function public.radar_refresh_products(jsonb) to service_role;

------------------------------------------------------------------------------
-- Despublicação (painel): um produto ou tudo que uma execução publicou automaticamente
------------------------------------------------------------------------------
create or replace function public.unpublish_products(p_product_ids uuid[] default null, p_run_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem despublicar produtos' using errcode = '42501';
  end if;
  if p_product_ids is null and p_run_id is null then
    raise exception 'Informe os produtos ou a execução';
  end if;

  update public.products
     set status = 'inactive',
         inactive_reason = case when p_run_id is not null then 'despublicado_execucao' else 'despublicado_manual' end
   where status = 'active'
     and (p_product_ids is null or id = any(p_product_ids))
     and (p_run_id is null or (published_run_id = p_run_id and publish_mode = 'auto'));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.unpublish_products(uuid[], uuid) from public, anon;
grant execute on function public.unpublish_products(uuid[], uuid) to authenticated;
