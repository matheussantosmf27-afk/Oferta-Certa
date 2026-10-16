import { cache } from 'react'
import { createPublicClient } from '@/lib/supabase/public'
import type { Article, Category, Coupon, Product, ProductSort } from '@/types'
import { parseDiscountStatus, type DiscountStatus } from '@/lib/price-insight'
import { parseRadarStatus, type RadarStatus } from '@/lib/radar-status'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

/** Remove caracteres com significado especial nos filtros do PostgREST. */
export function sanitizeSearchTerm(term: string): string {
  return term
    .replace(/[%_*,()\\'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

function logError(context: string, error: unknown) {
  console.error(`[catalog] ${context}`, error)
}

export interface ProductQuery {
  q?: string
  categorySlug?: string
  marketplaceSlug?: string
  sort?: ProductSort
  featuredOnly?: boolean
  withDiscountOnly?: boolean
  limit?: number
  excludeId?: string
}

export async function listProducts(query: ProductQuery = {}): Promise<Product[]> {
  const supabase = createPublicClient()
  let request = supabase.rpc('get_public_products', {})

  const term = query.q ? sanitizeSearchTerm(query.q) : ''
  // Busca sem acento e por palavras (no banco); aqui só filtramos pelos ids encontrados.
  let ranking: Map<string, number> | null = null
  if (term) {
    const { data: matches, error: searchError } = await supabase.rpc('search_public_products', { p_query: term, p_limit: 200 })
    if (searchError) {
      logError('listProducts/search', searchError)
      return []
    }
    if (!matches?.length) return []
    ranking = new Map(matches.map((match, index) => [match.id, index]))
    request = request.in('id', [...ranking.keys()])
  }
  if (query.categorySlug) request = request.eq('category_slug', query.categorySlug)
  if (query.marketplaceSlug) request = request.eq('marketplace_slug', query.marketplaceSlug)
  if (query.featuredOnly) request = request.eq('featured', true)
  if (query.withDiscountOnly) request = request.gt('discount_percentage', 0)
  if (query.excludeId) request = request.neq('id', query.excludeId)

  switch (query.sort) {
    case 'menor-preco':
      request = request.order('current_price', { ascending: true })
      break
    case 'maior-preco':
      request = request.order('current_price', { ascending: false })
      break
    case 'maior-desconto':
      request = request.order('discount_percentage', { ascending: false, nullsFirst: false })
      break
    case 'recentes':
      request = request.order('last_price_update', { ascending: false })
      break
    default:
      request = request.order('featured', { ascending: false }).order('last_price_update', { ascending: false })
  }

  request = request.limit(Math.min(query.limit ?? 48, 100))

  const { data, error } = await request
  if (error) {
    logError('listProducts', error)
    return []
  }
  const products = data ?? []
  if (ranking && (!query.sort || query.sort === 'relevancia')) {
    const order = ranking
    return [...products].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  }
  return products
}

export const getProductBySlug = cache(async (slug: string): Promise<Product | null> => {
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_public_products', {}).eq('slug', slug).maybeSingle()
  if (error) {
    logError('getProductBySlug', error)
    return null
  }
  return data
})

/** Histórico público de preço (só produtos ativos), do mais recente ao mais antigo. */
export async function getPriceHistory(productId: string): Promise<{ price: number; recorded_at: string }[]> {
  if (!isUuid(productId)) return []
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_public_price_history', { p_product_id: productId, p_limit: 90 })
  if (error) {
    logError('getPriceHistory', error)
    return []
  }
  return data ?? []
}

export interface ProductSpec {
  name: string
  value: string
}

/** Destaques e ficha técnica de um produto ativo (vindos do catálogo da loja). */
export async function getProductDetails(productId: string): Promise<{ features: string[]; specs: ProductSpec[] }> {
  const empty = { features: [], specs: [] }
  if (!isUuid(productId)) return empty
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_public_product_details', { p_product_id: productId }).maybeSingle()
  if (error) {
    logError('getProductDetails', error)
    return empty
  }
  const specs = Array.isArray(data?.specs)
    ? (data.specs as unknown[]).filter(
        (spec): spec is ProductSpec =>
          typeof spec === 'object' && spec !== null && typeof (spec as ProductSpec).name === 'string' && typeof (spec as ProductSpec).value === 'string'
      )
    : []
  return { features: data?.features ?? [], specs }
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  const valid = Array.from(new Set(ids.filter(isUuid))).slice(0, 100)
  if (!valid.length) return []
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_public_products', {}).in('id', valid)
  if (error) {
    logError('getProductsByIds', error)
    return []
  }
  return data ?? []
}

export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = createPublicClient()
  // Contagem agregada no banco: não carrega a lista de produtos (o catálogo pode ter milhares).
  const [{ data: categories, error }, { data: counts, error: countError }] = await Promise.all([
    supabase.from('categories').select('*').order('name'),
    supabase.rpc('get_public_category_counts', {}),
  ])
  if (error) {
    logError('getCategories', error)
    return []
  }
  if (countError) logError('getCategories/counts', countError)
  const byCategory = new Map((counts ?? []).map((row) => [row.category_id, Number(row.products_count)]))
  return (categories ?? []).map((category) => ({ ...category, productsCount: byCategory.get(category.id) ?? 0 }))
})

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const categories = await getCategories()
  return categories.find((category) => category.slug === slug) ?? null
}

export async function getActiveCoupons(): Promise<Coupon[]> {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('status', 'active')
    .gte('valid_until', new Date().toISOString())
    .order('valid_until')
  if (error) {
    logError('getActiveCoupons', error)
    return []
  }
  return data ?? []
}

export async function getArticles(): Promise<Article[]> {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('status', 'active')
    .order('published_at', { ascending: false })
  if (error) {
    logError('getArticles', error)
    return []
  }
  return data ?? []
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const supabase = createPublicClient()
  const { data, error } = await supabase.from('articles').select('*').eq('slug', slug).eq('status', 'active').maybeSingle()
  if (error) {
    logError('getArticleBySlug', error)
    return null
  }
  return data
}

export const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'relevancia', label: 'Mais relevantes' },
  { value: 'maior-desconto', label: 'Maior desconto' },
  { value: 'menor-preco', label: 'Menor preço' },
  { value: 'maior-preco', label: 'Maior preço' },
  { value: 'recentes', label: 'Mais recentes' },
]

export function parseSort(value: string | undefined): ProductSort {
  return SORT_OPTIONS.some((option) => option.value === value) ? (value as ProductSort) : 'relevancia'
}

export interface ProductInsights {
  market: { offers: number; min: number; median: number; max: number; checked_at: string } | null
  seller: { name: string | null; level: number | null; power_seller: string | null; sales: number | null } | null
  official_store: boolean | null
  warranty: string | null
  /** Preço anterior informado pela loja (bruto, mesmo quando o desconto não foi corroborado). */
  reference_price: number | null
  discount_status: DiscountStatus | null
  history: { day: string; offers: number; min: number; median: number; max: number }[]
}

/** Raio-X do preço: faixa entre vendedores, reputação do vendedor e histórico diário (API oficial da loja). */
export async function getProductInsights(productId: string): Promise<ProductInsights | null> {
  if (!isUuid(productId)) return null
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_public_product_insights', { p_product_id: productId })
  if (error) {
    logError('getProductInsights', error)
    return null
  }
  if (!data || typeof data !== 'object') return null
  const raw = data as Record<string, unknown>
  const toNum = (value: unknown) => (value === null || value === undefined ? null : Number(value))
  const market = raw.market as Record<string, unknown> | null
  return {
    market:
      market && toNum(market.offers) && toNum(market.min)
        ? {
            offers: Number(market.offers),
            min: Number(market.min),
            median: Number(market.median),
            max: Number(market.max),
            checked_at: String(market.checked_at),
          }
        : null,
    seller: (raw.seller as ProductInsights['seller']) ?? null,
    official_store: typeof raw.official_store === 'boolean' ? raw.official_store : null,
    warranty: typeof raw.warranty === 'string' ? raw.warranty : null,
    reference_price: toNum(raw.reference_price),
    discount_status: parseDiscountStatus(raw.discount_status),
    history: Array.isArray(raw.history)
      ? (raw.history as Record<string, unknown>[]).map((row) => ({
          day: String(row.day),
          offers: Number(row.offers),
          min: Number(row.min),
          median: Number(row.median),
          max: Number(row.max),
        }))
      : [],
  }
}

/** Indicador público do Radar (publicadas, conferidas em 24h e última coleta concluída). */
export async function getRadarStatus(): Promise<RadarStatus | null> {
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_radar_status')
  if (error) {
    logError('getRadarStatus', error)
    return null
  }
  return parseRadarStatus(data)
}

export type MatchKind = 'exato' | 'aproximado' | 'todos'

export interface CatalogSearchInput {
  q?: string
  category?: string | null
  brand?: string | null
  sort?: ProductSort
  page?: number
  pageSize?: number
}

export interface CatalogSearchResult {
  products: Product[]
  total: number
  /** Nenhum resultado exato: a lista traz correspondências aproximadas (erro de digitação). */
  approximate: boolean
  error: boolean
}

/**
 * Busca no catálogo publicado (função search_catalog no banco): relevância por marca, modelo,
 * código, características e categoria; filtros, ordenação e paginação feitos no banco.
 */
export async function searchCatalog(input: CatalogSearchInput): Promise<CatalogSearchResult> {
  const pageSize = Math.min(Math.max(input.pageSize ?? 24, 1), 60)
  const page = Math.max(input.page ?? 1, 1)
  const supabase = createPublicClient()
  const { data: matches, error } = await supabase.rpc('search_catalog', {
    p_query: input.q ? sanitizeSearchTerm(input.q) : null,
    p_category: input.category ?? null,
    p_brand: input.brand ?? null,
    p_sort: input.sort ?? 'relevancia',
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  })
  if (error) {
    logError('searchCatalog', error)
    return { products: [], total: 0, approximate: false, error: true }
  }
  const rows = matches ?? []
  if (!rows.length) return { products: [], total: 0, approximate: false, error: false }

  const { data: products, error: productsError } = await supabase
    .rpc('get_public_products', {})
    .in(
      'id',
      rows.map((row) => row.id)
    )
  if (productsError) {
    logError('searchCatalog/products', productsError)
    return { products: [], total: 0, approximate: false, error: true }
  }
  const byId = new Map((products ?? []).map((product) => [product.id, product]))
  return {
    products: rows.map((row) => byId.get(row.id)).filter((product): product is Product => Boolean(product)),
    total: Number(rows[0].total_count),
    approximate: rows.every((row) => row.match_kind === 'aproximado'),
    error: false,
  }
}

export interface SearchFacets {
  categories: { slug: string; name: string; count: number }[]
  brands: { key: string; name: string; count: number }[]
}

/** Categorias e marcas disponíveis para a busca atual, com a quantidade de resultados. */
export async function getSearchFacets(q: string, category: string | null, brand: string | null): Promise<SearchFacets> {
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('search_catalog_facets', {
    p_query: q ? sanitizeSearchTerm(q) : null,
    p_category: category,
    p_brand: brand,
  })
  if (error || !data || typeof data !== 'object') {
    if (error) logError('getSearchFacets', error)
    return { categories: [], brands: [] }
  }
  const raw = data as { categories?: unknown; brands?: unknown }
  const list = (value: unknown) => (Array.isArray(value) ? (value as Record<string, unknown>[]) : [])
  return {
    categories: list(raw.categories)
      .filter((item) => typeof item.slug === 'string' && typeof item.name === 'string')
      .map((item) => ({ slug: item.slug as string, name: item.name as string, count: Number(item.count) || 0 })),
    brands: list(raw.brands)
      .filter((item) => typeof item.key === 'string' && typeof item.name === 'string')
      .map((item) => ({ key: item.key as string, name: item.name as string, count: Number(item.count) || 0 })),
  }
}
