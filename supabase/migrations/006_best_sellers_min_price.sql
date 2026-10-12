-- 006: mais vendidos por categoria e filtro de preço mínimo por termo do Radar.

-- Categoria equivalente no Mercado Livre (IDs conferidos em /sites/MLB/categories em 12/10/2026).
alter table public.categories
  add column if not exists ml_category_id text check (ml_category_id is null or ml_category_id ~ '^MLB\d+$');

update public.categories c
   set ml_category_id = m.ml_id
  from (values
    ('celulares', 'MLB1051'),
    ('informatica', 'MLB1648'),
    ('tv-e-audio', 'MLB1000'),
    ('eletrodomesticos', 'MLB5726'),
    ('games', 'MLB1144'),
    ('ferramentas', 'MLB263532'),
    ('automotivo', 'MLB5672'),
    ('beleza', 'MLB1246'),
    ('esportes', 'MLB1276'),
    ('casa', 'MLB1574')
  ) as m(slug, ml_id)
 where c.slug = m.slug and c.ml_category_id is null;

-- Preço mínimo por termo: descarta acessórios baratos que não correspondem à busca
-- (ex.: "notebook" trazendo uma capa de R$ 60).
alter table public.radar_search_terms
  add column if not exists min_price numeric check (min_price is null or min_price >= 0);

update public.radar_search_terms t
   set min_price = m.min_price
  from (values
    ('smartphone', 300),
    ('notebook', 1200),
    ('smart tv', 700),
    ('air fryer', 150),
    ('aspirador robo', 300),
    ('ssd', 80),
    ('furadeira', 100)
  ) as m(term, min_price)
 where t.term = m.term and t.min_price is null;
