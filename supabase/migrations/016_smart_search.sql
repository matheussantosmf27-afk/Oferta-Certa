-- 016: busca inteligente (marca, modelo, código, características) e status de desconto armazenado.
-- Sem DROP de tabela/coluna e sem apagar dados: create or replace / if not exists.

create extension if not exists pg_trgm with schema extensions;

------------------------------------------------------------------------------
-- 1. Normalização de texto para busca
------------------------------------------------------------------------------
/**
 * Minúsculo, sem acento, pontuação e hífens viram espaço, e unidades coladas ao número:
 * "Galaxy S25 Ultra 256 GB" → "galaxy s25 ultra 256gb"; "Smart TV 55\"" → "smart tv 55pol";
 * "Air Fryer 4 Litros" → "air fryer 4l"; "1,5 L" → "1.5l". Números e códigos de modelo são preservados.
 */
create or replace function public.search_text(p_text text)
returns text
language plpgsql
immutable
parallel safe
set search_path = public, extensions, pg_temp
as $$
declare
  t text;
begin
  t := lower(extensions.unaccent(coalesce(p_text, '')));
  t := regexp_replace(t, '(\d),(\d)', '\1.\2', 'g');
  t := regexp_replace(t, '(\d)\s*("|''''|”|″)', '\1pol ', 'g');
  t := regexp_replace(t, '[^a-z0-9.]+', ' ', 'g');
  t := regexp_replace(t, '(?<![0-9])\.|\.(?![0-9])', ' ', 'g');
  t := regexp_replace(t, '(\d)\s*(polegadas|polegada|pol|inches|inch|pulgadas)\M', '\1pol', 'g');
  t := regexp_replace(t, '(\d)\s*(mililitros|ml)\M', '\1ml', 'g');
  t := regexp_replace(t, '(\d)\s*(litros|litro|lts|lt|l)\M', '\1l', 'g');
  t := regexp_replace(t, '(\d)\s*(quilos|quilo|kgs|kg)\M', '\1kg', 'g');
  t := regexp_replace(t, '(\d)\s*(gramas|grama|gr|g)\M', '\1g', 'g');
  t := regexp_replace(t, '(\d)\s*(gigabytes|gigas|giga|gb)\M', '\1gb', 'g');
  t := regexp_replace(t, '(\d)\s*(terabytes|tera|tb)\M', '\1tb', 'g');
  t := regexp_replace(t, '(\d)\s*(megabytes|mb)\M', '\1mb', 'g');
  t := regexp_replace(t, '(\d)\s*(watts|watt|w)\M', '\1w', 'g');
  t := regexp_replace(t, '(\d)\s*(mah)\M', '\1mah', 'g');
  t := regexp_replace(t, '(\d)\s*(hz)\M', '\1hz', 'g');
  t := regexp_replace(t, '(\d)\s*(volts|volt|v)\M', '\1v', 'g');
  t := regexp_replace(trim(t), '\s+', ' ', 'g');
  return t;
end;
$$;

/** Primeiro valor da ficha técnica com um dos nomes informados (na ordem de preferência). */
create or replace function public.spec_value(p_specs jsonb, p_names text[])
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select nullif(trim(s ->> 'value'), '')
    from jsonb_array_elements(case when jsonb_typeof(p_specs) = 'array' then p_specs else '[]'::jsonb end) with ordinality e(s, i)
   where s ->> 'name' = any(p_names) and nullif(trim(s ->> 'value'), '') is not null
   order by array_position(p_names, s ->> 'name'), i
   limit 1;
$$;

------------------------------------------------------------------------------
-- 2. Sinônimos (inclusive expressões de várias palavras)
------------------------------------------------------------------------------
create table if not exists public.search_synonyms (
  term text primary key,               -- forma normalizada (search_text), pode ter espaço
  alternatives text[] not null,        -- formas normalizadas aceitas no lugar do termo (sem espaço = compara colado)
  created_at timestamptz not null default now()
);
alter table public.search_synonyms enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'search_synonyms' and policyname = 'Admin full access search_synonyms') then
    create policy "Admin full access search_synonyms" on public.search_synonyms
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- Grupos: cada termo aceita os demais do grupo.
insert into public.search_synonyms (term, alternatives)
select g.term, array(select x from unnest(g.members) x where x <> g.term)
from (
  select unnest(members) as term, members
  from (values
    (array['tv', 'televisao', 'televisor', 'televisores', 'televisoes']),
    (array['celular', 'celulares', 'smartphone', 'smartphones']),
    (array['notebook', 'notebooks', 'laptop', 'laptops']),
    (array['fone', 'fones', 'headphone', 'headset', 'earbuds']),
    (array['geladeira', 'geladeiras', 'refrigerador', 'refrigeradores']),
    (array['fritadeira', 'fritadeiras', 'airfryer']),
    (array['ps5', 'playstation5']),
    (array['ps4', 'playstation4']),
    (array['bike', 'bicicleta']),
    (array['smartwatch', 'relogio inteligente']),
    (array['hd', 'hdd']),
    (array['videogame', 'console'])
  ) as v(members)
) g
where position(' ' in g.term) = 0
on conflict (term) do nothing;

-- Expressões de várias palavras (comparadas coladas: "air fryer" → "airfryer").
insert into public.search_synonyms (term, alternatives) values
  ('air fryer', array['airfryer', 'fritadeira']),
  ('playstation 5', array['playstation5', 'ps5']),
  ('playstation 4', array['playstation4', 'ps4']),
  ('relogio inteligente', array['relogiointeligente', 'smartwatch']),
  ('memoria ram', array['memoriaram', 'ram']),
  ('ar condicionado', array['arcondicionado'])
on conflict (term) do nothing;

------------------------------------------------------------------------------
-- 3. Campos de busca nos produtos
------------------------------------------------------------------------------
alter table public.products
  add column if not exists model text,
  add column if not exists model_code text,
  add column if not exists line text,
  add column if not exists gtins text[] not null default '{}',
  add column if not exists ml_category_id text,
  add column if not exists publish_source text check (publish_source in ('radar', 'catalogo')),
  add column if not exists brand_key text,
  add column if not exists model_key text,
  add column if not exists search_name text,
  add column if not exists search_compact text,
  add column if not exists search_doc text,
  add column if not exists search_cat text,
  add column if not exists search_leaf text,
  add column if not exists search_ids text[] not null default '{}',
  add column if not exists discount_status text,
  add column if not exists discount_status_price numeric,
  add column if not exists discount_status_old numeric,
  add column if not exists discount_status_at timestamptz;

comment on column public.products.publish_source is 'radar = oferta do Radar; catalogo = importação do catálogo (produto pesquisável, não necessariamente em promoção).';
comment on column public.products.search_ids is 'Identificadores normalizados e colados: modelo, código do modelo, marca+modelo, GTIN/EAN e id da loja.';

/**
 * Preenche modelo/linha a partir da ficha técnica e monta os campos normalizados usados pela busca:
 * nome, texto pesquisável (nome, marca, linha, modelo, categoria, categorias da loja e principais
 * características) e a lista de identificadores exatos.
 */
create or replace function public.products_search_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_category text;
  v_path text[];
  v_specs text;
begin
  new.model := coalesce(public.spec_value(new.specs, array['Modelo', 'Modelo detalhado']), nullif(trim(new.model), ''));
  new.model_code := coalesce(public.spec_value(new.specs, array['Modelo alfanumérico', 'Código OEM']), nullif(trim(new.model_code), ''));
  new.line := coalesce(public.spec_value(new.specs, array['Linha']), nullif(trim(new.line), ''));

  select c.name into v_category from public.categories c where c.id = new.category_id;
  if new.ml_category_id is not null then
    select m.path_names into v_path from public.ml_categories m where m.id = new.ml_category_id;
  end if;
  select string_agg(s ->> 'value', ' ') into v_specs
    from jsonb_array_elements(case when jsonb_typeof(new.specs) = 'array' then new.specs else '[]'::jsonb end) s
   where s ->> 'name' in (
     'Cor', 'Capacidade', 'Capacidade de armazenamento', 'Memória interna', 'Memória RAM', 'Tamanho da tela',
     'Voltagem', 'Tipo de memória RAM', 'Capacidade total do módulo de memória RAM', 'Gênero', 'Fragrância',
     'Volume da unidade', 'Peso líquido', 'Potência', 'Tamanho', 'Sabor', 'Modelos de dispositivos móveis compatíveis'
   );

  new.brand_key := public.search_text(new.brand);
  new.model_key := nullif(replace(public.search_text(new.model), ' ', ''), '');
  new.search_name := public.search_text(new.name);
  new.search_compact := replace(new.search_name, ' ', '');
  new.search_cat := public.search_text(concat_ws(' ', v_category, array_to_string(v_path, ' ')));
  new.search_leaf := public.search_text(v_path[array_length(v_path, 1)]);
  new.search_doc := public.search_text(concat_ws(' ', new.name, new.brand, new.line, new.model, new.model_code, v_category, array_to_string(v_path, ' '), v_specs));
  new.search_ids := array(
    select distinct x
    from unnest(array[
      new.model_key,
      replace(public.search_text(new.model_code), ' ', ''),
      replace(public.search_text(concat_ws(' ', new.line, new.model)), ' ', ''),
      replace(public.search_text(concat_ws(' ', new.brand, new.model)), ' ', ''),
      replace(public.search_text(concat_ws(' ', new.brand, new.line, new.model)), ' ', ''),
      lower(new.external_id)
    ] || coalesce(new.gtins, '{}')) x
    where x is not null and length(x) >= 2
  );
  return new;
end;
$$;
revoke all on function public.products_search_fields() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'products_search_fields') then
    create trigger products_search_fields
      before insert or update of name, brand, model, model_code, line, gtins, specs, category_id, ml_category_id, external_id
      on public.products
      for each row execute function public.products_search_fields();
  end if;
end;
$$;

/**
 * Leva para o produto publicado os identificadores que a coleta guarda no candidato
 * (categoria da loja, GTIN/EAN e código do modelo), sem sobrescrever com vazio.
 */
create or replace function public.candidate_sync_product_ids()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_leaf text := case when new.raw ->> 'category_id' ~ '^MLB\d+$' then new.raw ->> 'category_id' end;
  v_gtins text[] := case when jsonb_typeof(new.raw -> 'gtins') = 'array'
    then array(select g from jsonb_array_elements_text(new.raw -> 'gtins') g where g ~ '^\d{8,14}$') else '{}' end;
  v_code text := nullif(trim(new.raw ->> 'model_code'), '');
begin
  update public.products p
     set ml_category_id = coalesce(v_leaf, p.ml_category_id),
         gtins = case when coalesce(array_length(v_gtins, 1), 0) > 0 then v_gtins else p.gtins end,
         model_code = coalesce(p.model_code, v_code)
   where p.id = new.product_id
     and (p.ml_category_id is distinct from coalesce(v_leaf, p.ml_category_id)
       or (coalesce(array_length(v_gtins, 1), 0) > 0 and p.gtins is distinct from v_gtins)
       or (p.model_code is null and v_code is not null));
  return new;
end;
$$;
revoke all on function public.candidate_sync_product_ids() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'candidate_sync_product_ids') then
    create trigger candidate_sync_product_ids
      after insert or update of raw, product_id on public.candidate_products
      for each row when (new.product_id is not null)
      execute function public.candidate_sync_product_ids();
  end if;
end;
$$;

-- Preenchimento inicial: categoria da loja vinda dos candidatos e campos de busca de todos os produtos.
update public.products p
   set ml_category_id = c.raw ->> 'category_id'
  from public.candidate_products c
 where c.product_id = p.id
   and c.raw ->> 'category_id' ~ '^MLB\d+$'
   and p.ml_category_id is distinct from c.raw ->> 'category_id';
update public.products set name = name where search_doc is null;

create index if not exists products_search_doc_trgm on public.products using gin (search_doc extensions.gin_trgm_ops);
create index if not exists products_search_compact_trgm on public.products using gin (search_compact extensions.gin_trgm_ops);
create index if not exists products_search_ids_gin on public.products using gin (search_ids);
create index if not exists products_active_brand_key_idx on public.products (brand_key) where status = 'active';

------------------------------------------------------------------------------
-- 4. Status do desconto armazenado (evita recalcular o histórico a cada listagem)
------------------------------------------------------------------------------
/**
 * Recalcula o status do desconto dos produtos ativos e grava só o que mudou. O status vale apenas
 * enquanto preço e preço anterior forem os mesmos do cálculo (conferido nas consultas públicas):
 * se a coleta mudar o preço, o percentual some até o próximo recálculo (a cada 15 minutos).
 */
create or replace function public.refresh_discount_statuses()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  with calc as (
    select p.id, p.current_price, p.old_price,
           public.product_discount_status(p.id, p.current_price, p.old_price, p.market_offers, p.market_max, p.market_checked_at) as s
      from public.products p
     where p.status = 'active'
  )
  update public.products p
     set discount_status = calc.s,
         discount_status_price = calc.current_price,
         discount_status_old = calc.old_price,
         discount_status_at = now()
    from calc
   where calc.id = p.id
     and (calc.s is distinct from p.discount_status
       or p.discount_status_price is distinct from calc.current_price
       or p.discount_status_old is distinct from calc.old_price);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.refresh_discount_statuses() from public, anon, authenticated;

select public.refresh_discount_statuses();

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'discount-status';
    perform cron.schedule('discount-status', '*/15 * * * *', 'select public.refresh_discount_statuses()');
  end if;
end;
$$;

/** Desconto exibido publicamente: só confirmado/compatível e calculado sobre o preço atual. */
create or replace function public.product_trusted_discount(p public.products)
returns integer
language sql
stable
set search_path = public, pg_temp
as $$
  select case
    when p.discount_status in ('confirmado', 'compativel')
     and p.discount_status_price = p.current_price
     and p.discount_status_old is not distinct from p.old_price
     and p.old_price > p.current_price and p.current_price > 0
    then round(((p.old_price - p.current_price) / p.old_price) * 100)::integer
  end;
$$;
revoke all on function public.product_trusted_discount(public.products) from public, anon, authenticated;

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
    case when d.pct is not null then p.old_price end,
    d.pct,
    p.installments, p.installment_value, p.free_shipping, p.rating, p.reviews_count,
    p.featured, p.trending, p.best_value, p.flash_deal,
    p.created_at, p.updated_at, p.last_price_update
  from public.products p
  join public.categories c on c.id = p.category_id
  join public.marketplaces m on m.id = p.marketplace_id
  cross join lateral (select public.product_trusted_discount(p) as pct) d
  where p.status = 'active'
    and coalesce(p.affiliate_url, '') <> ''
    and (p_product_id is null or p.id = p_product_id);
$$;
revoke all on function public.get_public_products(uuid) from public;
grant execute on function public.get_public_products(uuid) to anon, authenticated;

------------------------------------------------------------------------------
-- 5. Busca
------------------------------------------------------------------------------
/**
 * Produtos publicados que atendem à busca, com a pontuação de relevância. Uso interno.
 *
 * Cada palavra da busca (com plural/singular e sinônimos) precisa aparecer no texto pesquisável:
 * palavras com 3+ letras valem como início de palavra ("note" acha "notebook"); números e códigos
 * valem inteiros ("5" não acha "50"); termos com 5+ caracteres também valem colados ("530 bt" = "530bt").
 * Sem nenhum resultado exato, tenta uma correspondência aproximada (erros leves de digitação),
 * marcada como 'aproximado'. Busca vazia = todos os produtos publicados (para filtrar por categoria/marca).
 *
 * Relevância: identificador exato (modelo, código, GTIN/EAN, id) > marca + modelo > frase no nome >
 * palavras no nome > marca > categoria/características. Acessórios (capa, película, suporte...)
 * perdem pontos quando a busca não pede um acessório.
 */
create or replace function public.search_catalog_match(p_query text)
returns table (id uuid, rank real, match_kind text)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_q text := public.search_text(left(coalesce(p_query, ''), 100));
  v_qc text;
  v_rest text;
  v_groups text[] := '{}';       -- cada item: alternativas separadas por '|'
  v_syn record;
  v_tok text;
  v_alts text[];
  v_extra text[];
  v_alt text;
  v_group text;
  v_optional boolean[] := '{}';  -- especificação com unidade (256gb, 55pol, 4l): dá pontos, mas não é exigida
  v_spec_hits text[] := '{}';
  i integer;
  v_doc_conds text[] := '{}';
  v_name_hits text[] := '{}';
  v_cat_conds text[] := '{}';
  v_doc_or text[];
  v_name_or text[];
  v_cat_or text[];
  v_pattern text;
  v_stop text[] := array['de', 'da', 'do', 'das', 'dos', 'para', 'pra', 'com', 'e', 'o', 'a', 'os', 'as', 'em', 'no', 'na', 'por', 'um', 'uma'];
  v_acc text[] := array['capa', 'capas', 'capinha', 'capinhas', 'pelicula', 'peliculas', 'suporte', 'suportes', 'cabo', 'cabos',
                        'carregador', 'carregadores', 'case', 'adaptador', 'adaptadores', 'protetor', 'estojo', 'refil', 'bolsa', 'controle'];
  v_query_acc boolean;
  v_digits text[];
  v_words text[];
  v_sql text;
  v_found integer := 0;
begin
  if v_q = '' then
    return query
      select p.id, 0::real, 'todos'::text
        from public.products p
       where p.status = 'active' and coalesce(p.affiliate_url, '') <> '';
    return;
  end if;

  v_qc := replace(v_q, ' ', '');
  v_rest := ' ' || v_q || ' ';

  -- Expressões de várias palavras primeiro ("air fryer", "playstation 5").
  for v_syn in select s.term, s.alternatives from public.search_synonyms s where position(' ' in s.term) > 0 order by length(s.term) desc loop
    if position(' ' || v_syn.term || ' ' in v_rest) > 0 then
      v_groups := v_groups || array_to_string(array[replace(v_syn.term, ' ', '')] || v_syn.alternatives, '|');
      v_optional := v_optional || false;
      v_rest := replace(v_rest, ' ' || v_syn.term || ' ', ' ');
    end if;
  end loop;

  for v_tok in select distinct t from unnest(regexp_split_to_array(trim(v_rest), '\s+')) t where t <> '' loop
    continue when v_tok = any(v_stop) and (array_length(v_groups, 1) is not null or v_q <> v_tok);
    v_alts := array[v_tok];
    if v_tok ~ '^[a-z]{5,}$' then
      v_alts := v_alts || case
        when v_tok ~ 'oes$' then regexp_replace(v_tok, 'oes$', 'ao')
        when v_tok ~ 'aes$' then regexp_replace(v_tok, 'aes$', 'ao')
        when v_tok ~ 'eis$' then regexp_replace(v_tok, 'eis$', 'el')
        when v_tok ~ 'ns$' then regexp_replace(v_tok, 'ns$', 'm')
        when v_tok ~ '[^s]s$' then left(v_tok, -1)
        else null end;
    end if;
    select coalesce(array_agg(a), '{}') into v_extra
      from public.search_synonyms s, unnest(s.alternatives) a
     where s.term = any(v_alts);
    v_alts := array(select distinct x from unnest(v_alts || v_extra) x where x is not null and x <> '');
    v_groups := v_groups || array_to_string(v_alts, '|');
    v_optional := v_optional || (v_tok ~ '^\d+(\.\d+)?(gb|tb|mb|g|kg|ml|l|pol|w|mah|hz|v)$');
    exit when coalesce(array_length(v_groups, 1), 0) >= 8;
  end loop;

  if coalesce(array_length(v_groups, 1), 0) = 0 then
    return;
  end if;

  v_query_acc := exists (select 1 from regexp_split_to_table(v_q, ' ') w where w = any(v_acc));
  -- Números e códigos da busca nunca são aproximados ("Galaxy S2" não pode virar "S25").
  v_digits := array(select w from regexp_split_to_table(v_q, ' ') w where w ~ '[0-9]');
  v_words := array(select w from regexp_split_to_table(v_q, ' ') w where w ~ '^[a-z]{3,}$' and not w = any(v_stop));

  -- Só especificações na busca ("256 gb"): aí elas são exigidas.
  if not (false = any(v_optional)) then
    v_optional := array_fill(false, array[array_length(v_groups, 1)]);
  end if;

  for i in 1 .. array_length(v_groups, 1) loop
    v_group := v_groups[i];
    v_doc_or := '{}';
    v_name_or := '{}';
    v_cat_or := '{}';
    foreach v_alt in array string_to_array(v_group, '|') loop
      -- Só [a-z0-9.] chega aqui (search_text); o ponto é escapado para a expressão regular.
      v_pattern := case
        when v_alt ~ '^[a-z]{3,}$' then '\m' || v_alt
        else '\m' || replace(v_alt, '.', '\.') || '\M'
      end;
      v_doc_or := v_doc_or || format('p.search_doc ~ %L', v_pattern);
      v_name_or := v_name_or || format('p.search_name ~ %L', v_pattern);
      v_cat_or := v_cat_or || format('p.search_cat ~ %L', v_pattern);
      if length(v_alt) >= 5 then
        v_doc_or := v_doc_or || format('p.search_compact like %L', '%' || v_alt || '%');
        v_name_or := v_name_or || format('p.search_compact like %L', '%' || v_alt || '%');
      end if;
    end loop;
    if v_optional[i] then
      v_spec_hits := v_spec_hits || ('(case when ' || array_to_string(v_doc_or, ' or ') || ' then 10 else 0 end)');
    else
      v_doc_conds := v_doc_conds || ('(' || array_to_string(v_doc_or, ' or ') || ')');
    end if;
    v_name_hits := v_name_hits || ('(case when ' || array_to_string(v_name_or, ' or ') || ' then 1 else 0 end)');
    v_cat_conds := v_cat_conds || ('(' || array_to_string(v_cat_or, ' or ') || ')');
  end loop;

  v_sql := format($f$
    select p.id,
      ( case when %1$L = any(p.search_ids) then 100 else 0 end
      + case when p.model_key is not null and length(p.model_key) >= 3 and %1$L like '%%' || p.model_key || '%%'
             and p.brand_key <> '' and %2$L like '%% ' || p.brand_key || ' %%' then 40
             when p.model_key is not null and length(p.model_key) >= 3 and %1$L like '%%' || p.model_key || '%%' then 25 else 0 end
      + case when p.search_compact like %3$L then 35 else 0 end
      + case when p.search_name like %4$L then 5 else 0 end
      + (%5$s) * 25.0 / %6$s
      + case when p.brand_key <> '' and %2$L like '%% ' || p.brand_key || ' %%' then 15 else 0 end
      + case when %7$s then 12 else 0 end
      + (%11$s)
      - case when not %8$L and (split_part(p.search_name, ' ', 1) = any(%9$L::text[])
                                or split_part(p.search_name, ' ', 2) = any(%9$L::text[])
                                or coalesce(p.search_leaf, '') ~ '(acessorio|capa|pelicula|suporte|cabo|carregador|peca)')
             then 30 else 0 end
      )::real,
      'exato'::text
    from public.products p
    where p.status = 'active' and coalesce(p.affiliate_url, '') <> ''
      and (%1$L = any(p.search_ids) or (%10$s))
  $f$,
    v_qc,
    ' ' || v_q || ' ',
    '%' || v_qc || '%',
    v_q || '%',
    array_to_string(v_name_hits, ' + '),
    array_length(v_groups, 1),
    '(' || array_to_string(v_cat_conds, ' or ') || ')',
    v_query_acc,
    v_acc,
    array_to_string(v_doc_conds, ' and '),
    coalesce(nullif(array_to_string(v_spec_hits, ' + '), ''), '0')
  );

  return query execute v_sql;
  get diagnostics v_found = row_count;

  -- Nada exato: correspondência aproximada (erro leve de digitação), só para buscas com 4+ caracteres.
  -- Cada palavra precisa ter no produto uma palavra igual ou parecida que comece com a mesma letra
  -- ("samsumg" → "samsung", mas "furadeira" não vira "esmerilhadeira"); números e códigos, só iguais.
  if v_found = 0 and length(v_q) >= 4 and coalesce(array_length(v_words, 1), 0) > 0 then
    perform set_config('pg_trgm.word_similarity_threshold', '0.45', true);
    return query
      select p.id, (extensions.word_similarity(v_q, p.search_doc) * 20)::real, 'aproximado'::text
        from public.products p
       where p.status = 'active' and coalesce(p.affiliate_url, '') <> ''
         and v_q operator(extensions.<%) p.search_doc
         and not exists (select 1 from unnest(v_digits) d where p.search_doc !~ ('\m' || replace(d, '.', '\.') || '\M'))
         and not exists (
           select 1 from unnest(v_words) tok
            where not exists (
              select 1 from unnest(string_to_array(p.search_doc, ' ')) w
               where w = tok or (left(w, 1) = left(tok, 1) and extensions.similarity(w, tok) >= 0.4)
            )
         )
       order by 2 desc
       limit 200;
  end if;
end;
$$;
revoke all on function public.search_catalog_match(text) from public, anon, authenticated;

/**
 * Busca pública com filtros (categoria, marca, loja), ordenação e paginação.
 * Ordens: relevancia (padrão), menor-preco, maior-preco, maior-desconto (só desconto validado), recentes.
 * Devolve os ids na ordem da página e o total de resultados (total_count).
 */
create or replace function public.search_catalog(
  p_query text default null,
  p_category text default null,
  p_brand text default null,
  p_marketplace text default null,
  p_sort text default 'relevancia',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (id uuid, rank real, match_kind text, trusted_discount integer, total_count bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with m as (
    select * from public.search_catalog_match(p_query)
  ),
  f as (
    select m.id, m.rank, m.match_kind, p.current_price, p.published_at, p.created_at, p.last_price_update, p.market_offers,
           public.product_trusted_discount(p) as trusted_discount
      from m
      join public.products p on p.id = m.id
      join public.categories c on c.id = p.category_id
      join public.marketplaces mk on mk.id = p.marketplace_id
     where (nullif(p_category, '') is null or c.slug = p_category)
       and (nullif(p_brand, '') is null or p.brand_key = public.search_text(p_brand))
       and (nullif(p_marketplace, '') is null or mk.slug = p_marketplace)
  )
  select f.id, f.rank, f.match_kind, f.trusted_discount, count(*) over ()
    from f
   order by
     case when p_sort = 'menor-preco' then f.current_price end asc nulls last,
     case when p_sort = 'maior-preco' then f.current_price end desc nulls last,
     case when p_sort = 'maior-desconto' then f.trusted_discount end desc nulls last,
     case when p_sort = 'recentes' then coalesce(f.published_at, f.created_at) end desc nulls last,
     f.rank desc,
     f.market_offers desc nulls last,
     f.last_price_update desc,
     f.id
   limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset least(greatest(coalesce(p_offset, 0), 0), 5000);
$$;
revoke all on function public.search_catalog(text, text, text, text, text, integer, integer) from public;
grant execute on function public.search_catalog(text, text, text, text, text, integer, integer) to anon, authenticated;

/** Filtros disponíveis para uma busca: categorias e marcas com a quantidade de resultados. */
create or replace function public.search_catalog_facets(p_query text default null, p_category text default null, p_brand text default null)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with base as (
    select p.brand, p.brand_key, c.slug, c.name
      from public.search_catalog_match(p_query) m
      join public.products p on p.id = m.id
      join public.categories c on c.id = p.category_id
  )
  select jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('slug', x.slug, 'name', x.name, 'count', x.n) order by x.n desc, x.name)
        from (select slug, name, count(*) as n from base
               where nullif(p_brand, '') is null or brand_key = public.search_text(p_brand)
               group by slug, name) x
    ), '[]'::jsonb),
    'brands', coalesce((
      select jsonb_agg(jsonb_build_object('key', x.brand_key, 'name', x.name, 'count', x.n) order by x.n desc, x.name)
        from (select brand_key, min(brand) as name, count(*) as n from base
               where brand_key <> '' and (nullif(p_category, '') is null or slug = p_category)
               group by brand_key
               order by count(*) desc, min(brand)
               limit 30) x
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.search_catalog_facets(text, text, text) from public;
grant execute on function public.search_catalog_facets(text, text, text) to anon, authenticated;

-- A busca antiga passa a usar a mesma regra (compatibilidade com quem ainda chama por ela).
create or replace function public.search_public_products(p_query text, p_limit integer default 100)
returns table (id uuid, rank real)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id, m.rank
    from public.search_catalog_match(p_query) m
   where coalesce(trim(p_query), '') <> ''
   order by m.rank desc
   limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;
revoke all on function public.search_public_products(text, integer) from public;
grant execute on function public.search_public_products(text, integer) to anon, authenticated;

/** Quantidade de produtos publicados por categoria (sem carregar a lista de produtos). */
create or replace function public.get_public_category_counts()
returns table (category_id uuid, products_count bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.category_id, count(*)
    from public.products p
   where p.status = 'active' and coalesce(p.affiliate_url, '') <> ''
   group by p.category_id;
$$;
revoke all on function public.get_public_category_counts() from public;
grant execute on function public.get_public_category_counts() to anon, authenticated;
