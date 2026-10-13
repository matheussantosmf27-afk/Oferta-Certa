-- 008: salvaguardas de qualidade da publicação automática e categoria pelo caminho real do Mercado Livre.
-- (13/10/2026) Motivo: a fila automática publicou descontos inflados (63–69%), um anúncio genérico em inglês
-- e itens em categorias erradas (papel higiênico em Beleza, gift card em Informática, piscina em Ferramentas),
-- porque as listas de mais vendidos do ML misturam produtos de outras áreas.

------------------------------------------------------------------------------
-- 1. Novas regras configuráveis da automação
------------------------------------------------------------------------------
alter table public.automation_settings
  add column if not exists auto_publish_max_discount numeric not null default 60
    check (auto_publish_max_discount between 0 and 100),
  add column if not exists auto_publish_block_foreign_titles boolean not null default true;

------------------------------------------------------------------------------
-- 2. Árvore de categorias do ML (cache) e mapa para as categorias do site
------------------------------------------------------------------------------
create table if not exists public.ml_categories (
  id text primary key check (id ~ '^MLB\d+$'),
  name text not null,
  path text[] not null,          -- ids da raiz até a folha
  path_names text[] not null,    -- nomes, na mesma ordem
  fetched_at timestamptz not null default now()
);
alter table public.ml_categories enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'ml_categories' and policyname = 'Admin select ml_categories') then
    create policy "Admin select ml_categories" on public.ml_categories for select to authenticated using (public.is_admin());
  end if;
end $$;

-- Qualquer nível do caminho pode ser mapeado; vale o nível mais próximo da folha.
-- category_id nulo = "não publicar automaticamente" (o item fica sem categoria e vai para a fila manual).
create table if not exists public.ml_category_map (
  ml_category_id text primary key check (ml_category_id ~ '^MLB\d+$'),
  category_id uuid references public.categories(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ml_category_map enable row level security;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'set_timestamps_ml_category_map') then
    create trigger set_timestamps_ml_category_map
      before insert or update on public.ml_category_map
      for each row execute function public.set_timestamps();
  end if;
  if not exists (select 1 from pg_policies where tablename = 'ml_category_map' and policyname = 'Admin full access ml_category_map') then
    create policy "Admin full access ml_category_map" on public.ml_category_map
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- Raízes: as mesmas de categories.ml_category_id.
insert into public.ml_category_map (ml_category_id, category_id, note)
select c.ml_category_id, c.id, 'raiz: ' || c.name
from public.categories c
where c.ml_category_id is not null
on conflict (ml_category_id) do nothing;

-- Exceções conferidas em /categories/{id} em 13/10/2026.
insert into public.ml_category_map (ml_category_id, category_id, note)
select m.ml_id, c.id, m.note
from (values
  ('MLB431600', 'casa',        'Beleza > Higiene Pessoal > Papéis Higiênicos'),
  ('MLB447778', 'games',       'Informática > Acessórios para PC Gaming (fones gamer, controles, gift cards)'),
  ('MLB7457',   'tv-e-audio',  'Celulares > Acessórios > Fones de Ouvido'),
  ('MLB1500',   'ferramentas', 'Construção'),
  ('MLB269773', 'casa',        'Construção > Mobiliário para Banheiros (chuveiros)'),
  ('MLB264201', 'esportes',    'Saúde > Suplementos Alimentares'),
  ('MLB1039',   'tv-e-audio',  'Câmeras e Acessórios')
) as m(ml_id, slug, note)
join public.categories c on c.slug = m.slug
on conflict (ml_category_id) do nothing;

-- Categoria do site para uma folha do ML.
-- Caminho conhecido: devolve o mapeamento do nível mais próximo da folha (ou null se nenhum nível
-- estiver mapeado). Caminho desconhecido: devolve p_fallback (categoria do termo de busca).
create or replace function public.ml_resolve_category(p_leaf text, p_fallback uuid default null)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_path text[];
  v_category uuid;
begin
  if p_leaf is null then
    return p_fallback;
  end if;
  select path into v_path from public.ml_categories where id = p_leaf;
  if v_path is null then
    return p_fallback;
  end if;
  select m.category_id into v_category
    from unnest(v_path) with ordinality as p(id, depth)
    join public.ml_category_map m on m.ml_category_id = p.id
   order by p.depth desc
   limit 1;
  return v_category;
end;
$$;
revoke execute on function public.ml_resolve_category(text, uuid) from public, anon, authenticated;
grant execute on function public.ml_resolve_category(text, uuid) to service_role;

------------------------------------------------------------------------------
-- 3. Gravação dos candidatos: categoria pela folha do ML (mesma assinatura da 005)
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
      v_category,
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
      -- Pendentes seguem a árvore do ML quando ela é conhecida; revisados mantêm a escolha do admin.
      suggested_category_id = case
        when c.status = 'pending' and v_known then v_category
        else coalesce(c.suggested_category_id, excluded.suggested_category_id)
      end,
      last_run_id = coalesce(excluded.last_run_id, c.last_run_id),
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
-- 4. Publicação automática: teto de desconto e título estrangeiro (mesma assinatura da 005)
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

  select array_agg(kv) into v_params
    from regexp_split_to_table(split_part(split_part(v_url, '#', 1), '?', 2), '&') kv;
  if not (coalesce(v_params, '{}') @> array['matt_word=' || s.ml_matt_word, 'matt_tool=' || s.ml_matt_tool]) then
    raise exception 'Link sem a etiqueta de afiliado configurada';
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
