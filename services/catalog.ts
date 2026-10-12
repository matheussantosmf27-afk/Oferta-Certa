import { cache } from 'react'
import { createPublicClient } from '@/lib/supabase/public'
import type { Article, Category, Coupon, Product, ProductSort } from '@/types'

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
  if (term) {
    const pattern = `%${term}%`
    request = request.or(`name.ilike.${pattern},brand.ilike.${pattern},description.ilike.${pattern}`)
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
  return data ?? []
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
  const [{ data: categories, error }, { data: products }] = await Promise.all([
    supabase.from('categories').select('*').order('name'),
    supabase.rpc('get_public_products', {}).select('category_id'),
  ])
  if (error) {
    logError('getCategories', error)
    return []
  }
  const counts = new Map<string, number>()
  for (const row of (products ?? []) as { category_id: string }[]) {
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1)
  }
  return (categories ?? []).map((category) => ({ ...category, productsCount: counts.get(category.id) ?? 0 }))
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
