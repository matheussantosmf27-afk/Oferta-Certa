-- 007: histórico de preço público (somente produtos ativos; só preço e data).

create or replace function public.get_public_price_history(p_product_id uuid, p_limit integer default 60)
returns table (price numeric, recorded_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select h.price, h.recorded_at
  from public.product_price_history h
  join public.products p on p.id = h.product_id
  where h.product_id = p_product_id
    and p.status = 'active'
  order by h.recorded_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 365);
$$;

revoke execute on function public.get_public_price_history(uuid, integer) from public;
grant execute on function public.get_public_price_history(uuid, integer) to anon, authenticated;
