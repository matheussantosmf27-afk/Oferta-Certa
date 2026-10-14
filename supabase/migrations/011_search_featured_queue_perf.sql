-- 011: busca sem acento, destaques automáticos, limpeza da fila do Radar e ajustes de desempenho.
-- Sem DROP: tudo é create or replace / if not exists / alter policy.

/* ------------------------------ Busca sem acento ------------------------------ */

-- Texto normalizado (minúsculo, sem acento) para comparar buscas.
create or replace function public.search_normalize(p_text text)
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select lower(extensions.unaccent(coalesce(p_text, '')));
$$;

/**
 * Produtos ativos que contêm TODAS as palavras da busca (ignorando acento e maiúsculas)
 * no nome, marca, categoria ou descrição. rank: nome pesa mais que o resto.
 */
create or replace function public.search_public_products(p_query text, p_limit integer default 100)
returns table (id uuid, rank real)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  with words as (
    select distinct w
    from unnest(regexp_split_to_array(public.search_normalize(left(coalesce(p_query, ''), 80)), '[^a-z0-9]+')) w
    where length(w) >= 2
    limit 8
  ),
  docs as (
    select
      p.id,
      public.search_normalize(p.name) as name_n,
      public.search_normalize(concat_ws(' ', p.name, p.brand, c.name, p.short_description, p.description)) as doc_n,
      p.last_price_update
    from public.products p
    join public.categories c on c.id = p.category_id
    where p.status = 'active' and coalesce(p.affiliate_url, '') <> ''
  )
  select d.id,
    (
      (select count(*) from words where d.name_n like '%' || w || '%')::real * 2
      + case when d.name_n like '%' || public.search_normalize(trim(p_query)) || '%' then 3 else 0 end
    ) as rank
  from docs d
  where exists (select 1 from words)
    and not exists (select 1 from words where d.doc_n not like '%' || w || '%')
  order by rank desc, d.last_price_update desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

revoke all on function public.search_public_products(text, integer) from public;
grant execute on function public.search_public_products(text, integer) to anon, authenticated;

/* ---------------------------- Destaques automáticos ---------------------------- */

-- 'auto' = escolhido pela rotina; null = marcado à mão no painel (nunca é desfeito pela rotina).
alter table public.products add column if not exists featured_source text;

/**
 * Escolhe até 8 destaques entre os produtos publicados com melhor pontuação no Radar,
 * no máximo 2 por categoria, com desconto real entre 10% e 60% e descrição preenchida.
 * Destaques marcados à mão continuam como estão.
 */
create or replace function public.refresh_auto_featured()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.products set featured = false, featured_source = null, updated_at = now()
  where featured_source = 'auto';

  with scored as (
    select p.id, p.category_id, max(cp.score) as score
    from public.products p
    join public.candidate_products cp on cp.product_id = p.id
    where p.status = 'active'
      and not p.featured
      and coalesce(p.affiliate_url, '') <> ''
      and coalesce(p.description, '') <> ''
      and p.old_price > p.current_price
      and (p.old_price - p.current_price) / p.old_price between 0.10 and 0.60
    group by p.id, p.category_id
  ),
  ranked as (
    select id, score, row_number() over (partition by category_id order by score desc) as pos
    from scored
  ),
  chosen as (
    select id from ranked where pos <= 2 order by score desc limit 8
  )
  update public.products p set featured = true, featured_source = 'auto', updated_at = now()
  from chosen where p.id = chosen.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.refresh_auto_featured() from public, anon, authenticated;

/* ------------------------------ Limpeza da fila ------------------------------ */

/**
 * Remove da fila candidatos pendentes que o Radar não encontra há 14 dias (oferta sumiu).
 * Nunca toca em aprovados, rejeitados ou já publicados; se a oferta voltar, o Radar recria o candidato.
 */
create or replace function public.radar_cleanup_queue()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  delete from public.candidate_products
  where status = 'pending'
    and product_id is null
    and last_seen_at < now() - interval '14 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.radar_cleanup_queue() from public, anon, authenticated;

do $$
begin
  perform cron.schedule('radar-queue-cleanup', '40 4 * * *', 'select public.radar_cleanup_queue();');
  perform cron.schedule('auto-featured', '20 */6 * * *', 'select public.refresh_auto_featured();');
end;
$$;

/* --------------------------------- Desempenho --------------------------------- */

create index if not exists candidate_products_product_id_idx on public.candidate_products (product_id);
create index if not exists candidate_products_suggested_category_id_idx on public.candidate_products (suggested_category_id);
create index if not exists favorites_product_id_idx on public.favorites (product_id);
create index if not exists products_coupon_id_idx on public.products (coupon_id);
create index if not exists radar_best_seller_sources_category_id_idx on public.radar_best_seller_sources (category_id);
create index if not exists radar_search_terms_category_id_idx on public.radar_search_terms (category_id);
create index if not exists ml_category_map_category_id_idx on public.ml_category_map (category_id);

-- auth.uid()/auth.role() avaliados uma vez por consulta, não por linha.
alter policy "Self select profiles" on public.profiles using ((select auth.uid()) = id);
alter policy "Self insert profiles" on public.profiles with check (
  (select auth.role()) = 'authenticated' and (select auth.uid()) = id and role = 'user'::profile_role
  and email is not null and email <> ''
);
alter policy "Self update profiles" on public.profiles
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id and role = 'user'::profile_role and email is not null and email <> '');
alter policy "Self select favorites" on public.favorites using ((select auth.uid()) = user_id);
alter policy "Self insert favorites" on public.favorites with check ((select auth.uid()) = user_id);
alter policy "Self delete favorites" on public.favorites using ((select auth.uid()) = user_id);
alter policy "Allow insert newsletter subscribers" on public.newsletter_subscribers with check (
  (select auth.role()) = any (array['anon', 'authenticated'])
  and email is not null and email <> ''
  and email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
);

-- Primeira seleção de destaques e limpeza já agora.
select public.refresh_auto_featured();
select public.radar_cleanup_queue();
