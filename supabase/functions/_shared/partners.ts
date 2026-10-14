// Lojas parceiras com API oficial de afiliados (Shopee e AliExpress).
// Lógica pura (Web Crypto + fetch injetável): usada pela Edge Function e testada com Vitest.
// As APIs devolvem o link de afiliado JÁ com a etiqueta do dono da conta: não montamos link à mão.
import type { NormalizedCandidate } from './radar.ts'

type Dict = Record<string, unknown>

const isDict = (value: unknown): value is Dict => typeof value === 'object' && value !== null && !Array.isArray(value)
const str = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null)
/** Números chegam como texto em várias respostas ("129.90", "4.8", "20%"). */
const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const parsed = Number(value.replace('%', '').replace(',', '.').trim())
  return Number.isFinite(parsed) ? parsed : null
}
const round2 = (value: number) => Math.round(value * 100) / 100
const httpsUrl = (value: unknown): string | null => {
  const url = str(value)
  if (!url) return null
  const fixed = url.startsWith('//') ? `https:${url}` : url.replace(/^http:\/\//i, 'https://')
  return /^https:\/\/[^\s]+$/.test(fixed) ? fixed : null
}

/** Candidato de loja parceira: além dos dados normais, traz o link de afiliado gerado pela API. */
export interface PartnerCandidate extends NormalizedCandidate {
  affiliate_url: string
}

/** Preço anterior a partir do % de desconto informado pela loja (só quando há desconto real e plausível). */
export function originalFromDiscount(price: number, discountPct: number | null): number | null {
  if (discountPct === null || !(discountPct >= 1) || !(discountPct <= 90) || !(price > 0)) return null
  const original = round2(price / (1 - discountPct / 100))
  return original > price ? original : null
}

const toHex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')

/* --------------------------------- Shopee -------------------------------- */

export const SHOPEE_ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql'
const SHOPEE_HOSTS = ['shopee.com.br', 's.shopee.com.br', 'shope.ee']

/** Assinatura da Shopee Affiliate Open API: SHA256(AppId + Timestamp + Payload + Secret). */
export async function shopeeSignature(appId: string, timestamp: number, payload: string, secret: string): Promise<string> {
  const data = new TextEncoder().encode(`${appId}${timestamp}${payload}${secret}`)
  return toHex(await crypto.subtle.digest('SHA-256', data))
}

export async function shopeeAuthHeader(appId: string, secret: string, payload: string, now = Date.now()): Promise<string> {
  const timestamp = Math.floor(now / 1000)
  const signature = await shopeeSignature(appId, timestamp, payload, secret)
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`
}

const SHOPEE_FIELDS = 'itemId productName productLink offerLink imageUrl priceMin priceMax priceDiscountRate sales ratingStar shopName shopType'

/** Consulta productOfferV2. `keyword` para busca; `itemId` para reconsultar um produto publicado. */
export function shopeeOfferQuery(params: { keyword?: string; itemId?: string; sortType?: number; limit?: number; page?: number }): string {
  const args: string[] = []
  if (params.keyword) args.push(`keyword: ${JSON.stringify(params.keyword)}`)
  if (params.itemId && /^\d+$/.test(params.itemId)) args.push(`itemId: ${params.itemId}`)
  args.push(`sortType: ${params.sortType ?? 2}`) // 2 = mais vendidos
  args.push(`page: ${params.page ?? 1}`)
  args.push(`limit: ${Math.min(50, Math.max(1, params.limit ?? 20))}`)
  return JSON.stringify({ query: `{ productOfferV2(${args.join(', ')}) { nodes { ${SHOPEE_FIELDS} } pageInfo { hasNextPage } } }` })
}

/** Lê os nós de productOfferV2 (ou lança o erro da API, que vem em `errors`). */
export function parseShopeeResponse(body: unknown): Dict[] {
  if (isDict(body) && Array.isArray(body.errors) && body.errors.length) {
    const first = body.errors[0]
    const message = isDict(first) ? str(first.message) : null
    throw new Error(`Shopee recusou a consulta: ${message ?? 'erro sem detalhes'}`)
  }
  const data = isDict(body) && isDict(body.data) ? body.data : null
  const offer = data && isDict(data.productOfferV2) ? data.productOfferV2 : null
  return offer && Array.isArray(offer.nodes) ? offer.nodes.filter(isDict) : []
}

const isShopeeUrl = (url: string | null) => {
  if (!url) return false
  try {
    const host = new URL(url).hostname.toLowerCase()
    return SHOPEE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
  } catch {
    return false
  }
}

/**
 * Converte um nó de productOfferV2 em candidato. Descarta itens sem link de afiliado, sem foto,
 * sem preço, ou com variações de preço muito diferentes (o preço mostrado seria enganoso).
 */
export function normalizeShopeeOffer(node: unknown): PartnerCandidate | null {
  if (!isDict(node)) return null
  const itemId = node.itemId !== undefined && node.itemId !== null ? String(node.itemId) : ''
  const title = str(node.productName)
  const affiliate = httpsUrl(node.offerLink)
  const permalink = httpsUrl(node.productLink)
  const image = httpsUrl(node.imageUrl)
  const priceMin = toNumber(node.priceMin)
  const priceMax = toNumber(node.priceMax) ?? priceMin
  if (!/^\d+$/.test(itemId) || !title || !affiliate || !permalink || !image || !priceMin || priceMin <= 0) return null
  if (!isShopeeUrl(affiliate) || !isShopeeUrl(permalink)) return null
  if (priceMax !== null && priceMax > priceMin * 1.3) return null

  const rating = toNumber(node.ratingStar)
  const sales = toNumber(node.sales)
  return {
    external_id: itemId,
    title: title.slice(0, 300),
    permalink,
    affiliate_url: affiliate,
    image_url: image,
    price: round2(priceMin),
    original_price: originalFromDiscount(priceMin, toNumber(node.priceDiscountRate)),
    currency: 'BRL',
    free_shipping: false, // a API não informa frete; não presumimos
    rating: rating !== null && rating > 0 && rating <= 5 ? rating : null,
    reviews_count: null,
    sold_quantity: sales !== null && sales >= 0 ? Math.round(sales) : null,
    offers_count: null,
    condition: null,
    brand: null,
    description: null,
    features: [],
    specs: [],
    gallery: [image],
  }
}

/* -------------------------------- AliExpress ------------------------------- */

export const ALIEXPRESS_ENDPOINT = 'https://api-sg.aliexpress.com/sync'
const ALIEXPRESS_HOSTS = ['aliexpress.com', 'aliexpress.us', 's.click.aliexpress.com', 'a.aliexpress.com']

/**
 * Assinatura da AliExpress Open Platform (sign_method=sha256): HMAC-SHA256 com o App Secret sobre
 * os parâmetros ordenados por nome, concatenados como nome+valor, em hexadecimal maiúsculo.
 */
export async function aliexpressSignature(params: Record<string, string>, secret: string): Promise<string> {
  const base = Object.keys(params)
    .filter((key) => key !== 'sign')
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join('')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(base))
  return toHex(signature).toUpperCase()
}

/** Monta a URL assinada de um método da API de afiliados do AliExpress (preços em BRL, textos em português). */
export async function aliexpressRequestUrl(
  method: string,
  businessParams: Record<string, string>,
  credentials: { appKey: string; secret: string; trackingId: string },
  now = Date.now()
): Promise<string> {
  const params: Record<string, string> = {
    method,
    app_key: credentials.appKey,
    timestamp: String(now),
    sign_method: 'sha256',
    format: 'json',
    v: '2.0',
    target_currency: 'BRL',
    target_language: 'PT',
    ship_to_country: 'BR',
    tracking_id: credentials.trackingId,
    ...businessParams,
  }
  params.sign = await aliexpressSignature(params, credentials.secret)
  return `${ALIEXPRESS_ENDPOINT}?${new URLSearchParams(params)}`
}

/** Extrai a lista de produtos de qualquer resposta de produto da API de afiliados (query, hotproduct, productdetail). */
export function parseAliexpressProducts(body: unknown): Dict[] {
  if (!isDict(body)) return []
  if (isDict(body.error_response)) {
    throw new Error(`AliExpress recusou a consulta: ${str(body.error_response.msg) ?? str(body.error_response.code) ?? 'erro sem detalhes'}`)
  }
  const response = Object.entries(body).find(([key, value]) => key.endsWith('_response') && isDict(value))?.[1] as Dict | undefined
  const result = response && isDict(response.resp_result) ? response.resp_result : null
  if (result && toNumber(result.resp_code) !== null && toNumber(result.resp_code) !== 200) {
    // 405 = nenhum produto encontrado: não é erro.
    if (toNumber(result.resp_code) === 405) return []
    throw new Error(`AliExpress respondeu ${result.resp_code}: ${str(result.resp_msg) ?? 'sem detalhes'}`)
  }
  const inner = result && isDict(result.result) ? result.result : null
  const products = inner && isDict(inner.products) ? inner.products.product : null
  return Array.isArray(products) ? products.filter(isDict) : []
}

const isAliexpressUrl = (url: string | null) => {
  if (!url) return false
  try {
    const host = new URL(url).hostname.toLowerCase()
    return ALIEXPRESS_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
  } catch {
    return false
  }
}

/** Converte um produto da API de afiliados do AliExpress em candidato (precisa do link de afiliado). */
export function normalizeAliexpressProduct(product: unknown): PartnerCandidate | null {
  if (!isDict(product)) return null
  const id = product.product_id !== undefined && product.product_id !== null ? String(product.product_id) : ''
  const title = str(product.product_title)
  const affiliate = httpsUrl(product.promotion_link)
  const permalink = httpsUrl(product.product_detail_url) ?? (id ? `https://pt.aliexpress.com/item/${id}.html` : null)
  const image = httpsUrl(product.product_main_image_url)
  const currency = str(product.target_sale_price_currency) ?? 'BRL'
  const price = toNumber(product.target_sale_price)
  const originalRaw = toNumber(product.target_original_price)
  if (!/^\d+$/.test(id) || !title || !affiliate || !permalink || !image || !price || price <= 0 || currency !== 'BRL') return null
  if (!isAliexpressUrl(affiliate)) return null

  const small = isDict(product.product_small_image_urls) ? product.product_small_image_urls.string : null
  const gallery = [image, ...(Array.isArray(small) ? small.map(httpsUrl).filter((url): url is string => Boolean(url)) : [])]
  const volume = toNumber(product.lastest_volume)
  return {
    external_id: id,
    title: title.slice(0, 300),
    permalink,
    affiliate_url: affiliate,
    image_url: image,
    price: round2(price),
    original_price: originalRaw !== null && originalRaw > price ? round2(originalRaw) : null,
    currency: 'BRL',
    free_shipping: false, // frete e impostos de importação são calculados na loja
    rating: null,
    reviews_count: null,
    sold_quantity: volume !== null && volume >= 0 ? Math.round(volume) : null,
    offers_count: null,
    condition: 'new',
    brand: null,
    description: null,
    features: [],
    specs: [],
    gallery: [...new Set(gallery)].slice(0, 8),
  }
}
