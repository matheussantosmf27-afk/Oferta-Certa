// @vitest-environment node
// Testes da busca do catálogo: rodam as funções SQL reais da migration 016 num Postgres em memória,
// com produtos de teste (fictícios, só existem neste banco temporário).
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, migration, migrationFunction, type TestDb } from './harness'

let t: TestDb

interface Fixture {
  key: string
  name: string
  brand: string
  category: string
  leaf?: string
  price: number
  old?: number
  specs?: { name: string; value: string }[]
  gtins?: string[]
  status?: 'active' | 'inactive'
  affiliate?: string
  market?: { offers: number; max: number }
}

const LEAVES: Record<string, { path: string[]; names: string[] }> = {
  celulares: { path: ['MLB1051', 'MLB1055'], names: ['Celulares e Telefones', 'Celulares e Smartphones'] },
  capas: { path: ['MLB1051', 'MLB3813', 'MLB5338'], names: ['Celulares e Telefones', 'Acessórios para Celulares', 'Capas'] },
  tvs: { path: ['MLB1000', 'MLB1002'], names: ['Eletrônicos, Áudio e Vídeo', 'Televisores'] },
  fones: { path: ['MLB1000', 'MLB3835', 'MLB196208'], names: ['Eletrônicos, Áudio e Vídeo', 'Áudio', 'Fones de Ouvido'] },
  notebooks: { path: ['MLB1648', 'MLB1652'], names: ['Informática', 'Notebooks'] },
  suportes: { path: ['MLB1648', 'MLB430687', 'MLB1655'], names: ['Informática', 'Portáteis e Acessórios', 'Suportes para Notebook'] },
}

const FIXTURES: Fixture[] = [
  { key: 's25u', name: 'Samsung Galaxy S25 Ultra 5G 256GB 12GB RAM Titânio', brand: 'Samsung', category: 'celulares', leaf: 'celulares', price: 7000, old: 12000,
    market: { offers: 4, max: 8000 }, specs: [{ name: 'Modelo', value: 'Galaxy S25 Ultra' }, { name: 'Linha', value: 'Galaxy S' }, { name: 'Memória interna', value: '256 GB' }] },
  { key: 's25', name: 'Samsung Galaxy S25 5G 128 GB Azul', brand: 'Samsung', category: 'celulares', leaf: 'celulares', price: 4000, old: 5000,
    market: { offers: 3, max: 5200 }, specs: [{ name: 'Modelo', value: 'Galaxy S25' }, { name: 'Linha', value: 'Galaxy S' }] },
  { key: 'capa', name: 'Capa Capinha Anti Impacto Para Samsung Galaxy S25 Ultra', brand: 'Genérica', category: 'celulares', leaf: 'capas', price: 39.9 },
  { key: 'tv55', name: 'Smart TV Samsung 55" Crystal UHD 4K', brand: 'Samsung', category: 'tv', leaf: 'tvs', price: 2600,
    specs: [{ name: 'Modelo', value: 'UN55DU7700' }, { name: 'Modelo alfanumérico', value: 'UN55DU7700GXZD' }, { name: 'Tamanho da tela', value: '55 "' }] },
  { key: 'ip16p256', name: 'Apple iPhone 16 Pro (256 GB) - Titânio-natural', brand: 'Apple', category: 'celulares', leaf: 'celulares', price: 8500,
    gtins: ['0195949771234'], specs: [{ name: 'Modelo', value: 'iPhone 16 Pro' }, { name: 'Memória interna', value: '256 GB' }] },
  { key: 'ip16p128', name: 'Apple iPhone 16 Pro (128 GB) - Titânio-preto', brand: 'Apple', category: 'celulares', leaf: 'celulares', price: 7600,
    specs: [{ name: 'Modelo', value: 'iPhone 16 Pro' }, { name: 'Memória interna', value: '128 GB' }] },
  { key: 'pelicula', name: 'Película De Vidro 3D Para iPhone 16 Pro', brand: 'Genérica', category: 'celulares', leaf: 'capas', price: 19.9 },
  { key: 'jbl', name: 'Fone De Ouvido On-ear Sem Fio JBL Tune 530BT Bluetooth Preto', brand: 'JBL', category: 'tv', leaf: 'fones', price: 249,
    specs: [{ name: 'Modelo', value: 'Tune 530BT' }] },
  { key: 'ideapad', name: 'Notebook Lenovo IdeaPad Slim 3 Intel Core i5 16GB 512GB SSD 15,6"', brand: 'Lenovo', category: 'informatica', leaf: 'notebooks', price: 3299,
    specs: [{ name: 'Linha', value: 'IdeaPad' }, { name: 'Modelo', value: 'Slim 3' }] },
  { key: 'suporte', name: 'Suporte Para Notebook Lenovo Ajustável Alumínio', brand: 'Genérica', category: 'informatica', leaf: 'suportes', price: 89 },
  { key: 'fryer1', name: 'Fritadeira Elétrica Air Fryer Mondial 4L AFN-40 Preta', brand: 'Mondial', category: 'eletro', price: 329 },
  { key: 'fryer2', name: 'Fritadeira Sem Óleo Mondial Family 4 Litros', brand: 'Mondial', category: 'eletro', price: 299 },
  { key: 'creatina', name: 'Creatina Monohidratada 300g Growth Supplements', brand: 'Growth Supplements', category: 'esportes', price: 89.9 },
  { key: 'bosch', name: 'Furadeira De Impacto Bosch GSB 13 RE 750W 220V', brand: 'Bosch', category: 'ferramentas', price: 359 },
  { key: 'ps5', name: 'Console PlayStation 5 Slim Digital 1TB', brand: 'Sony', category: 'games', price: 3599 },
  { key: 'ddr5', name: 'Memória RAM Kingston Fury Beast DDR5 16GB 5600MHz', brand: 'Kingston', category: 'informatica', price: 389 },
  { key: 'ddr4', name: 'Memória RAM Kingston Fury Beast DDR4 8GB 3200MHz', brand: 'Kingston', category: 'informatica', price: 159 },
  { key: 'nike', name: 'Tênis Nike Air Max SC Masculino', brand: 'Nike', category: 'moda', price: 499 },
  { key: 'edge60', name: 'Motorola Edge 60 5G 256GB', brand: 'Motorola', category: 'celulares', leaf: 'celulares', price: 2199, specs: [{ name: 'Modelo', value: 'Edge 60' }] },
  { key: 'tv50', name: 'Smart TV LG 50" 4K UHD ThinQ AI', brand: 'LG', category: 'tv', leaf: 'tvs', price: 2199 },
  { key: 'inativo', name: 'Samsung Galaxy S25 Edge 256GB', brand: 'Samsung', category: 'celulares', price: 6000, status: 'inactive' },
  { key: 'semlink', name: 'Samsung Galaxy S25 FE 128GB', brand: 'Samsung', category: 'celulares', price: 3500, affiliate: '' },
]

const CATEGORIES: Record<string, string> = {
  celulares: 'Celulares', tv: 'TV e Áudio', informatica: 'Informática', eletro: 'Eletrodomésticos', esportes: 'Esportes',
  ferramentas: 'Ferramentas', games: 'Games', moda: 'Moda e Calçados',
}

const ids = new Map<string, string>()
const keyOf = (id: string) => [...ids.entries()].find(([, value]) => value === id)?.[0] ?? id

async function search(query: string, options: { category?: string; brand?: string; sort?: string; limit?: number; offset?: number } = {}) {
  const rows = await t.q<{ id: string; rank: number; match_kind: string; trusted_discount: number | null; total_count: number }>(
    'select * from public.search_catalog($1, $2, $3, null, $4, $5, $6)',
    [query, options.category ?? null, options.brand ?? null, options.sort ?? 'relevancia', options.limit ?? 60, options.offset ?? 0]
  )
  return rows.map((row) => ({ ...row, key: keyOf(row.id), total_count: Number(row.total_count) }))
}

beforeAll(async () => {
  t = await createTestDb([
    migrationFunction('014_trusted_discounts_radar_status.sql', 'create or replace function public.product_discount_status('),
    migration('016_smart_search.sql'),
    migration('018_public_products_view.sql'),
  ])
  const market = (await t.q<{ id: string }>("insert into marketplaces (slug, name) values ('mercado-livre', 'Mercado Livre') returning id"))[0].id
  const categoryIds = new Map<string, string>()
  for (const [slug, name] of Object.entries(CATEGORIES)) {
    categoryIds.set(slug, (await t.q<{ id: string }>('insert into categories (slug, name) values ($1, $2) returning id', [slug, name]))[0].id)
  }
  for (const [key, leaf] of Object.entries(LEAVES)) {
    const id = leaf.path[leaf.path.length - 1]
    await t.q('insert into ml_categories (id, name, path, path_names) values ($1, $2, $3, $4)', [id, leaf.names[leaf.names.length - 1], leaf.path, leaf.names])
    LEAVES[key] = { ...leaf }
  }
  for (const [index, f] of FIXTURES.entries()) {
    const leaf = f.leaf ? LEAVES[f.leaf].path[LEAVES[f.leaf].path.length - 1] : null
    const [row] = await t.q<{ id: string }>(
      `insert into products (name, slug, brand, category_id, marketplace_id, external_id, affiliate_url, current_price, old_price, specs, gtins,
         ml_category_id, status, market_offers, market_max, market_checked_at, published_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, case when $14::int is not null then now() end, now() - ($16 || ' minutes')::interval)
       returning id`,
      [
        f.name, `p-${f.key}`, f.brand, categoryIds.get(f.category), market, `MLB${1000 + index}`,
        f.affiliate ?? `https://www.mercadolivre.com.br/p/MLB${1000 + index}?matt_word=t&matt_tool=1`,
        f.price, f.old ?? null, JSON.stringify(f.specs ?? []), f.gtins ?? [], leaf, f.status ?? 'active',
        f.market?.offers ?? null, f.market?.max ?? null, index,
      ]
    )
    ids.set(f.key, row.id)
  }
  await t.q('select public.refresh_discount_statuses()')
}, 60_000)

describe('search_text (normalização)', () => {
  it.each([
    ['Galaxy S25 Ultra 256 GB', 'galaxy s25 ultra 256gb'],
    ['Smart TV 55" Crystal', 'smart tv 55pol crystal'],
    ['televisão 55 polegadas', 'televisao 55pol'],
    ['Air Fryer 4 Litros', 'air fryer 4l'],
    ['Garrafa 1,5 L', 'garrafa 1.5l'],
    ['creatina 300 g', 'creatina 300g'],
    ['JBL Tune-530BT', 'jbl tune 530bt'],
    ['  MEMÓRIA   RAM  DDR5 ', 'memoria ram ddr5'],
    ['Furadeira 750 W 220 V', 'furadeira 750w 220v'],
  ])('%s → %s', async (input, expected) => {
    const [row] = await t.q<{ v: string }>('select public.search_text($1) v', [input])
    expect(row.v).toBe(expected)
  })
})

describe('search_catalog', () => {
  it('marca: "Samsung" traz produtos Samsung de categorias diferentes, acessórios por último', async () => {
    const result = await search('Samsung')
    const keys = result.map((r) => r.key)
    expect(keys).toEqual(expect.arrayContaining(['s25u', 's25', 'tv55']))
    expect(keys.indexOf('capa')).toBeGreaterThan(keys.indexOf('tv55'))
    expect(keys).not.toContain('jbl')
  })

  it('modelo: "Galaxy S25 Ultra 256 GB" prioriza o Ultra, e "Galaxy S25" prioriza o S25', async () => {
    expect((await search('Galaxy S25 Ultra 256 GB'))[0].key).toBe('s25u')
    expect((await search('Samsung Galaxy S25'))[0].key).toBe('s25')
    expect((await search('Galaxy S25'))[0].key).toBe('s25')
  })

  it('código exato: código do modelo, GTIN/EAN e id da loja', async () => {
    expect((await search('UN55DU7700GXZD'))[0].key).toBe('tv55')
    expect((await search('un55du7700'))[0].key).toBe('tv55')
    expect((await search('0195949771234'))[0].key).toBe('ip16p256')
    const [row] = await t.q<{ external_id: string }>('select external_id from products where id = $1', [ids.get('edge60')])
    expect((await search(row.external_id))[0].key).toBe('edge60')
  })

  it('acentos e maiúsculas não importam', async () => {
    const a = (await search('memória ram ddr5 16 gb')).map((r) => r.key)
    const b = (await search('MEMORIA RAM DDR5 16GB')).map((r) => r.key)
    expect(a[0]).toBe('ddr5')
    expect(b).toEqual(a)
    expect(a).not.toContain('ddr4')
    expect((await search('PLAYSTATION 5'))[0].key).toBe('ps5')
    expect((await search('ps5'))[0].key).toBe('ps5')
  })

  it('espaços, hífens e ordem diferente', async () => {
    for (const query of ['JBL Tune 530BT', 'jbl tune-530 bt', 'tune530bt', '530BT JBL Tune']) {
      expect((await search(query))[0]?.key, query).toBe('jbl')
    }
  })

  it('correspondência exata vem antes de acessórios e variações', async () => {
    const result = (await search('iPhone 16 Pro')).map((r) => r.key)
    expect(result.slice(0, 2).sort()).toEqual(['ip16p128', 'ip16p256'])
    expect(result.at(-1)).toBe('pelicula')
    expect((await search('iPhone 16 Pro 256 GB'))[0].key).toBe('ip16p256')
    // A capacidade dá prioridade, mas não esconde as outras versões do mesmo modelo.
    expect((await search('iPhone 16 Pro 256 GB')).map((r) => r.key)).toContain('ip16p128')
    expect((await search('película iphone 16 pro'))[0].key).toBe('pelicula')
  })

  it('categoria e tipo de produto: notebook Lenovo antes do suporte; TV pelo sinônimo e polegadas', async () => {
    const notebooks = (await search('notebook Lenovo')).map((r) => r.key)
    expect(notebooks[0]).toBe('ideapad')
    expect(notebooks).toContain('suporte')
    expect((await search('notebook Lenovo IdeaPad'))[0].key).toBe('ideapad')
    expect((await search('televisão Samsung 55 polegadas')).map((r) => r.key)).toEqual(['tv55'])
    expect((await search('smart tv')).map((r) => r.key).sort()).toEqual(['tv50', 'tv55'])
  })

  it('marca + características: air fryer, creatina, furadeira, tênis', async () => {
    expect((await search('air fryer Mondial 4 litros')).map((r) => r.key).sort()).toEqual(['fryer1', 'fryer2'])
    expect((await search('creatina 300 g')).map((r) => r.key)).toEqual(['creatina'])
    expect((await search('furadeira Bosch')).map((r) => r.key)).toEqual(['bosch'])
    expect((await search('tênis Nike Air Max')).map((r) => r.key)).toEqual(['nike'])
    expect((await search('Motorola Edge 60')).map((r) => r.key)).toEqual(['edge60'])
  })

  it('números valem inteiros: "Galaxy S2" não acha S25 e "TV 5" não acha 55/50', async () => {
    expect(await search('Galaxy S2')).toEqual([])
    expect(await search('tv 5')).toEqual([])
  })

  it('erro leve de digitação vira resultado aproximado, marcado como tal', async () => {
    const result = await search('Samsumg Galaxi S25 Ultra')
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].match_kind).toBe('aproximado')
    expect(result[0].key).toBe('s25u')
  })

  it('busca sem sentido não inventa resultados', async () => {
    expect(await search('xyzqwk')).toEqual([])
  })

  it('aproximação não troca palavras: marca ou produto ausente não vira outro parecido', async () => {
    expect(await search('furadeira dewalt')).toEqual([])
    expect(await search('esmerilhadeira bosch')).toEqual([])
    expect(await search('notebook dell')).toEqual([])
  })

  it('não mostra produtos inativos nem sem link de afiliado', async () => {
    const keys = (await search('Samsung Galaxy S25')).map((r) => r.key)
    expect(keys).not.toContain('inativo')
    expect(keys).not.toContain('semlink')
  })

  it('paginação: páginas sem repetição e total consistente', async () => {
    const all = await search('', { sort: 'menor-preco' })
    const total = all[0].total_count
    expect(total).toBe(20)
    const pages = [await search('', { sort: 'menor-preco', limit: 7, offset: 0 }), await search('', { sort: 'menor-preco', limit: 7, offset: 7 }), await search('', { sort: 'menor-preco', limit: 7, offset: 14 })]
    const seen = pages.flat().map((r) => r.id)
    expect(new Set(seen).size).toBe(20)
    expect(pages.every((page) => page.every((r) => r.total_count === total))).toBe(true)
    expect(pages[2]).toHaveLength(6)
  })

  it('filtros de categoria e marca', async () => {
    expect((await search('Samsung', { category: 'tv' })).map((r) => r.key)).toEqual(['tv55'])
    const kingston = await search('memória', { brand: 'kingston' })
    expect(kingston.map((r) => r.key).sort()).toEqual(['ddr4', 'ddr5'])
    const facets = (await t.q<{ f: { categories: { slug: string; count: number }[]; brands: { key: string; count: number }[] } }>(
      "select public.search_catalog_facets('Samsung') f"
    ))[0].f
    expect(facets.categories.find((c) => c.slug === 'celulares')?.count).toBe(3)
    expect(facets.brands.find((b) => b.key === 'samsung')?.count).toBe(3)
  })

  it('ordenação por preço e por desconto validado', async () => {
    const cheap = await search('Samsung Galaxy', { sort: 'menor-preco' })
    const [prices] = [await t.q<{ id: string; current_price: string }>('select id, current_price from products')]
    const priceOf = new Map(prices.map((p) => [p.id, Number(p.current_price)]))
    const ordered = cheap.map((r) => priceOf.get(r.id) as number)
    expect(ordered).toEqual([...ordered].sort((a, b) => a - b))

    const discount = await search('Samsung Galaxy', { sort: 'maior-desconto' })
    // S25: 5000 → 4000 compatível com o mercado (até 5200) = 20%. Ultra: 12000 acima do mercado (até 8000) = sem desconto.
    expect(discount[0].key).toBe('s25')
    expect(discount[0].trusted_discount).toBe(20)
    expect(discount.find((r) => r.key === 's25u')?.trusted_discount).toBeNull()
  })

  it('desconto público some quando o preço muda até o próximo recálculo', async () => {
    await t.q('update products set current_price = 4100 where id = $1', [ids.get('s25')])
    const [before] = await t.q<{ discount_percentage: number | null }>('select discount_percentage from public_products where id = $1', [ids.get('s25')])
    expect(before.discount_percentage).toBeNull()
    await t.q('select public.refresh_discount_statuses()')
    const [after] = await t.q<{ discount_percentage: number | null }>('select discount_percentage from public_products where id = $1', [ids.get('s25')])
    expect(after.discount_percentage).toBe(18)
    await t.q('update products set current_price = 4000 where id = $1', [ids.get('s25')])
    await t.q('select public.refresh_discount_statuses()')
  })

  it('vitrine pública (view) mostra só produtos ativos com link e não expõe colunas internas', async () => {
    const rows = await t.q<Record<string, unknown>>('select * from public_products')
    const [{ n }] = await t.q<{ n: number }>("select count(*)::int as n from products where status = 'active' and affiliate_url <> ''")
    expect(rows).toHaveLength(n)
    expect(Object.keys(rows[0])).not.toContain('affiliate_url')
    expect(Object.keys(rows[0])).not.toContain('external_id')
    const [fn] = await t.q<{ n: number }>('select count(*)::int as n from get_public_products()')
    expect(fn.n).toBe(n)
  })

  it('contagem por categoria considera só produtos publicados', async () => {
    const rows = await t.q<{ category_id: string; products_count: string }>('select * from get_public_category_counts()')
    const [celulares] = await t.q<{ id: string }>("select id from categories where slug = 'celulares'")
    expect(Number(rows.find((r) => r.category_id === celulares.id)?.products_count)).toBe(7)
  })
})

describe('permissões', () => {
  it('visitante executa a busca pública, mas não as funções internas', async () => {
    await t.db.exec('set role anon')
    try {
      const rows = await t.q('select * from public.search_catalog($1)', ['Samsung'])
      expect(rows.length).toBeGreaterThan(0)
      await expect(t.q('select * from public.search_catalog_match($1)', ['Samsung'])).rejects.toThrow(/permission denied/)
      await expect(t.q('select public.refresh_discount_statuses()')).rejects.toThrow(/permission denied/)
      await expect(t.q('select * from public.products')).rejects.toThrow(/permission denied/)
    } finally {
      await t.db.exec('reset role')
    }
  })
})
