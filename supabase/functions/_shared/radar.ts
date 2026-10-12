// Lógica pura do Radar (sem Deno/Node APIs): usada pela Edge Function e testada com Vitest.

export interface NormalizedCandidate {
  external_id: string
  title: string
  permalink: string
  image_url: string | null
  price: number
  original_price: number | null
  currency: string
  free_shipping: boolean
  rating: number | null
  reviews_count: number | null
  sold_quantity: number | null
  offers_count: number | null
  condition: string | null
  brand: string | null
}

export interface ScoreResult {
  score: number
  breakdown: Record<string, number>
  flags: string[]
}

type Dict = Record<string, unknown>

const isDict = (value: unknown): value is Dict => typeof value === 'object' && value !== null && !Array.isArray(value)
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const str = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null)

const ML_PRODUCT_ID = /^MLB\d+$/

/** Página oficial do produto no catálogo do Mercado Livre (de onde se gera o link de afiliado). */
export function mercadoLivreProductUrl(productId: string): string {
  return `https://www.mercadolivre.com.br/p/${productId}`
}

function httpsImage(url: string | null): string | null {
  if (!url) return null
  return url.replace(/^http:\/\//i, 'https://')
}

function brandFrom(attributes: unknown): string | null {
  if (!Array.isArray(attributes)) return null
  const brand = attributes.find((attr) => isDict(attr) && attr.id === 'BRAND')
  return isDict(brand) ? str(brand.value_name) : null
}

/**
 * Converte um produto do catálogo (resultado de /products/search) e suas ofertas
 * (/products/{id}/items) em candidato. Usa a oferta mais barata entre os vendedores.
 * Retorna null se não houver vendedor ativo ou faltar dado essencial.
 */
export function normalizeMercadoLivreCatalogProduct(product: unknown, offers: unknown): NormalizedCandidate | null {
  if (!isDict(product)) return null
  const id = str(product.id)
  const title = str(product.name)
  if (!id || !ML_PRODUCT_ID.test(id) || !title) return null

  const results = isDict(offers) && Array.isArray(offers.results) ? offers.results.filter(isDict) : []
  const valid = results
    .map((offer) => ({ offer, price: num(offer.price) }))
    .filter((entry): entry is { offer: Dict; price: number } => entry.price !== null && entry.price > 0)
    .filter(({ offer }) => (str(offer.currency_id) ?? 'BRL') === 'BRL')
    .sort((a, b) => a.price - b.price)
  if (!valid.length) return null

  const best = valid[0]
  const originalRaw = num(best.offer.original_price)
  // Preço anterior só vale se for MAIOR que o atual; caso contrário não há desconto.
  const original_price = originalRaw !== null && originalRaw > best.price ? originalRaw : null
  const shipping = isDict(best.offer.shipping) ? best.offer.shipping : {}

  const pictures = Array.isArray(product.pictures) ? product.pictures.filter(isDict) : []
  const total = isDict(offers) && isDict(offers.paging) ? num(offers.paging.total) : null

  return {
    external_id: id,
    title: title.slice(0, 300),
    permalink: mercadoLivreProductUrl(id),
    image_url: httpsImage(pictures.length ? str(pictures[0].url) : null),
    price: best.price,
    original_price,
    currency: 'BRL',
    free_shipping: shipping.free_shipping === true,
    rating: null, // a API não traz avaliações aqui; não inventamos
    reviews_count: null,
    sold_quantity: null,
    offers_count: total ?? valid.length,
    condition: str(best.offer.condition),
    brand: brandFrom(product.attributes),
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Pontuação 0–100. Princípios:
 * - desconto só conta se houver preço anterior maior que o atual;
 * - descontos acima de 70% são tratados como suspeitos (sem pontos);
 * - sem avaliações, nada é presumido.
 */
export function scoreCandidate(candidate: NormalizedCandidate): ScoreResult {
  const breakdown: Record<string, number> = {}
  const flags: string[] = []

  if (candidate.original_price && candidate.original_price > candidate.price) {
    const pct = ((candidate.original_price - candidate.price) / candidate.original_price) * 100
    if (pct > 70) {
      flags.push('desconto_suspeito')
      breakdown.desconto = 0
    } else {
      breakdown.desconto = clamp(pct, 0, 50) * 0.8 // até 40
    }
  } else {
    flags.push('sem_preco_anterior')
    breakdown.desconto = 0
  }

  if (candidate.rating !== null && (candidate.reviews_count ?? 0) >= 5) {
    breakdown.avaliacao = clamp(((candidate.rating - 3) / 2) * 20, 0, 20)
  }
  if (candidate.reviews_count) {
    breakdown.volume_avaliacoes = clamp((Math.log10(candidate.reviews_count + 1) / 3) * 15, 0, 15)
  }
  if (candidate.sold_quantity) {
    breakdown.vendas = clamp((Math.log10(candidate.sold_quantity + 1) / 4) * 15, 0, 15)
  }
  if (candidate.offers_count && candidate.offers_count > 1) {
    // Vários vendedores = produto procurado e preço mais competitivo.
    breakdown.vendedores = clamp((Math.log10(candidate.offers_count) / Math.log10(30)) * 10, 0, 10)
  }

  breakdown.frete_gratis = candidate.free_shipping ? 10 : 0
  breakdown.condicao = candidate.condition === 'new' ? 5 : candidate.condition === 'used' ? -15 : 0
  if (!candidate.image_url) {
    breakdown.sem_imagem = -10
    flags.push('sem_imagem')
  }

  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0)
  const rounded = Object.fromEntries(Object.entries(breakdown).map(([key, value]) => [key, Math.round(value * 10) / 10]))
  return { score: Math.round(clamp(total, 0, 100) * 10) / 10, breakdown: rounded, flags }
}

/** Espera exponencial com teto: 1s, 2s, 4s… */
export function backoffDelay(attempt: number, baseMs = 1000, maxMs = 8000): number {
  return Math.min(maxMs, baseMs * 2 ** attempt)
}

export function shouldRetry(status: number): boolean {
  return status === 429 || status >= 500
}

/** Executa tarefas assíncronas com limite de simultaneidade, preservando a ordem. */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await task(items[index])
    }
  })
  await Promise.all(workers)
  return results
}
