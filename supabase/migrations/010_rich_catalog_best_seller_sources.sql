-- 010 (14/10/2026): coleta ampliada e conteúdo completo dos produtos.
-- 1. Mais vendidos também por SUBCATEGORIA do ML (20 itens cada, em rodízio), não só pelas 10 raízes.
-- 2. Descrição, destaques, ficha técnica e fotos vindos do catálogo do ML (nada inventado).

------------------------------------------------------------------------------
-- 1. Fontes de mais vendidos por subcategoria
------------------------------------------------------------------------------
create table if not exists public.radar_best_seller_sources (
  ml_category_id text primary key check (ml_category_id ~ '^MLB\d+$'),
  name text not null,
  category_id uuid references public.categories(id) on delete set null,  -- categoria de reserva (a árvore do ML decide antes)
  max_items integer not null default 20 check (max_items between 1 and 50),
  active boolean not null default true,
  last_run_at timestamptz,
  last_status text,
  last_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists radar_best_seller_sources_rotation_idx on public.radar_best_seller_sources (active, last_run_at nulls first);
alter table public.radar_best_seller_sources enable row level security;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'set_timestamps_radar_best_seller_sources') then
    create trigger set_timestamps_radar_best_seller_sources
      before insert or update on public.radar_best_seller_sources
      for each row execute function public.set_timestamps();
  end if;
  if not exists (select 1 from pg_policies where tablename = 'radar_best_seller_sources' and policyname = 'Admin full access radar_best_seller_sources') then
    create policy "Admin full access radar_best_seller_sources" on public.radar_best_seller_sources
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- IDs conferidos em /categories/{raiz} (children_categories) em 14/10/2026.
insert into public.radar_best_seller_sources (ml_category_id, name, category_id)
select s.ml_id, s.name, c.id
from (values
  ('MLB1055',   'Celulares e Smartphones',        'celulares'),
  ('MLB417704', 'Smartwatches e Acessórios',      'celulares'),
  ('MLB1672',   'HDs e SSDs',                     'informatica'),
  ('MLB14370',  'Monitores e Acessórios',         'informatica'),
  ('MLB454379', 'Periféricos para PC',            'informatica'),
  ('MLB430687', 'Portáteis e Acessórios',         'informatica'),
  ('MLB91757',  'Tablets e Acessórios',           'informatica'),
  ('MLB1700',   'Conectividade e Redes',          'informatica'),
  ('MLB1002',   'Televisores',                    'tv-e-audio'),
  ('MLB3835',   'Áudio',                          'tv-e-audio'),
  ('MLB196208', 'Fones de Ouvido',                'tv-e-audio'),
  ('MLB133950', 'Media Streaming',                'tv-e-audio'),
  ('MLB2830',   'Projetores e Telas',             'tv-e-audio'),
  ('MLB1618',   'Cozinha',                        'casa'),
  ('MLB436246', 'Têxteis de Casa e Decoração',    'casa'),
  ('MLB436380', 'Móveis para Casa',               'casa'),
  ('MLB1582',   'Iluminação Residencial',         'casa'),
  ('MLB264051', 'Cuidado da Casa e Lavanderia',   'casa'),
  ('MLB438928', 'Camas, Colchões e Acessórios',   'casa'),
  ('MLB438284', 'Pequenos Eletrodomésticos',      'eletrodomesticos'),
  ('MLB252358', 'Ar e Ventilação',                'eletrodomesticos'),
  ('MLB1576',   'Refrigeração',                   'eletrodomesticos'),
  ('MLB438282', 'Lavadores',                      'eletrodomesticos'),
  ('MLB1580',   'Fornos e Fogões',                'eletrodomesticos'),
  ('MLB4337',   'Aspiradores',                    'eletrodomesticos'),
  ('MLB456043', 'Fritadeiras',                    'eletrodomesticos'),
  ('MLB186456', 'Video Games',                    'games'),
  ('MLB438578', 'Acessórios para Consoles',       'games'),
  ('MLB11172',  'Consoles',                       'games'),
  ('MLB2526',   'Ferramentas Elétricas',          'ferramentas'),
  ('MLB2527',   'Ferramentas Manuais',            'ferramentas'),
  ('MLB5550',   'Medições e Instrumentação',      'ferramentas'),
  ('MLB1747',   'Acessórios de Carros',           'automotivo'),
  ('MLB3381',   'Som Automotivo',                 'automotivo'),
  ('MLB2227',   'Ferramentas para Veículos',      'automotivo'),
  ('MLB188063', 'Limpeza Automotiva',             'automotivo'),
  ('MLB1771',   'Acessórios de Motos',            'automotivo'),
  ('MLB199407', 'Cuidados com a Pele',            'beleza'),
  ('MLB1263',   'Cuidados com o Cabelo',          'beleza'),
  ('MLB1248',   'Maquiagem',                      'beleza'),
  ('MLB6284',   'Perfumes',                       'beleza'),
  ('MLB264787', 'Barbearia',                      'beleza'),
  ('MLB438178', 'Suplementos e Shakers',          'esportes'),
  ('MLB264201', 'Suplementos Alimentares',        'esportes'),
  ('MLB1338',   'Fitness e Musculação',           'esportes'),
  ('MLB1292',   'Ciclismo',                       'esportes'),
  ('MLB1362',   'Camping, Caça e Pesca',          'esportes')
) as s(ml_id, name, slug)
join public.categories c on c.slug = s.slug
on conflict (ml_category_id) do nothing;

------------------------------------------------------------------------------
-- 2. Conteúdo do catálogo
------------------------------------------------------------------------------
alter table public.candidate_products
  add column if not exists description text,
  add column if not exists features text[] not null default '{}',
  add column if not exists specs jsonb not null default '[]'::jsonb,
  add column if not exists gallery text[] not null default '{}';

alter table public.products
  add column if not exists features text[] not null default '{}',
  add column if not exists specs jsonb not null default '[]'::jsonb;

-- Preenche o conteúdo de um produto publicado só onde ainda está vazio (preserva edições do admin).
create or replace function public.fill_product_content(
  p_product_id uuid,
  p_description text,
  p_features text[],
  p_specs jsonb,
  p_gallery text[]
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.products p
     set description = case when coalesce(p.description, '') = '' and coalesce(p_description, '') <> '' then p_description else p.description end,
         short_description = case
           when coalesce(p.short_description, '') = '' and coalesce(p_description, '') <> ''
             then left(p_description, 157) || case when length(p_description) > 157 then '...' else '' end
           else p.short_description end,
         features = case when coalesce(array_length(p.features, 1), 0) = 0 and coalesce(array_length(p_features, 1), 0) > 0 then p_features else p.features end,
         specs = case when jsonb_array_length(coalesce(p.specs, '[]'::jsonb)) = 0 and jsonb_array_length(coalesce(p_specs, '[]'::jsonb)) > 0 then p_specs else p.specs end,
         gallery = case when coalesce(array_length(p.gallery, 1), 0) = 0 and coalesce(array_length(p_gallery, 1), 0) > 0 then p_gallery else p.gallery end
   where p.id = p_product_id;
$$;
revoke execute on function public.fill_product_content(uuid, text, text[], jsonb, text[]) from public, anon, authenticated;
grant execute on function public.fill_product_content(uuid, text, text[], jsonb, text[]) to service_role;

-- Ao publicar (manual ou automático), o produto herda o conteúdo do candidato.
create or replace function public.candidate_published_fill_content()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.product_id is not null and new.product_id is distinct from old.product_id then
    perform public.fill_product_content(new.product_id, new.description, new.features, new.specs, new.gallery);
  end if;
  return new;
end;
$$;
revoke execute on function public.candidate_published_fill_content() from public, anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'candidate_published_fill_content') then
    create trigger candidate_published_fill_content
      after update of product_id on public.candidate_products
      for each row execute function public.candidate_published_fill_content();
  end if;
end $$;

-- Reconsulta de conteúdo pelo coletor (produtos publicados que ainda estão sem descrição).
-- p_items: [{ "product_id": uuid, "description": text|null, "features": [..], "specs": [{name,value}], "gallery": [..] }]
create or replace function public.radar_fill_product_content(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item jsonb;
  v_count integer := 0;
begin
  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    perform public.fill_product_content(
      (item ->> 'product_id')::uuid,
      nullif(item ->> 'description', ''),
      coalesce(array(select jsonb_array_elements_text(coalesce(item -> 'features', '[]'::jsonb))), '{}'),
      coalesce(item -> 'specs', '[]'::jsonb),
      coalesce(array(select jsonb_array_elements_text(coalesce(item -> 'gallery', '[]'::jsonb))), '{}')
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.radar_fill_product_content(jsonb) from public, anon, authenticated;
grant execute on function public.radar_fill_product_content(jsonb) to service_role;

-- Detalhes públicos de um produto ativo (destaques e ficha técnica) para a página do produto.
create or replace function public.get_public_product_details(p_product_id uuid)
returns table (features text[], specs jsonb)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.features, p.specs
    from public.products p
   where p.id = p_product_id
     and p.status = 'active'
     and coalesce(p.affiliate_url, '') <> '';
$$;
revoke execute on function public.get_public_product_details(uuid) from public;
grant execute on function public.get_public_product_details(uuid) to anon, authenticated;

------------------------------------------------------------------------------
-- 3. Gravação dos candidatos com conteúdo (mesma assinatura da 005/008)
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
    v_specs := case when jsonb_typeof(item -> 'specs') = 'array' then item -> 'specs' else '[]'::jsonb end;

    insert into public.candidate_products as c (
      marketplace_id, external_id, title, permalink, image_url, price, original_price, currency,
      free_shipping, rating, reviews_count, sold_quantity, condition, brand, search_term,
      suggested_category_id, score, score_breakdown, raw, last_run_id,
      description, features, specs, gallery
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
      v_gallery
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
