-- 020: link de uma variante escondida na vitrine (019) leva à variante visível do mesmo produto,
-- em vez de 404. Vale também para links já compartilhados e páginas em cache.
-- Só devolve um slug que esteja na vitrine pública (public_products).

create or replace function public.resolve_variant_slug(p_slug text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select v.slug
  from public.products p
  join public.public_products v
    on v.marketplace_id = p.marketplace_id and lower(v.name) = lower(p.name)
  where p.slug = p_slug
    and p.status = 'active'
  limit 1;
$$;

revoke execute on function public.resolve_variant_slug(text) from public;
grant execute on function public.resolve_variant_slug(text) to anon, authenticated;
