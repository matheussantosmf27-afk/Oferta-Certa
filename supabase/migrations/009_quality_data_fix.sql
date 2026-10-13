-- 009: correção única dos dados publicados antes das regras da 008 (13/10/2026).
-- Depende do cache public.ml_categories preenchido (a Edge Function v6 mantém esse cache sozinha).

-- 1. Produtos publicados: categoria pela folha real do ML.
update public.products p
   set category_id = r.category_id
  from (
    select cp.product_id, public.ml_resolve_category(cp.raw ->> 'category_id', null) as category_id
      from public.candidate_products cp
     where cp.product_id is not null
  ) r
 where r.product_id = p.id
   and r.category_id is not null
   and r.category_id <> p.category_id;

-- 2. Candidatos pendentes: idem (null = sem categoria, fica na fila manual).
update public.candidate_products cp
   set suggested_category_id = public.ml_resolve_category(cp.raw ->> 'category_id', null)
 where cp.status = 'pending'
   and exists (select 1 from public.ml_categories m where m.id = cp.raw ->> 'category_id')
   and public.ml_resolve_category(cp.raw ->> 'category_id', null) is distinct from cp.suggested_category_id;

-- 3. Publicados automaticamente com desconto acima do novo teto (60%): saem do site.
--    O candidato continua 'approved', então a automação não volta a publicá-los.
update public.products p
   set status = 'inactive',
       inactive_reason = 'regra_qualidade'
 where p.status = 'active'
   and p.publish_mode = 'auto'
   and p.old_price > p.current_price
   and (p.old_price - p.current_price) / p.old_price * 100 > (select auto_publish_max_discount from public.automation_settings where id);
