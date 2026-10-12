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

function httpsImage(url: string | null): string | null {
  if (!url) return null
  const secure = url.replace(/^http:\/\//i, 'https://')
  // Miniaturas do ML terminam em -I.jpg; -O.jpg é a versão maior.
  return secure.replace(/-I\.(jpg|jpeg|webp|png)$/i, '-O.$1')
}

/** Converte um item da busca do Mercado Livre. Retorna null se faltar dado essencial. */
export function normalizeMercadoLivreItem(item: unknown): NormalizedCandidate | null {
  if (!isDict(item)) return null
  const id = str(item.id)
  const title = str(item.title)
  const permalink = str(item.permalink)
  const price = num(item.price)
  if (!id || !title || !permalink || price === null || price <= 0) return null
  if (!/^https:\/\//i.test(permalink)) return null

  const originalRaw = num(item.original_price)
  // Preço anterior só vale se for MAIOR que o atual; caso contrário não há desconto.
  const original_price = originalRaw !== null && originalRaw > price ? originalRaw : null

  const shipping = isDict(item.shipping) ? item.shipping : {}
  const attributes = Array.isArray(item.attributes) ? item.attributes : []
  const brandAttr = attributes.find((attr) => isDict(attr) && attr.id === 'BRAND')
  const brand = isDict(brandAttr) ? str(brandAttr.value_name) : null

  return {
    external_id: id,
    title: title.slice(0, 300),
    permalink,
    image_url: httpsImage(str(item.thumbnail)),
    price,
    original_price,
    currency: str(item.currency_id) ?? 'BRL',
    free_shipping: shipping.free_shipping === true,
    rating: null, // a busca não traz avaliações; não inventamos
    reviews_count: null,
    sold_quantity: num(item.sold_quantity),
    condition: str(item.condition),
    brand,
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
