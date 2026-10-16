-- 017: importação em lote do catálogo (sementes de busca com retomada), novas categorias,
-- publicação de "produtos de catálogo" com validação própria e indicadores de qualidade.
-- Sem DROP e sem apagar dados.

------------------------------------------------------------------------------
-- 1. Novas categorias do site e mapa para as categorias do Mercado Livre
------------------------------------------------------------------------------
-- ids do ML conferidos no cache ml_categories (preenchido pela API /categories) em 15/10/2026,
-- exceto MLB1071 (Animais), conferido na primeira importação.
insert into public.categories (slug, name, description, icon, ml_category_id) values
  ('moda', 'Moda e Calçados', 'Tênis, roupas, bolsas, relógios e acessórios.', '👟', 'MLB1430'),
  ('perfumes', 'Perfumes', 'Perfumes, colônias e body splash.', '🌸', 'MLB6284'),
  ('brinquedos', 'Brinquedos e Bebês', 'Brinquedos, jogos e produtos para bebês.', '🧸', 'MLB1132'),
  ('livros', 'Livros e Papelaria', 'Livros, leitores digitais e material escolar.', '📚', 'MLB1196'),
  ('pets', 'Pet Shop', 'Ração, acessórios e cuidados para pets.', '🐾', 'MLB1071'),
  ('acessorios-celular', 'Acessórios para Celular', 'Carregadores, cabos, capas, películas e power banks.', '🔋', 'MLB3813'),
  ('perifericos', 'Periféricos e Componentes', 'Mouse, teclado, memória, SSD e peças para PC.', '🖱️', 'MLB454379'),
  ('eletroportateis', 'Eletroportáteis', 'Air fryer, cafeteira, liquidificador e outros portáteis.', '☕', 'MLB438284'),
  ('cozinha', 'Cozinha', 'Panelas, utensílios e utilidades domésticas.', '🍳', 'MLB1618'),
  ('saude', 'Saúde e Bem-estar', 'Medidores, termômetros, massageadores e cuidados com a saúde.', '🩺', 'MLB264586')
on conflict (slug) do nothing;

insert into public.ml_category_map (ml_category_id, category_id, note)
select m.ml_id, c.id, m.note
from (values
  ('MLB1430',   'moda',               'Calçados, Roupas e Bolsas'),
  ('MLB3937',   'moda',               'Joias e Relógios'),
  ('MLB6284',   'perfumes',           'Beleza e Cuidado Pessoal > Perfumes'),
  ('MLB1132',   'brinquedos',         'Brinquedos e Hobbies'),
  ('MLB1384',   'brinquedos',         'Bebês'),
  ('MLB1196',   'livros',             'Livros, Revistas e Comics'),
  ('MLB1368',   'livros',             'Arte, Papelaria e Armarinho'),
  ('MLB1071',   'pets',               'Animais'),
  ('MLB3813',   'acessorios-celular', 'Celulares e Telefones > Acessórios para Celulares'),
  ('MLB454379', 'perifericos',        'Informática > Periféricos para PC'),
  ('MLB1712',   'perifericos',        'Informática > Componentes para PC'),
  ('MLB430598', 'perifericos',        'Informática > Armazenamento'),
  ('MLB438284', 'eletroportateis',    'Eletrodomésticos > Pequenos Eletrodomésticos'),
  ('MLB1618',   'cozinha',            'Casa, Móveis e Decoração > Cozinha'),
  ('MLB264586', 'saude',              'Saúde')
) as m(ml_id, slug, note)
join public.categories c on c.slug = m.slug
on conflict (ml_category_id) do nothing;

-- Produtos publicados automaticamente e candidatos pendentes passam para a categoria mais específica.
-- (Publicações manuais mantêm a categoria escolhida no painel.)
update public.products p
   set category_id = r.category_id
  from (
    select x.id, public.ml_resolve_category(x.ml_category_id, null) as category_id
      from public.products x
     where x.ml_category_id is not null and x.publish_mode = 'auto'
  ) r
 where r.id = p.id and r.category_id is not null and r.category_id <> p.category_id;

update public.candidate_products c
   set suggested_category_id = r.category_id
  from (
    select x.id, public.ml_resolve_category(x.raw ->> 'category_id', null) as category_id
      from public.candidate_products x
     where x.status = 'pending' and x.raw ->> 'category_id' ~ '^MLB\d+$'
  ) r
 where r.id = c.id and r.category_id is not null and r.category_id is distinct from c.suggested_category_id;

------------------------------------------------------------------------------
-- 2. Configuração, registro das execuções e sementes de importação
------------------------------------------------------------------------------
alter table public.automation_settings
  add column if not exists catalog_publish_enabled boolean not null default true,
  add column if not exists catalog_publish_max_per_day integer not null default 3000 check (catalog_publish_max_per_day between 0 and 20000);

comment on column public.automation_settings.catalog_publish_enabled is
  'Publica automaticamente produtos de catálogo completos (com marca, imagem, categoria, preço e vendedor conferido), mesmo sem promoção. Depende de auto_publish_enabled.';

alter table public.radar_runs
  add column if not exists stats jsonb,
  add column if not exists dry_run boolean not null default false;

create table if not exists public.catalog_import_seeds (
  id uuid primary key default gen_random_uuid(),
  marketplace_slug text not null default 'mercado-livre',
  query text not null check (length(trim(query)) between 2 and 100),
  category_id uuid references public.categories(id) on delete set null,
  min_price numeric check (min_price is null or min_price >= 0),
  page_size integer not null default 20 check (page_size between 1 and 50),
  max_pages integer not null default 2 check (max_pages between 1 and 10),
  priority integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'done', 'error', 'paused')),
  next_offset integer not null default 0 check (next_offset >= 0),
  next_run_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_error text,
  last_run_at timestamptz,
  last_found integer,
  total_found integer not null default 0,
  total_saved integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.catalog_import_seeds is
  'Buscas usadas na importação do catálogo. Cada execução processa a próxima página; status done reagenda a reimportação (7 dias).';

create unique index if not exists catalog_import_seeds_query_key on public.catalog_import_seeds (marketplace_slug, (public.search_text(query)));
create index if not exists catalog_import_seeds_queue_idx on public.catalog_import_seeds (priority desc, next_run_at) where status = 'pending';
create index if not exists catalog_import_seeds_category_idx on public.catalog_import_seeds (category_id);

alter table public.catalog_import_seeds enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'catalog_import_seeds' and policyname = 'Admin full access catalog_import_seeds') then
    create policy "Admin full access catalog_import_seeds" on public.catalog_import_seeds
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'set_timestamps_catalog_import_seeds') then
    create trigger set_timestamps_catalog_import_seeds
      before insert or update on public.catalog_import_seeds
      for each row execute function public.set_timestamps();
  end if;
end $$;

-- Sementes iniciais: marcas, modelos e tipos de produto por categoria. Preço mínimo descarta
-- acessórios quando a busca é por um aparelho. A prioridade intercala as categorias (a 1ª busca
-- de cada categoria vem antes da 2ª de qualquer uma).
insert into public.catalog_import_seeds (query, category_id, min_price, priority)
select s.query, c.id, s.min_price, 100 - s.position
from (
  select slug, query, min_price, row_number() over (partition by slug order by ord) as position
  from (values
    -- Celulares
    (1, 'celulares', 'Samsung Galaxy S25', 2500), (2, 'celulares', 'Samsung Galaxy S24', 2000), (3, 'celulares', 'Samsung Galaxy A56', 1200),
    (4, 'celulares', 'Samsung Galaxy A36', 1000), (5, 'celulares', 'Samsung Galaxy A16', 600), (6, 'celulares', 'Samsung Galaxy A07', 400),
    (7, 'celulares', 'iPhone 16 Pro', 5000), (8, 'celulares', 'iPhone 16', 3500), (9, 'celulares', 'iPhone 15', 3000), (10, 'celulares', 'iPhone 13', 2000),
    (11, 'celulares', 'Motorola Edge 60', 1500), (12, 'celulares', 'Motorola Moto G85', 900), (13, 'celulares', 'Motorola Moto G35', 600),
    (14, 'celulares', 'Xiaomi Redmi Note 14', 900), (15, 'celulares', 'Xiaomi Redmi 14C', 500), (16, 'celulares', 'Poco X7', 1200), (17, 'celulares', 'Realme C75', 700),
    -- Acessórios para celular
    (1, 'acessorios-celular', 'carregador turbo usb-c', 20), (2, 'acessorios-celular', 'cabo usb-c', 10), (3, 'acessorios-celular', 'capinha iphone 16', 10),
    (4, 'acessorios-celular', 'película galaxy', 5), (5, 'acessorios-celular', 'power bank', 50), (6, 'acessorios-celular', 'suporte celular carro', 15),
    (7, 'acessorios-celular', 'carregador apple 20w', 50),
    -- Informática
    (1, 'informatica', 'notebook Lenovo IdeaPad', 1800), (2, 'informatica', 'notebook Dell Inspiron', 2000), (3, 'informatica', 'notebook Samsung Galaxy Book', 2000),
    (4, 'informatica', 'notebook Acer Aspire', 1800), (5, 'informatica', 'notebook Asus Vivobook', 1800), (6, 'informatica', 'MacBook Air', 5000),
    (7, 'informatica', 'notebook gamer', 3500), (8, 'informatica', 'monitor LG', 400), (9, 'informatica', 'monitor Samsung', 400),
    (10, 'informatica', 'tablet Samsung Galaxy Tab', 700), (11, 'informatica', 'iPad', 2500), (12, 'informatica', 'impressora Epson EcoTank', 700),
    (13, 'informatica', 'roteador wifi 6', 150),
    -- Periféricos e componentes
    (1, 'perifericos', 'memória RAM DDR5 16GB', 200), (2, 'perifericos', 'memória RAM DDR4 8GB', 80), (3, 'perifericos', 'SSD NVMe 1TB', 250),
    (4, 'perifericos', 'SSD 480GB', 120), (5, 'perifericos', 'HD externo 1TB', 250), (6, 'perifericos', 'mouse Logitech', 40),
    (7, 'perifericos', 'teclado mecânico', 100), (8, 'perifericos', 'headset gamer', 80), (9, 'perifericos', 'webcam full hd', 80),
    (10, 'perifericos', 'placa de vídeo RTX 4060', 1500), (11, 'perifericos', 'processador Ryzen 5', 500), (12, 'perifericos', 'pendrive 64GB', 20),
    -- TV e áudio
    (1, 'tv-e-audio', 'smart tv Samsung 55', 1800), (2, 'tv-e-audio', 'smart tv LG 50', 1500), (3, 'tv-e-audio', 'smart tv TCL 43', 1000),
    (4, 'tv-e-audio', 'smart tv 32', 700), (5, 'tv-e-audio', 'smart tv 65 polegadas', 2800), (6, 'tv-e-audio', 'soundbar', 300),
    (7, 'tv-e-audio', 'caixa de som JBL', 150), (8, 'tv-e-audio', 'JBL Tune 520BT', 150), (9, 'tv-e-audio', 'Samsung Galaxy Buds', 250),
    (10, 'tv-e-audio', 'AirPods', 800), (11, 'tv-e-audio', 'fone QCY', 60), (12, 'tv-e-audio', 'Echo Dot', 200), (13, 'tv-e-audio', 'Fire TV Stick', 200),
    (14, 'tv-e-audio', 'Samsung Galaxy Watch', 700), (15, 'tv-e-audio', 'Apple Watch', 1500), (16, 'tv-e-audio', 'Xiaomi Smart Band', 150),
    -- Eletrodomésticos
    (1, 'eletrodomesticos', 'geladeira frost free', 2000), (2, 'eletrodomesticos', 'máquina de lavar 12kg', 1500), (3, 'eletrodomesticos', 'lava e seca', 2500),
    (4, 'eletrodomesticos', 'micro-ondas 30 litros', 500), (5, 'eletrodomesticos', 'fogão 4 bocas', 700), (6, 'eletrodomesticos', 'ar condicionado split 12000 btus', 1500),
    (7, 'eletrodomesticos', 'ventilador de coluna', 100), (8, 'eletrodomesticos', 'aspirador robô', 500), (9, 'eletrodomesticos', 'purificador de água', 400),
    (10, 'eletrodomesticos', 'freezer vertical', 1500), (11, 'eletrodomesticos', 'lava-louças', 1800), (12, 'eletrodomesticos', 'cooktop indução', 500),
    -- Eletroportáteis
    (1, 'eletroportateis', 'air fryer Mondial', 250), (2, 'eletroportateis', 'air fryer Philips Walita', 350), (3, 'eletroportateis', 'air fryer Britânia', 250),
    (4, 'eletroportateis', 'cafeteira Nespresso', 350), (5, 'eletroportateis', 'cafeteira Dolce Gusto', 300), (6, 'eletroportateis', 'liquidificador Oster', 150),
    (7, 'eletroportateis', 'batedeira planetária', 250), (8, 'eletroportateis', 'sanduicheira', 60), (9, 'eletroportateis', 'panela elétrica de arroz', 100),
    (10, 'eletroportateis', 'mixer de mão', 80), (11, 'eletroportateis', 'ferro de passar', 60), (12, 'eletroportateis', 'chaleira elétrica', 50),
    (13, 'eletroportateis', 'secador de cabelo', 80), (14, 'eletroportateis', 'prancha alisadora', 80), (15, 'eletroportateis', 'aspirador vertical', 200),
    -- Games
    (1, 'games', 'PlayStation 5', 3000), (2, 'games', 'Xbox Series S', 2200), (3, 'games', 'Xbox Series X', 3800), (4, 'games', 'Nintendo Switch 2', 3500),
    (5, 'games', 'Nintendo Switch OLED', 2000), (6, 'games', 'controle DualSense', 300), (7, 'games', 'controle Xbox', 300), (8, 'games', 'jogo PS5', 100),
    (9, 'games', 'cadeira gamer', 500),
    -- Automotivo
    (1, 'automotivo', 'pneu aro 14', 200), (2, 'automotivo', 'pneu aro 15', 250), (3, 'automotivo', 'central multimídia', 300), (4, 'automotivo', 'câmera de ré', 60),
    (5, 'automotivo', 'aspirador automotivo', 80), (6, 'automotivo', 'compressor de ar portátil', 100), (7, 'automotivo', 'bateria automotiva 60ah', 350),
    (8, 'automotivo', 'som automotivo Pioneer', 300), (9, 'automotivo', 'capacete moto', 150), (10, 'automotivo', 'lâmpada led farol', 50),
    -- Ferramentas
    (1, 'ferramentas', 'furadeira Bosch', 250), (2, 'ferramentas', 'parafusadeira Bosch', 250), (3, 'ferramentas', 'furadeira Makita', 300),
    (4, 'ferramentas', 'parafusadeira DeWalt', 500), (5, 'ferramentas', 'lixadeira', 150), (6, 'ferramentas', 'serra mármore', 200),
    (7, 'ferramentas', 'esmerilhadeira', 200), (8, 'ferramentas', 'jogo de chaves', 50), (9, 'ferramentas', 'maleta de ferramentas', 100),
    (10, 'ferramentas', 'lavadora de alta pressão Wap', 300), (11, 'ferramentas', 'lavadora de alta pressão Karcher', 400), (12, 'ferramentas', 'trena a laser', 100),
    (13, 'ferramentas', 'escada de alumínio', 150), (14, 'ferramentas', 'multímetro digital', 50),
    -- Casa, móveis e decoração
    (1, 'casa', 'colchão casal', 800), (2, 'casa', 'cadeira de escritório', 300), (3, 'casa', 'mesa de escritório', 250), (4, 'casa', 'guarda-roupa casal', 700),
    (5, 'casa', 'rack para tv', 250), (6, 'casa', 'sofá retrátil', 1200), (7, 'casa', 'cama box casal', 800), (8, 'casa', 'escrivaninha', 200),
    (9, 'casa', 'travesseiro', 40), (10, 'casa', 'jogo de cama casal', 80), (11, 'casa', 'cortina blackout', 60), (12, 'casa', 'tapete para sala', 100),
    (13, 'casa', 'lâmpada inteligente', 40), (14, 'casa', 'edredom casal', 100),
    -- Cozinha
    (1, 'cozinha', 'jogo de panelas Tramontina', 200), (2, 'cozinha', 'panela de pressão', 100), (3, 'cozinha', 'frigideira antiaderente', 60),
    (4, 'cozinha', 'jogo de facas', 60), (5, 'cozinha', 'garrafa térmica', 40), (6, 'cozinha', 'potes herméticos', 40), (7, 'cozinha', 'faqueiro inox', 80),
    (8, 'cozinha', 'escorredor de louças', 50), (9, 'cozinha', 'jogo de copos', 40),
    -- Moda e calçados
    (1, 'moda', 'tênis Nike Air Max', 300), (2, 'moda', 'tênis Adidas', 250), (3, 'moda', 'tênis Olympikus', 150), (4, 'moda', 'tênis Mizuno', 300),
    (5, 'moda', 'tênis Puma', 250), (6, 'moda', 'chinelo Havaianas', 30), (7, 'moda', 'mochila', 80), (8, 'moda', 'relógio Casio', 150),
    (9, 'moda', 'óculos de sol Ray-Ban', 300), (10, 'moda', 'bolsa feminina', 100), (11, 'moda', 'jaqueta corta vento', 80),
    -- Beleza e cuidados pessoais
    (1, 'beleza', 'protetor solar', 30), (2, 'beleza', 'kit shampoo e condicionador', 40), (3, 'beleza', 'base líquida', 30), (4, 'beleza', 'escova secadora', 150),
    (5, 'beleza', 'sérum vitamina c', 40), (6, 'beleza', 'hidratante facial', 30), (7, 'beleza', 'kit maquiagem', 50), (8, 'beleza', 'barbeador elétrico Philips', 100),
    -- Perfumes
    (1, 'perfumes', 'perfume Malbec', 100), (2, 'perfumes', 'perfume Natura Essencial', 100), (3, 'perfumes', 'perfume Lattafa', 150),
    (4, 'perfumes', 'perfume Carolina Herrera 212', 300), (5, 'perfumes', 'perfume Paco Rabanne', 300), (6, 'perfumes', 'perfume Dior Sauvage', 400),
    (7, 'perfumes', 'perfume Boticário Lily', 150), (8, 'perfumes', 'perfume Natura Kaiak', 80), (9, 'perfumes', 'body splash', 30),
    (10, 'perfumes', 'perfume árabe', 150), (11, 'perfumes', 'perfume Azzaro', 250),
    -- Esportes
    (1, 'esportes', 'creatina 300g', 60), (2, 'esportes', 'whey protein', 80), (3, 'esportes', 'bicicleta aro 29', 800), (4, 'esportes', 'esteira elétrica', 1200),
    (5, 'esportes', 'bicicleta ergométrica', 700), (6, 'esportes', 'halteres', 50), (7, 'esportes', 'kettlebell', 50), (8, 'esportes', 'tapete de yoga', 40),
    (9, 'esportes', 'bola de futebol', 50), (10, 'esportes', 'patinete elétrico', 1200), (11, 'esportes', 'barraca camping', 150), (12, 'esportes', 'pré-treino', 50),
    -- Brinquedos e bebês
    (1, 'brinquedos', 'LEGO', 100), (2, 'brinquedos', 'boneca Barbie', 60), (3, 'brinquedos', 'Hot Wheels', 20), (4, 'brinquedos', 'carrinho de controle remoto', 100),
    (5, 'brinquedos', 'quebra-cabeça', 30), (6, 'brinquedos', 'jogo de tabuleiro', 60), (7, 'brinquedos', 'pelúcia', 40), (8, 'brinquedos', 'carrinho de bebê', 400),
    (9, 'brinquedos', 'cadeirinha de carro infantil', 300), (10, 'brinquedos', 'fralda Pampers', 50), (11, 'brinquedos', 'bicicleta infantil', 250), (12, 'brinquedos', 'Nerf', 80),
    -- Livros e papelaria
    (1, 'livros', 'Kindle', 400), (2, 'livros', 'livro Harry Potter', 30), (3, 'livros', 'livro Hábitos Atômicos', 30), (4, 'livros', 'livro O Pequeno Príncipe', 15),
    (5, 'livros', 'caderno universitário', 20), (6, 'livros', 'mochila escolar', 60), (7, 'livros', 'agenda 2026', 25), (8, 'livros', 'marca texto', 15),
    (9, 'livros', 'livro de colorir', 15), (10, 'livros', 'Bíblia', 30),
    -- Pet shop
    (1, 'pets', 'ração Golden', 60), (2, 'pets', 'ração Premier', 80), (3, 'pets', 'ração Royal Canin', 120), (4, 'pets', 'areia para gato', 30),
    (5, 'pets', 'arranhador para gato', 50), (6, 'pets', 'cama para cachorro', 50), (7, 'pets', 'coleira', 20), (8, 'pets', 'comedouro automático', 100),
    (9, 'pets', 'tapete higiênico', 40), (10, 'pets', 'caixa de transporte pet', 80),
    -- Saúde e bem-estar
    (1, 'saude', 'medidor de pressão', 80), (2, 'saude', 'termômetro digital', 20), (3, 'saude', 'oxímetro', 50), (4, 'saude', 'massageador elétrico', 80),
    (5, 'saude', 'balança digital banheiro', 40), (6, 'saude', 'escova de dentes elétrica Oral-B', 100), (7, 'saude', 'nebulizador', 80),
    (8, 'saude', 'vitamina D', 20), (9, 'saude', 'ômega 3', 30), (10, 'saude', 'colágeno', 40)
  ) as v(ord, slug, query, min_price)
) s
join public.categories c on c.slug = s.slug
on conflict do nothing;

------------------------------------------------------------------------------
-- 3. Publicação de produto de catálogo (sem exigir promoção)
------------------------------------------------------------------------------
/**
 * Publica um candidato como produto de catálogo: precisa estar completo (marca, imagem, categoria,
 * preço), ser novo, ter o vendedor conferido nas últimas 6 horas e o link de afiliado da loja.
 * Não exige desconto: o percentual só aparece no site quando corroborado (product_discount_status).
 * Limite diário próprio (catalog_publish_max_per_day), separado da publicação de ofertas do Radar.
 */
create or replace function public.publish_catalog_candidate_internal(
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
  v_params text[];
  v_day_count integer;
  v_alerts jsonb;
  v_product_id uuid;
begin
  select * into s from public.automation_settings where id for share;
  if not found or not s.auto_publish_enabled or not s.catalog_publish_enabled then
    raise exception 'Publicação do catálogo desligada';
  end if;

  select * into c from public.candidate_products where id = p_candidate_id for update;
  if not found then
    raise exception 'Candidato não encontrado';
  end if;
  select slug into v_slug from public.marketplaces where id = c.marketplace_id;
  v_alerts := coalesce(c.score_breakdown -> '_alertas', '[]'::jsonb);

  if c.status <> 'pending' or c.is_demo or c.product_id is not null then
    raise exception 'Candidato não está pendente';
  end if;
  if coalesce(trim(c.image_url), '') = '' or c.price is null or c.price <= 0 then
    raise exception 'Candidato sem imagem ou preço';
  end if;
  if coalesce(trim(c.brand), '') = '' then
    raise exception 'Candidato sem marca';
  end if;
  if c.suggested_category_id is null then
    raise exception 'Candidato sem categoria';
  end if;
  if c.condition is not null and c.condition <> 'new' then
    raise exception 'Produto não é novo';
  end if;
  if v_alerts ? 'desconto_suspeito' or v_alerts ? 'titulo_estrangeiro' then
    raise exception 'Candidato com alerta de qualidade';
  end if;
  if c.discount_pct is not null and c.discount_pct > s.auto_publish_max_discount then
    raise exception 'Desconto acima do limite';
  end if;
  if c.last_seen_at is null or c.last_seen_at < now() - interval '6 hours' then
    raise exception 'Vendedor não confirmado nas últimas 6 horas';
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
    if c.affiliate_url is null or v_url <> c.affiliate_url then
      raise exception 'Link de afiliado diferente do gerado pela API da loja';
    end if;
  end if;

  if exists (select 1 from public.products p where p.marketplace_id = c.marketplace_id and p.external_id = c.external_id) then
    raise exception 'Produto já existe no catálogo';
  end if;

  select count(*) into v_day_count from public.products
   where publish_source = 'catalogo'
     and published_at >= (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo');
  if v_day_count >= s.catalog_publish_max_per_day then
    raise exception 'Limite diário do catálogo atingido';
  end if;

  v_product_id := public.publish_candidate_core(c.id, v_url, c.suggested_category_id, null, 'auto', null, p_run_id);
  update public.products set publish_source = 'catalogo' where id = v_product_id;
  return v_product_id;
end;
$$;
revoke execute on function public.publish_catalog_candidate_internal(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.publish_catalog_candidate_internal(uuid, text, uuid) to service_role;

-- Publicação automática de ofertas do Radar: os limites passam a contar só as ofertas (não o catálogo).
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
    if c.affiliate_url is null or v_url <> c.affiliate_url then
      raise exception 'Link de afiliado diferente do gerado pela API da loja';
    end if;
  end if;

  if exists (select 1 from public.products p where p.marketplace_id = c.marketplace_id and p.external_id = c.external_id) then
    raise exception 'Produto já existe no catálogo';
  end if;

  select count(*) into v_run_count from public.products
   where publish_mode = 'auto' and published_run_id = p_run_id and coalesce(publish_source, 'radar') = 'radar';
  if v_run_count >= s.auto_publish_max_per_run then
    raise exception 'Limite por execução atingido';
  end if;
  select count(*) into v_day_count from public.products
   where publish_mode = 'auto' and coalesce(publish_source, 'radar') = 'radar'
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
-- 4. Agendamento da importação (a cada 10 minutos, fora dos horários das outras coletas)
------------------------------------------------------------------------------
create or replace function public.radar_invoke_catalog(p_trigger text default 'schedule', p_dry_run boolean default false)
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
    body := jsonb_build_object('trigger', coalesce(p_trigger, 'schedule'), 'source', 'catalogo', 'dry_run', coalesce(p_dry_run, false)),
    timeout_milliseconds := 150000
  ) into v_request;
  return v_request;
end;
$$;
revoke all on function public.radar_invoke_catalog(text, boolean) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'catalog-import';
    perform cron.schedule('catalog-import', '3-59/10 * * * *', 'select public.radar_invoke_catalog()');
  end if;
end;
$$;

------------------------------------------------------------------------------
-- 5. Qualidade do catálogo (painel)
------------------------------------------------------------------------------
/** Registros incompletos e distribuição do catálogo, para o painel. Só administradores. */
create or replace function public.get_catalog_quality()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;
  return jsonb_build_object(
    'published', (select count(*) from public.products where status = 'active' and coalesce(affiliate_url, '') <> ''),
    'by_source', coalesce((select jsonb_object_agg(k, n) from (
       select coalesce(publish_source, case when publish_mode = 'manual' then 'manual' else 'radar' end) as k, count(*) as n
         from public.products where status = 'active' group by 1) x), '{}'::jsonb),
    'with_trusted_discount', (select count(*) from public.products p where p.status = 'active' and public.product_trusted_discount(p) is not null),
    'products_missing', jsonb_build_object(
      'marca', (select count(*) from public.products where status = 'active' and coalesce(trim(brand), '') = ''),
      'imagem', (select count(*) from public.products where status = 'active' and coalesce(trim(image_url), '') = ''),
      'modelo', (select count(*) from public.products where status = 'active' and model is null),
      'descricao', (select count(*) from public.products where status = 'active' and coalesce(trim(description), '') = ''),
      'categoria_da_loja', (select count(*) from public.products p join public.marketplaces m on m.id = p.marketplace_id
                              where p.status = 'active' and m.slug = 'mercado-livre' and p.ml_category_id is null)
    ),
    'candidates_pending', (select count(*) from public.candidate_products where status = 'pending' and not is_demo),
    'candidates_incomplete', jsonb_build_object(
      'sem_marca', (select count(*) from public.candidate_products where status = 'pending' and not is_demo and coalesce(trim(brand), '') = ''),
      'sem_imagem', (select count(*) from public.candidate_products where status = 'pending' and not is_demo and coalesce(trim(image_url), '') = ''),
      'sem_categoria', (select count(*) from public.candidate_products where status = 'pending' and not is_demo and suggested_category_id is null),
      'usado', (select count(*) from public.candidate_products where status = 'pending' and not is_demo and condition is not null and condition <> 'new')
    ),
    'seeds', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) as n from public.catalog_import_seeds group by status) x), '{}'::jsonb)
  );
end;
$$;
revoke all on function public.get_catalog_quality() from public, anon;
grant execute on function public.get_catalog_quality() to authenticated;
