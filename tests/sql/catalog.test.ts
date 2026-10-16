// @vitest-environment node
// Importação do catálogo no banco: gravação idempotente (radar_upsert_candidates), publicação de
// produto de catálogo (publish_catalog_candidate_internal) e separação entre candidatos, catálogo e
// ofertas. Usa as funções reais das migrations num Postgres em memória, com dados de teste.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, migration, migrationFunction, type TestDb } from './harness'

const EXTRA_SCHEMA = `
create table auth.users (id uuid primary key);
create type public.candidate_status as enum ('pending', 'approved', 'rejected');
create function public.set_timestamps() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then new.created_at := now(); end if;
  new.updated_at := now();
  return new;
end $$;
drop table public.candidate_products;
create table public.radar_runs (id uuid primary key default gen_random_uuid(), trigger text not null default 'schedule', status text not null default 'running',
  started_at timestamptz not null default now(), finished_at timestamptz, source text);
create table public.candidate_products (
  id uuid primary key default gen_random_uuid(), marketplace_id uuid not null references public.marketplaces(id), external_id text not null,
  title text not null, permalink text not null, image_url text, price numeric not null, original_price numeric, currency text not null default 'BRL',
  free_shipping boolean not null default false, rating numeric, reviews_count integer, sold_quantity integer, condition text, brand text, search_term text,
  suggested_category_id uuid references public.categories(id), score numeric not null default 0, score_breakdown jsonb not null default '{}',
  is_demo boolean not null default false, status public.candidate_status not null default 'pending', affiliate_url text,
  product_id uuid references public.products(id) on delete set null, rejection_reason text, reviewed_by uuid, reviewed_at timestamptz, raw jsonb,
  times_seen integer not null default 1, first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  discount_pct numeric generated always as (case when original_price is not null and original_price > price and original_price > 0
    then round(((original_price - price) / original_price) * 100, 1) else null end) stored,
  publish_mode text, published_by uuid, last_run_id uuid references public.radar_runs(id), description text,
  features text[] not null default '{}', specs jsonb not null default '[]', gallery text[] not null default '{}',
  unique (marketplace_id, external_id)
);
alter table public.products add column published_by uuid, add column missing_offer_count integer not null default 0, add column inactive_reason text,
  add column source_url text;
create table public.automation_settings (
  id boolean primary key default true check (id), auto_publish_enabled boolean not null default false,
  auto_publish_min_score numeric not null default 40, auto_publish_max_per_run integer not null default 20, auto_publish_max_per_day integer not null default 100,
  auto_publish_max_discount numeric not null default 70, auto_publish_block_foreign_titles boolean not null default true,
  ml_matt_word text, ml_matt_tool text, updated_by uuid, created_at timestamptz default now(), updated_at timestamptz default now()
);
insert into public.automation_settings (id, auto_publish_enabled, ml_matt_word, ml_matt_tool) values (true, true, 'teste', '123');
`

let t: TestDb
let runId: string
let categoryId: string
const TAG = 'matt_word=teste&matt_tool=123'

function item(id: string, overrides: Record<string, unknown> = {}) {
  return {
    external_id: id,
    title: `Produto de teste ${id}`,
    permalink: `https://www.mercadolivre.com.br/p/${id}`,
    image_url: `https://http2.mlstatic.com/${id}.jpg`,
    price: 100,
    original_price: null,
    condition: 'new',
    brand: 'MarcaTeste',
    score: 20,
    score_breakdown: { desconto: 0, _alertas: ['sem_preco_anterior'] },
    raw: { category_id: null, gtins: ['7890000000017'], model_code: 'MT-01' },
    specs: [{ name: 'Modelo', value: 'MT 01' }],
    ...overrides,
  }
}

async function upsert(items: unknown[]) {
  const [row] = await t.q<{ n: number }>("select public.radar_upsert_candidates('mercado-livre', 'catálogo: teste', $1, $2::jsonb, $3) n", [
    categoryId,
    JSON.stringify(items),
    runId,
  ])
  return row.n
}

async function publishCatalog(externalId: string, url?: string) {
  const [candidate] = await t.q<{ id: string; permalink: string }>('select id, permalink from candidate_products where external_id = $1', [externalId])
  const [row] = await t.q<{ id: string }>('select public.publish_catalog_candidate_internal($1, $2, $3) id', [
    candidate.id,
    url ?? `${candidate.permalink}?${TAG}`,
    runId,
  ])
  return row.id
}

beforeAll(async () => {
  t = await createTestDb([
    EXTRA_SCHEMA,
    migrationFunction('003_radar_accounts_favorites.sql', 'create or replace function public.slugify('),
    migrationFunction('008_quality_rules_category_map.sql', 'create or replace function public.ml_resolve_category('),
    migrationFunction('010_rich_catalog_best_seller_sources.sql', 'create or replace function public.fill_product_content('),
    migrationFunction('005_auto_publish.sql', 'create or replace function public.publish_candidate_core('),
    migrationFunction('012_partner_marketplaces.sql', 'create or replace function public.radar_upsert_candidates('),
    migrationFunction('014_trusted_discounts_radar_status.sql', 'create or replace function public.product_discount_status('),
    migration('016_smart_search.sql'),
  ])
  await t.q("insert into marketplaces (slug, name, affiliate_hosts) values ('mercado-livre', 'Mercado Livre', '{mercadolivre.com.br}')")
  for (const slug of ['celulares', 'beleza', 'casa', 'eletrodomesticos', 'informatica', 'tv-e-audio', 'automotivo', 'esportes', 'ferramentas', 'games']) {
    await t.q('insert into categories (slug, name) values ($1, $1)', [slug])
  }
  await t.db.exec(migration('017_catalog_import.sql'))
  categoryId = (await t.q<{ id: string }>("select id from categories where slug = 'casa'"))[0].id
}, 60_000)

beforeEach(async () => {
  runId = (await t.q<{ id: string }>("insert into radar_runs (trigger, status, source) values ('manual', 'success', 'catalogo') returning id"))[0].id
})

describe('migration 017', () => {
  it('cria as novas categorias e as sementes, sem duplicar ao rodar de novo', async () => {
    const before = await t.q<{ n: string }>('select count(*) n from catalog_import_seeds')
    expect(Number(before[0].n)).toBe(232)
    const categories = await t.q<{ slug: string }>("select slug from categories where slug in ('moda','perfumes','pets','livros','brinquedos','saude')")
    expect(categories).toHaveLength(6)
    // Reaplicar a migration não duplica sementes, categorias nem mapas.
    await t.db.exec(migration('017_catalog_import.sql'))
    const after = await t.q<{ n: string }>('select count(*) n from catalog_import_seeds')
    expect(Number(after[0].n)).toBe(232)
    const dupes = await t.q("select search_text(query) q from catalog_import_seeds group by 1 having count(*) > 1")
    expect(dupes).toEqual([])
  })
})

describe('importação idempotente', () => {
  it('a mesma página gravada duas vezes não cria duplicatas', async () => {
    expect(await upsert([item('MLBT1'), item('MLBT2')])).toBe(2)
    expect(await upsert([item('MLBT1', { price: 90 }), item('MLBT2')])).toBe(2)
    const rows = await t.q<{ external_id: string; price: string; times_seen: number }>(
      "select external_id, price, times_seen from candidate_products where external_id like 'MLBT%' order by 1"
    )
    expect(rows.map((r) => [r.external_id, Number(r.price), r.times_seen])).toEqual([
      ['MLBT1', 90, 2],
      ['MLBT2', 100, 2],
    ])
  })

  it('candidato não é produto: nada aparece no site antes da publicação', async () => {
    await upsert([item('MLBT3')])
    const visible = await t.q("select * from search_catalog('Produto de teste MLBT3')")
    expect(visible).toEqual([])
  })
})

describe('publicação de produto de catálogo', () => {
  it('produto completo sem promoção é publicado e fica pesquisável, sem selo de desconto', async () => {
    await upsert([item('MLBT10')])
    const productId = await publishCatalog('MLBT10')
    const [product] = await t.q<{ publish_source: string; publish_mode: string; gtins: string[]; model_code: string; affiliate_url: string }>(
      'select publish_source, publish_mode, gtins, model_code, affiliate_url from products where id = $1',
      [productId]
    )
    expect(product.publish_source).toBe('catalogo')
    expect(product.publish_mode).toBe('auto')
    expect(product.affiliate_url).toContain('matt_tool=123')
    // Identificadores levados do candidato para a busca por código.
    expect(product.gtins).toEqual(['7890000000017'])
    expect(product.model_code).toBe('MT-01')
    const [found] = await t.q<{ id: string; trusted_discount: number | null }>("select * from search_catalog('7890000000017')")
    expect(found.id).toBe(productId)
    expect(found.trusted_discount).toBeNull()
    const [byCode] = await t.q<{ id: string }>("select * from search_catalog('mt-01')")
    expect(byCode.id).toBe(productId)
  })

  it('publicar de novo o mesmo produto é recusado (sem duplicar)', async () => {
    await upsert([item('MLBT11')])
    await publishCatalog('MLBT11')
    await expect(publishCatalog('MLBT11')).rejects.toThrow(/não está pendente/)
    const [count] = await t.q<{ n: string }>("select count(*) n from products where external_id = 'MLBT11'")
    expect(Number(count.n)).toBe(1)
  })

  it.each([
    ['sem marca', { brand: '' }, /sem marca/],
    ['sem imagem', { image_url: null }, /sem imagem/],
    ['usado', { condition: 'used' }, /não é novo/],
    ['título estrangeiro', { score_breakdown: { _alertas: ['titulo_estrangeiro'] } }, /alerta de qualidade/],
    ['desconto suspeito', { original_price: 1000, score_breakdown: { _alertas: ['desconto_suspeito'] } }, /alerta de qualidade/],
  ])('incompleto (%s) fica na fila', async (_label, overrides, error) => {
    const id = `MLBQ${Math.random().toString(36).slice(2, 8)}`
    await upsert([item(id, overrides)])
    await expect(publishCatalog(id)).rejects.toThrow(error)
    const [candidate] = await t.q<{ status: string; product_id: string | null }>('select status, product_id from candidate_products where external_id = $1', [id])
    expect(candidate).toEqual({ status: 'pending', product_id: null })
  })

  it('dados de demonstração nunca são publicados', async () => {
    await upsert([item('MLBDEMO')])
    await t.q("update candidate_products set is_demo = true where external_id = 'MLBDEMO'")
    await expect(publishCatalog('MLBDEMO')).rejects.toThrow(/não está pendente/)
    expect(await t.q("select 1 from products where external_id = 'MLBDEMO'")).toEqual([])
  })

  it('exige vendedor conferido nas últimas 6 horas e o link com a etiqueta de afiliado', async () => {
    await upsert([item('MLBT20'), item('MLBT21')])
    await t.q("update candidate_products set last_seen_at = now() - interval '7 hours' where external_id = 'MLBT20'")
    await expect(publishCatalog('MLBT20')).rejects.toThrow(/Vendedor não confirmado/)
    await expect(publishCatalog('MLBT21', 'https://www.mercadolivre.com.br/p/MLBT21?matt_word=outro&matt_tool=999')).rejects.toThrow(/etiqueta/)
  })

  it('respeita o interruptor e o limite diário próprio do catálogo', async () => {
    await upsert([item('MLBT30'), item('MLBT31')])
    await t.q('update automation_settings set catalog_publish_enabled = false')
    await expect(publishCatalog('MLBT30')).rejects.toThrow(/desligada/)
    await t.q('update automation_settings set catalog_publish_enabled = true, catalog_publish_max_per_day = 0')
    await expect(publishCatalog('MLBT31')).rejects.toThrow(/Limite diário do catálogo/)
    await t.q('update automation_settings set catalog_publish_max_per_day = 3000')
  })

  it('publicações do catálogo não consomem o limite das ofertas do Radar', async () => {
    await t.q('update automation_settings set auto_publish_max_per_day = 1, auto_publish_min_score = 10')
    await upsert([item('MLBT40', { score: 50 })])
    const [candidate] = await t.q<{ id: string; permalink: string }>("select id, permalink from candidate_products where external_id = 'MLBT40'")
    // Já há produtos de catálogo publicados hoje nos testes anteriores; a oferta do Radar ainda entra.
    const [row] = await t.q<{ id: string }>('select public.publish_candidate_internal($1, $2, $3) id', [candidate.id, `${candidate.permalink}?${TAG}`, runId])
    const [product] = await t.q<{ publish_source: string | null }>('select publish_source from products where id = $1', [row.id])
    expect(product.publish_source).toBeNull()
    await t.q('update automation_settings set auto_publish_max_per_day = 100, auto_publish_min_score = 40')
  })
})
