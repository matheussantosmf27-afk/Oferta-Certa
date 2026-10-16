// Edge Function: coleta do Radar de Ofertas (Mercado Livre e, com source='parceiros', Shopee e AliExpress)
// e importação do catálogo em lote (source='catalogo', com dry_run para simular).
// Chamada pelo pg_cron (cabeçalho x-radar-secret) ou por um admin no painel (JWT do usuário).
// Também conduz a conexão OAuth com o Mercado Livre (oauth_start / oauth_callback).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  backoffDelay,
  belowMinPrice,
  extractProductContent,
  mapWithConcurrency,
  marketStats,
  normalizeMercadoLivreCatalogProduct,
  parseHighlights,
  scoreCandidate,
  sellerReputation,
  shouldRetry,
  type MarketStats,
  type SellerReputation,
} from '../_shared/radar.ts'
import {
  affiliateTagFrom,
  affiliateUrlFor,
  MERCADO_LIVRE,
  selectAutoPublishBatch,
  type AutoPublishCandidate,
  type AutoPublishSettings,
} from '../_shared/autopublish.ts'
import {
  bump,
  catalogIssues,
  catalogPublishBlockers,
  classifyIds,
  emptyStats,
  failedSeedState,
  importSummary,
  nextSeedState,
  productIdentifiers,
  seedSearchParams,
  PUBLISH_FRESH_HOURS,
  type CatalogPublishCandidate,
  type CatalogSeed,
  type ImportStats,
} from '../_shared/catalog-import.ts'
import {
  aliexpressRequestUrl,
  normalizeAliexpressProduct,
  normalizeShopeeOffer,
  parseAliexpressProducts,
  parseShopeeResponse,
  SHOPEE_ENDPOINT,
  shopeeAuthHeader,
  shopeeOfferQuery,
  type PartnerCandidate,
} from '../_shared/partners.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ML_CLIENT_ID = Deno.env.get('ML_CLIENT_ID') ?? ''
const ML_CLIENT_SECRET = Deno.env.get('ML_CLIENT_SECRET') ?? ''
const SHOPEE_APP_ID = Deno.env.get('SHOPEE_APP_ID') ?? ''
const SHOPEE_APP_SECRET = Deno.env.get('SHOPEE_APP_SECRET') ?? ''
const ALIEXPRESS_APP_KEY = Deno.env.get('ALIEXPRESS_APP_KEY') ?? ''
const ALIEXPRESS_APP_SECRET = Deno.env.get('ALIEXPRESS_APP_SECRET') ?? ''
const ALIEXPRESS_TRACKING_ID = Deno.env.get('ALIEXPRESS_TRACKING_ID') ?? ''
const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://oferta-certa-red.vercel.app').replace(/\/$/, '')
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/radar-collect/oauth/callback`
const ML_API = 'https://api.mercadolibre.com'
const ML_AUTH = 'https://auth.mercadolivre.com.br/authorization'
const MARKETPLACE_SLUG = MERCADO_LIVRE
const MAX_TERMS_PER_RUN = 12
const MAX_PRODUCTS_PER_TERM = 20
const MAX_BEST_SELLERS_PER_CATEGORY = 10
const MAX_REFRESH_PER_RUN = 60
const MAX_SOURCES_PER_RUN = 12
const MAX_CONTENT_FILL_PER_RUN = 25
const MAX_SELLER_LOOKUPS_PER_RUN = 60
const BEST_SELLERS_TERM = 'mais vendidos'
const TOKEN_PROVIDER = 'mercadolivre'
const STATE_PROVIDER = 'mercadolivre_oauth_state'

type Admin = SupabaseClient

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function log(level: 'info' | 'warn' | 'error', message: string, extra: Record<string, unknown> = {}) {
  console[level === 'info' ? 'log' : level](JSON.stringify({ level, message, ...extra }))
}

/* ------------------------------ Autorização ------------------------------ */

async function authorize(req: Request, db: Admin): Promise<'cron' | 'admin' | null> {
  const secret = req.headers.get('x-radar-secret')
  if (secret) {
    const { data } = await db.rpc('radar_check_secret', { p_secret: secret })
    return data === true ? 'cron' : null
  }
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data: userData, error } = await db.auth.getUser(token)
  if (error || !userData.user) return null
  const { data: profile } = await db.from('profiles').select('role').eq('id', userData.user.id).maybeSingle()
  return profile?.role === 'admin' ? 'admin' : null
}

/* ------------------------- Tokens do Mercado Livre ------------------------ */

async function saveToken(db: Admin, token: { access_token: string; refresh_token?: string; expires_in?: number; user_id?: number }) {
  const expiresAt = new Date(Date.now() + (token.expires_in ?? 21600) * 1000).toISOString()
  const { data: current } = await db.from('integration_tokens').select('refresh_token').eq('provider', TOKEN_PROVIDER).maybeSingle()
  await db.from('integration_tokens').upsert({
    provider: TOKEN_PROVIDER,
    access_token: token.access_token,
    refresh_token: token.refresh_token ?? current?.refresh_token ?? null,
    expires_at: expiresAt,
    meta: token.user_id ? { user_id: token.user_id } : {},
    updated_at: new Date().toISOString(),
  })
}

async function requestToken(params: Record<string, string>) {
  const response = await fetch(`${ML_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ client_id: ML_CLIENT_ID, client_secret: ML_CLIENT_SECRET, ...params }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || !body.access_token) {
    throw new Error(`Mercado Livre recusou o token (${response.status}): ${body.message ?? body.error ?? 'sem detalhes'}`)
  }
  return body as { access_token: string; refresh_token?: string; expires_in?: number; user_id?: number }
}

async function fetchAccessToken(db: Admin, forceRefresh: boolean): Promise<string> {
  if (!ML_CLIENT_ID || !ML_CLIENT_SECRET) {
    throw new Error('Credenciais do Mercado Livre não configuradas (ML_CLIENT_ID e ML_CLIENT_SECRET).')
  }
  const { data: row } = await db.from('integration_tokens').select('*').eq('provider', TOKEN_PROVIDER).maybeSingle()
  const valid = row?.access_token && row.expires_at && new Date(row.expires_at).getTime() > Date.now() + 5 * 60 * 1000
  if (valid && !forceRefresh) return row.access_token as string

  if (row?.refresh_token) {
    const token = await requestToken({ grant_type: 'refresh_token', refresh_token: row.refresh_token as string })
    await saveToken(db, token)
    return token.access_token
  }

  const token = await requestToken({ grant_type: 'client_credentials' })
  await saveToken(db, token)
  return token.access_token
}

// Um único token compartilhado pelas consultas paralelas: o ML invalida o refresh token
// a cada renovação, então duas renovações simultâneas fariam uma delas falhar.
let tokenPromise: Promise<string> | null = null

function getAccessToken(db: Admin): Promise<string> {
  if (!tokenPromise) {
    tokenPromise = fetchAccessToken(db, false).catch((error) => {
      tokenPromise = null
      throw error
    })
  }
  return tokenPromise
}

/** Renova só se ninguém já renovou depois que `staleToken` foi recusado. */
async function refreshAccessToken(db: Admin, staleToken: string): Promise<string> {
  const current = tokenPromise ? await tokenPromise.catch(() => null) : null
  if (current && current !== staleToken) return current
  tokenPromise = fetchAccessToken(db, true).catch((error) => {
    tokenPromise = null
    throw error
  })
  return tokenPromise
}

/* --------------------------------- Busca --------------------------------- */

/** GET autenticado na API do ML com renovação de token e retry. 404 vira null. */
async function mlGet(db: Admin, path: string): Promise<Record<string, unknown> | null> {
  let token = await getAccessToken(db)
  let refreshed = false

  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`${ML_API}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
    if (response.ok) return (await response.json()) as Record<string, unknown>
    if (response.status === 404) return null
    if (response.status === 401 && !refreshed) {
      token = await refreshAccessToken(db, token)
      refreshed = true
      continue
    }
    if (shouldRetry(response.status) && attempt < 3) {
      const retryAfter = Number(response.headers.get('retry-after'))
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffDelay(attempt))
      continue
    }
    const detail = await response.text().catch(() => '')
    throw new Error(`Mercado Livre respondeu ${response.status} em ${path.split('?')[0]}: ${detail.slice(0, 160)}`)
  }
  throw new Error('Mercado Livre não respondeu após várias tentativas')
}

type Dict = Record<string, unknown>

/** Resumo de preço entre vendedores de cada produto consultado nesta coleta (id do catálogo → resumo). */
const marketSeen = new Map<string, MarketStats>()

/**
 * Raio-X do preço: grava, nos produtos publicados vistos nesta coleta, a faixa de preço entre
 * vendedores e a reputação do vendedor da oferta mostrada (só dados públicos da API do ML).
 */
async function updateMarket(db: Admin) {
  const ids = [...marketSeen.keys()]
  if (!ids.length) return 0
  const { data: marketplace } = await db.from('marketplaces').select('id').eq('slug', MARKETPLACE_SLUG).maybeSingle()
  if (!marketplace) return 0

  const published: { external_id: string; seller_name: string | null; market_checked_at: string | null }[] = []
  for (let index = 0; index < ids.length; index += 200) {
    const { data, error } = await db
      .from('products')
      .select('external_id, seller_name, market_checked_at')
      .eq('marketplace_id', marketplace.id)
      .eq('status', 'active')
      .in('external_id', ids.slice(index, index + 200))
    if (error) throw error
    published.push(...((data ?? []) as typeof published))
  }
  if (!published.length) return 0

  // Reputação: só para quem ainda não tem ou foi conferido há mais de 3 dias, com limite por coleta.
  const stale = Date.now() - 3 * 86_400_000
  const sellerIds = [
    ...new Set(
      published
        .filter((row) => !row.seller_name || !row.market_checked_at || new Date(row.market_checked_at).getTime() < stale)
        .map((row) => marketSeen.get(row.external_id)?.best_seller_id)
        .filter((id): id is number => typeof id === 'number')
    ),
  ].slice(0, MAX_SELLER_LOOKUPS_PER_RUN)
  const sellers = new Map<number, SellerReputation | null>()
  await mapWithConcurrency(sellerIds, 4, async (id) => {
    try {
      sellers.set(id, sellerReputation(await mlGet(db, `/users/${id}`)))
    } catch {
      sellers.set(id, null)
    }
  })

  const items = published.map((row) => {
    const stats = marketSeen.get(row.external_id) as MarketStats
    const seller = stats.best_seller_id !== null ? sellers.get(stats.best_seller_id) : undefined
    return { external_id: row.external_id, ...stats, ...(seller ? { seller } : {}) }
  })
  const { data, error } = await db.rpc('radar_update_market', { p_marketplace_slug: MARKETPLACE_SLUG, p_items: items })
  if (error) throw error
  return (data as number | null) ?? 0
}

/** Posição de cada produto nas listas de mais vendidos desta coleta (id do catálogo → posição). */
type BestSellers = Map<string, number>

/** Consulta as ofertas de um produto do catálogo e monta o candidato pontuado (null = sem vendedor). */
async function buildCandidate(db: Admin, product: Dict, bestSellers: BestSellers) {
  const id = typeof product.id === 'string' ? product.id : ''
  if (!id) return null
  const offers = await mlGet(db, `/products/${encodeURIComponent(id)}/items?limit=20`)
  const candidate = normalizeMercadoLivreCatalogProduct(product, offers)
  if (!candidate) return null
  const stats = marketStats(offers)
  if (stats) marketSeen.set(id, stats)
  const { score, breakdown, flags } = scoreCandidate(candidate, { bestSellerPosition: bestSellers.get(id) ?? null, market: stats })
  const results = Array.isArray(offers?.results) ? (offers.results as Dict[]) : []
  const best = results.find((offer) => offer.price === candidate.price)
  return {
    ...candidate,
    score,
    score_breakdown: { ...breakdown, ...(flags.length ? { _alertas: flags } : {}) },
    raw: {
      offers_count: candidate.offers_count,
      best_item_id: best?.item_id ?? null,
      seller_id: best?.seller_id ?? null,
      category_id: best?.category_id ?? null,
      best_seller_position: bestSellers.get(id) ?? null,
      ...productIdentifiers(product.attributes),
    },
  }
}

/**
 * Busca no CATÁLOGO do Mercado Livre (a busca de anúncios /sites/MLB/search exige
 * permissão especial) e, para cada produto, consulta as ofertas dos vendedores.
 * Descarta itens abaixo do preço mínimo do termo (acessórios que não são o produto buscado).
 */
async function searchCatalog(db: Admin, term: string, limit: number, minPrice: number | null, bestSellers: BestSellers) {
  const params = new URLSearchParams({ status: 'active', site_id: 'MLB', q: term, limit: String(Math.min(MAX_PRODUCTS_PER_TERM, limit)) })
  const search = await mlGet(db, `/products/search?${params}`)
  const products = Array.isArray(search?.results) ? (search.results as Dict[]) : []

  const candidates = await mapWithConcurrency(products, 4, (product) => buildCandidate(db, product, bestSellers))
  const valid = candidates.filter((item) => item !== null)
  const items = valid.filter((item) => !belowMinPrice(item.price, minPrice))
  return { found: products.length, items, belowMin: valid.length - items.length }
}

/** Lê as listas de mais vendidos das categorias mapeadas (categories.ml_category_id). */
async function loadBestSellers(db: Admin) {
  const { data: categories, error } = await db
    .from('categories')
    .select('id, name, ml_category_id')
    .not('ml_category_id', 'is', null)
  if (error) throw error

  const positions: BestSellers = new Map()
  const lists: { categoryId: string; name: string; ids: string[] }[] = []
  const errors: { term: string; message: string }[] = []
  for (const category of categories ?? []) {
    try {
      const body = await mlGet(db, `/highlights/MLB/category/${encodeURIComponent(category.ml_category_id as string)}`)
      const entries = parseHighlights(body).slice(0, MAX_BEST_SELLERS_PER_CATEGORY)
      for (const entry of entries) {
        if (!positions.has(entry.id) || (positions.get(entry.id) as number) > entry.position) positions.set(entry.id, entry.position)
      }
      lists.push({ categoryId: category.id, name: category.name, ids: entries.map((entry) => entry.id) })
    } catch (error) {
      errors.push({ term: `mais vendidos: ${category.name}`, message: error instanceof Error ? error.message : String(error) })
    }
  }
  return { positions, lists, errors }
}

/**
 * Mais vendidos por SUBCATEGORIA (tabela radar_best_seller_sources), em rodízio: a cada coleta
 * entram as fontes há mais tempo sem consulta. Registra o resultado de cada fonte para o painel.
 */
async function loadBestSellerSources(db: Admin, positions: BestSellers) {
  const { data: sources, error } = await db
    .from('radar_best_seller_sources')
    .select('ml_category_id, name, category_id, max_items')
    .eq('active', true)
    .order('last_run_at', { ascending: true, nullsFirst: true })
    .limit(MAX_SOURCES_PER_RUN)
  if (error) throw error

  const lists: { categoryId: string; name: string; ids: string[] }[] = []
  const errors: { term: string; message: string }[] = []
  for (const source of sources ?? []) {
    let status = 'ok'
    let count = 0
    try {
      const body = await mlGet(db, `/highlights/MLB/category/${encodeURIComponent(source.ml_category_id as string)}`)
      const entries = parseHighlights(body).slice(0, (source.max_items as number) ?? 20)
      count = entries.length
      if (!entries.length) status = 'sem_lista'
      for (const entry of entries) {
        if (!positions.has(entry.id) || (positions.get(entry.id) as number) > entry.position) positions.set(entry.id, entry.position)
      }
      if (entries.length) lists.push({ categoryId: source.category_id as string, name: source.name as string, ids: entries.map((entry) => entry.id) })
    } catch (sourceError) {
      status = 'erro'
      errors.push({ term: `mais vendidos: ${source.name}`, message: sourceError instanceof Error ? sourceError.message : String(sourceError) })
    }
    await db
      .from('radar_best_seller_sources')
      .update({ last_run_at: new Date().toISOString(), last_status: status, last_count: count })
      .eq('ml_category_id', source.ml_category_id)
  }
  return { lists, errors }
}

/** Busca no catálogo do ML o conteúdo (descrição, destaques, ficha, fotos) dos publicados que ainda estão sem descrição. */
async function fillMissingContent(db: Admin) {
  const { data: marketplace } = await db.from('marketplaces').select('id').eq('slug', MARKETPLACE_SLUG).maybeSingle()
  if (!marketplace) return 0
  const { data: products, error } = await db
    .from('products')
    .select('id, external_id')
    .eq('status', 'active')
    .eq('marketplace_id', marketplace.id)
    .or('description.is.null,description.eq.')
    .not('external_id', 'is', null)
    .limit(MAX_CONTENT_FILL_PER_RUN)
  if (error) throw error
  const items = (
    await mapWithConcurrency(products ?? [], 4, async (product) => {
      try {
        const detail = await mlGet(db, `/products/${encodeURIComponent(product.external_id as string)}`)
        if (!detail) return null
        const content = extractProductContent(detail)
        if (!content.description && !content.features.length && !content.specs.length) return null
        return { product_id: product.id, ...content }
      } catch {
        return null
      }
    })
  ).filter((item) => item !== null)
  if (!items.length) return 0
  const { data, error: fillError } = await db.rpc('radar_fill_product_content', { p_items: items })
  if (fillError) throw fillError
  return (data as number | null) ?? 0
}

/**
 * Reconsulta as ofertas dos produtos publicados que NÃO apareceram nesta coleta:
 * atualiza o preço ou, sem vendedor (404 / nenhuma oferta válida), conta uma ausência.
 * Duas ausências seguidas tornam o produto inativo (no banco, radar_refresh_products).
 */
async function refreshPublished(db: Admin, seen: Set<string>, limit = MAX_REFRESH_PER_RUN) {
  const { data: marketplace } = await db.from('marketplaces').select('id').eq('slug', MARKETPLACE_SLUG).maybeSingle()
  if (!marketplace) return { refreshed: 0, expired: 0 }
  const { data: products, error } = await db
    .from('products')
    .select('id, name, external_id')
    .eq('status', 'active')
    .eq('marketplace_id', marketplace.id)
    .not('external_id', 'is', null)
    .order('offer_checked_at', { ascending: true, nullsFirst: true })
    .limit(limit + seen.size)
  if (error) throw error

  const pending = (products ?? []).filter((product) => !seen.has(product.external_id as string)).slice(0, limit)
  const results = await mapWithConcurrency(pending, 4, async (product) => {
    try {
      const offers = await mlGet(db, `/products/${encodeURIComponent(product.external_id as string)}/items?limit=20`)
      const candidate = normalizeMercadoLivreCatalogProduct({ id: product.external_id, name: product.name }, offers)
      const stats = marketStats(offers)
      if (stats) marketSeen.set(product.external_id as string, stats)
      return candidate
        ? { product_id: product.id, available: true, price: candidate.price, original_price: candidate.original_price, free_shipping: candidate.free_shipping }
        : { product_id: product.id, available: false }
    } catch (error) {
      // Falha de rede/API não conta como "sem vendedor".
      log('warn', 'reconsulta falhou', { productId: product.id, message: error instanceof Error ? error.message : String(error) })
      return null
    }
  })
  const items = results.filter((item) => item !== null)
  if (!items.length) return { refreshed: 0, expired: 0 }
  const { data, error: refreshError } = await db.rpc('radar_refresh_products', { p_items: items }).maybeSingle()
  if (refreshError) throw refreshError
  const row = data as { refreshed?: number; expired?: number } | null
  return { refreshed: row?.refreshed ?? 0, expired: row?.expired ?? 0 }
}

/** Início do dia em São Paulo (sem horário de verão desde 2019: UTC−3). */
function startOfTodaySaoPaulo(): string {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  return new Date(`${day}T00:00:00-03:00`).toISOString()
}

/**
 * Publicação automática (desligada por padrão). Só candidatos elegíveis desta coleta, com o link
 * de afiliado montado a partir da etiqueta configurada. O banco reconfere tudo em publish_candidate_internal.
 */
async function autoPublish(db: Admin, runId: string) {
  const { data: settings, error } = await db.from('automation_settings').select('*').maybeSingle()
  if (error) throw error
  if (!settings?.auto_publish_enabled) return { published: 0, errors: [] as { term: string; message: string }[] }
  const config = settings as AutoPublishSettings
  // Etiqueta só é exigida para o Mercado Livre; Shopee e AliExpress trazem o link pronto da API.
  const tag = affiliateTagFrom(config)

  const [{ count: publishedToday }, { data: marketplaces }] = await Promise.all([
    // Limite diário das ofertas do Radar; publicações do catálogo têm limite próprio.
    db
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('publish_mode', 'auto')
      .or('publish_source.is.null,publish_source.eq.radar')
      .gte('published_at', startOfTodaySaoPaulo()),
    db.from('marketplaces').select('id, slug'),
  ])
  const slugById = new Map((marketplaces ?? []).map((m) => [m.id as string, m.slug as string]))

  const { data: rows, error: listError } = await db
    .from('candidate_products')
    .select('id, status, is_demo, score, score_breakdown, image_url, price, original_price, suggested_category_id, last_run_id, product_id, permalink, affiliate_url, marketplace_id')
    .eq('status', 'pending')
    .eq('is_demo', false)
    .eq('last_run_id', runId)
    .gt('score', config.auto_publish_min_score)
    .order('score', { ascending: false })
    .limit(200)
  if (listError) throw listError
  const candidates = (rows ?? []).map((row) => ({ ...row, marketplace_slug: slugById.get(row.marketplace_id as string) ?? null })) as AutoPublishCandidate[]

  const batch = selectAutoPublishBatch(candidates, config, runId, publishedToday ?? 0)
  const errors: { term: string; message: string }[] = []
  if (!tag && candidates.some((c) => !c.marketplace_slug || c.marketplace_slug === MERCADO_LIVRE)) {
    errors.push({ term: 'publicação automática', message: 'Etiqueta de afiliado do Mercado Livre não configurada.' })
  }
  let published = 0
  for (const candidate of batch) {
    const url = affiliateUrlFor(candidate, tag)
    if (!url) continue
    const { error: publishError } = await db.rpc('publish_candidate_internal', {
      p_candidate_id: candidate.id,
      p_affiliate_url: url,
      p_run_id: runId,
    })
    if (publishError) {
      errors.push({ term: 'publicação automática', message: publishError.message })
      // Interruptor desligado ou limite atingido: para na hora.
      if (/desligada|Limite/i.test(publishError.message)) break
      continue
    }
    published++
  }
  return { published, errors }
}

/**
 * Garante no cache (ml_categories) o caminho raiz→folha de cada categoria do ML usada nesta coleta.
 * O banco usa esse caminho para escolher a categoria do site (ml_resolve_category); sem ele, vale
 * a categoria do termo. Falhas aqui não interrompem a coleta.
 */
const knownCategories = new Set<string>()
async function ensureCategoryPaths(db: Admin, leafIds: (string | null | undefined)[], maxLookups = 40) {
  const wanted = [...new Set(leafIds.filter((id): id is string => typeof id === 'string' && /^MLB\d+$/.test(id)))].filter(
    (id) => !knownCategories.has(id)
  )
  if (!wanted.length) return
  const { data: cached } = await db.from('ml_categories').select('id').in('id', wanted)
  for (const row of cached ?? []) knownCategories.add(row.id as string)
  const missing = wanted.filter((id) => !knownCategories.has(id)).slice(0, maxLookups)
  const rows = await mapWithConcurrency(missing, 4, async (id) => {
    try {
      const body = await mlGet(db, `/categories/${encodeURIComponent(id)}`)
      const path = Array.isArray(body?.path_from_root) ? (body.path_from_root as Dict[]) : []
      if (!path.length || typeof body?.name !== 'string') return null
      return {
        id,
        name: body.name,
        path: path.map((node) => String(node.id)),
        path_names: path.map((node) => String(node.name)),
      }
    } catch {
      return null
    }
  })
  const valid = rows.filter((row) => row !== null)
  if (valid.length) {
    const { error } = await db.from('ml_categories').upsert(valid)
    if (!error) for (const row of valid) knownCategories.add(row.id)
  }
}

/* -------------------------------- Coleta --------------------------------- */

async function collect(db: Admin, trigger: string) {
  const { data: runId, error: beginError } = await db.rpc('radar_begin_run', { p_trigger: trigger })
  if (beginError) throw beginError
  if (!runId) return json({ message: 'Já existe uma coleta em andamento.' }, 409)

  const errors: { term: string; message: string }[] = []
  let fetched = 0
  let upserted = 0
  let termsCount = 0
  let belowMin = 0
  let refreshed = 0
  let expired = 0
  let autoPublished = 0
  let contentFilled = 0
  let marketUpdated = 0
  let fatal: string | null = null
  marketSeen.clear()

  try {
    const { data: terms, error } = await db
      .from('radar_search_terms')
      .select('id, term, category_id, max_results, min_price, marketplaces')
      .eq('active', true)
      .order('last_run_at', { ascending: true, nullsFirst: true })
      .limit(MAX_TERMS_PER_RUN)
    if (error) throw error
    termsCount = terms?.length ?? 0

    const bestSellers = await loadBestSellers(db)
    errors.push(...bestSellers.errors)
    try {
      const sources = await loadBestSellerSources(db, bestSellers.positions)
      bestSellers.lists.push(...sources.lists)
      errors.push(...sources.errors)
    } catch (sourcesError) {
      errors.push({ term: 'mais vendidos por subcategoria', message: sourcesError instanceof Error ? sourcesError.message : String(sourcesError) })
    }
    const seen = new Set<string>()

    const save = async (term: string, categoryId: string | null, items: { external_id: string; raw?: { category_id?: unknown } }[]) => {
      await ensureCategoryPaths(db, items.map((item) => (typeof item.raw?.category_id === 'string' ? item.raw.category_id : null)))
      const { data: count, error: upsertError } = await db.rpc('radar_upsert_candidates', {
        p_marketplace_slug: MARKETPLACE_SLUG,
        p_search_term: term,
        p_category_id: categoryId,
        p_items: items,
        p_run_id: runId,
      })
      if (upsertError) throw upsertError
      for (const item of items) seen.add(item.external_id)
      upserted += count ?? 0
    }

    for (const term of terms ?? []) {
      // Termo desmarcado para o Mercado Livre no painel: só as lojas parceiras pesquisam.
      if (Array.isArray(term.marketplaces) && !(term.marketplaces as string[]).includes(MARKETPLACE_SLUG)) continue
      try {
        const { found, items, belowMin: discarded } = await searchCatalog(db, term.term, term.max_results, term.min_price, bestSellers.positions)
        fetched += found
        belowMin += discarded
        await save(term.term, term.category_id, items)
        await db.from('radar_search_terms').update({ last_run_at: new Date().toISOString() }).eq('id', term.id)
      } catch (termError) {
        const message = termError instanceof Error ? termError.message : String(termError)
        errors.push({ term: term.term, message })
        log('warn', 'termo falhou', { term: term.term, message })
        // Sem credenciais não adianta tentar os demais termos.
        if (/credenciais|recusou o token/i.test(message)) {
          fatal = message
          break
        }
      }
      await sleep(400) // respeita limites de requisição
    }

    // Mais vendidos de cada categoria que ainda não vieram pelos termos.
    if (!fatal) {
      for (const list of bestSellers.lists) {
        try {
          const missing = list.ids.filter((id) => !seen.has(id))
          const items = (
            await mapWithConcurrency(missing, 4, async (id) => {
              const product = await mlGet(db, `/products/${encodeURIComponent(id)}`)
              return product ? buildCandidate(db, product, bestSellers.positions) : null
            })
          ).filter((item) => item !== null)
          fetched += missing.length
          await save(BEST_SELLERS_TERM, list.categoryId, items)
        } catch (listError) {
          errors.push({ term: `mais vendidos: ${list.name}`, message: listError instanceof Error ? listError.message : String(listError) })
        }
        await sleep(200)
      }
    }

    if (!fatal) {
      try {
        const result = await refreshPublished(db, seen)
        refreshed = result.refreshed
        expired = result.expired
      } catch (refreshError) {
        errors.push({ term: 'acompanhamento de preço', message: refreshError instanceof Error ? refreshError.message : String(refreshError) })
      }

      try {
        marketUpdated = await updateMarket(db)
      } catch (marketError) {
        errors.push({ term: 'raio-X do preço', message: marketError instanceof Error ? marketError.message : String(marketError) })
      }

      try {
        contentFilled = await fillMissingContent(db)
      } catch (fillError) {
        errors.push({ term: 'conteúdo dos produtos', message: fillError instanceof Error ? fillError.message : String(fillError) })
      }

      try {
        const result = await autoPublish(db, runId)
        autoPublished = result.published
        errors.push(...result.errors)
      } catch (publishError) {
        errors.push({ term: 'publicação automática', message: publishError instanceof Error ? publishError.message : String(publishError) })
      }
    }
  } catch (runError) {
    fatal = runError instanceof Error ? runError.message : String(runError)
  } finally {
    const status = fatal ? 'error' : errors.length ? (upserted > 0 ? 'partial' : 'error') : 'success'
    const summary = [
      `${upserted} candidatos atualizados`,
      belowMin ? `${belowMin} abaixo do preço mínimo` : '',
      refreshed ? `${refreshed} preços reconsultados` : '',
      expired ? `${expired} inativados sem vendedor` : '',
      autoPublished ? `${autoPublished} publicados automaticamente` : '',
      contentFilled ? `${contentFilled} produtos com conteúdo completado` : '',
      marketUpdated ? `${marketUpdated} com preço entre vendedores` : '',
      errors.length ? `${errors.length} erro(s)` : '',
    ].filter(Boolean).join(', ')
    const message = fatal ?? summary
    await db
      .from('radar_runs')
      .update({
        status,
        finished_at: new Date().toISOString(),
        terms_count: termsCount,
        fetched_count: fetched,
        upserted_count: upserted,
        auto_published_count: autoPublished,
        refreshed_count: refreshed,
        expired_count: expired,
        errors,
        message,
      })
      .eq('id', runId)
    log(status === 'success' ? 'info' : 'warn', 'coleta finalizada', {
      runId, status, fetched, upserted, belowMin, refreshed, expired, autoPublished, errors: errors.length,
    })
  }

  const failed = Boolean(fatal) || (errors.length > 0 && upserted === 0)
  return json(
    { message: fatal ?? `Coleta concluída: ${upserted} candidatos atualizados${autoPublished ? `, ${autoPublished} publicados automaticamente` : ''}${errors.length ? `, ${errors.length} erro(s)` : ''}.` },
    failed ? 502 : 200
  )
}

/* --------------------- Lojas parceiras (Shopee, AliExpress) -------------------- */

const MAX_PARTNER_RESULTS = 20
const MAX_PARTNER_REFRESH = 30

type PartnerSlug = 'shopee' | 'aliexpress'

interface PartnerProvider {
  slug: PartnerSlug
  name: string
  search: (term: string, limit: number) => Promise<PartnerCandidate[]>
  /** Reconsulta produtos publicados: id externo → candidato atual (ausente = sem oferta). */
  lookup: (ids: string[]) => Promise<Map<string, PartnerCandidate>>
}

/** fetch com retry para 429/5xx (as APIs parceiras não usam o token do ML). */
async function partnerFetch(url: string, init?: RequestInit): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, init)
    if (response.ok) return await response.json()
    if (shouldRetry(response.status) && attempt < 2) {
      await sleep(backoffDelay(attempt))
      continue
    }
    const detail = await response.text().catch(() => '')
    throw new Error(`${new URL(url).hostname} respondeu ${response.status}: ${detail.slice(0, 160)}`)
  }
  throw new Error('Loja parceira não respondeu após várias tentativas')
}

function shopeeProvider(): PartnerProvider | null {
  if (!SHOPEE_APP_ID || !SHOPEE_APP_SECRET) return null
  const run = async (params: Parameters<typeof shopeeOfferQuery>[0]) => {
    const payload = shopeeOfferQuery(params)
    const body = await partnerFetch(SHOPEE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: await shopeeAuthHeader(SHOPEE_APP_ID, SHOPEE_APP_SECRET, payload) },
      body: payload,
    })
    return parseShopeeResponse(body).map(normalizeShopeeOffer).filter((item): item is PartnerCandidate => item !== null)
  }
  return {
    slug: 'shopee',
    name: 'Shopee',
    search: (term, limit) => run({ keyword: term, limit, sortType: 2 }),
    lookup: async (ids) => {
      const found = new Map<string, PartnerCandidate>()
      // A API não aceita lote de itemId: uma consulta por produto, com pausa curta.
      for (const id of ids) {
        const [item] = (await run({ itemId: id, limit: 1 })).filter((candidate) => candidate.external_id === id)
        if (item) found.set(id, item)
        await sleep(150)
      }
      return found
    },
  }
}

function aliexpressProvider(): PartnerProvider | null {
  if (!ALIEXPRESS_APP_KEY || !ALIEXPRESS_APP_SECRET || !ALIEXPRESS_TRACKING_ID) return null
  const credentials = { appKey: ALIEXPRESS_APP_KEY, secret: ALIEXPRESS_APP_SECRET, trackingId: ALIEXPRESS_TRACKING_ID }
  const run = async (method: string, params: Record<string, string>) => {
    const url = await aliexpressRequestUrl(method, params, credentials)
    const body = await partnerFetch(url)
    return parseAliexpressProducts(body).map(normalizeAliexpressProduct).filter((item): item is PartnerCandidate => item !== null)
  }
  return {
    slug: 'aliexpress',
    name: 'AliExpress',
    search: (term, limit) =>
      run('aliexpress.affiliate.product.query', { keywords: term, page_no: '1', page_size: String(limit), sort: 'LAST_VOLUME_DESC' }),
    lookup: async (ids) => {
      const found = new Map<string, PartnerCandidate>()
      for (let index = 0; index < ids.length; index += 20) {
        const chunk = ids.slice(index, index + 20)
        for (const item of await run('aliexpress.affiliate.productdetail.get', { product_ids: chunk.join(',') })) found.set(item.external_id, item)
      }
      return found
    },
  }
}

/** Reconsulta os publicados da loja que não apareceram nesta coleta (preço novo ou ausência). */
async function refreshPartner(db: Admin, provider: PartnerProvider, seen: Set<string>) {
  const { data: marketplace } = await db.from('marketplaces').select('id').eq('slug', provider.slug).maybeSingle()
  if (!marketplace) return { refreshed: 0, expired: 0 }
  const { data: products, error } = await db
    .from('products')
    .select('id, external_id')
    .eq('status', 'active')
    .eq('marketplace_id', marketplace.id)
    .not('external_id', 'is', null)
    .order('offer_checked_at', { ascending: true, nullsFirst: true })
    .limit(MAX_PARTNER_REFRESH + seen.size)
  if (error) throw error
  const pending = (products ?? []).filter((product) => !seen.has(product.external_id as string)).slice(0, MAX_PARTNER_REFRESH)
  if (!pending.length) return { refreshed: 0, expired: 0 }

  const found = await provider.lookup(pending.map((product) => product.external_id as string))
  const items = pending.map((product) => {
    const current = found.get(product.external_id as string)
    return current
      ? { product_id: product.id, available: true, price: current.price, original_price: current.original_price, free_shipping: current.free_shipping }
      : { product_id: product.id, available: false }
  })
  const { data, error: refreshError } = await db.rpc('radar_refresh_products', { p_items: items }).maybeSingle()
  if (refreshError) throw refreshError
  const row = data as { refreshed?: number; expired?: number } | null
  return { refreshed: row?.refreshed ?? 0, expired: row?.expired ?? 0 }
}

/** Coleta das lojas parceiras configuradas: busca os termos do Radar, atualiza publicados e publica os elegíveis. */
async function collectPartners(db: Admin, trigger: string) {
  const providers = [shopeeProvider(), aliexpressProvider()].filter((provider): provider is PartnerProvider => provider !== null)
  if (!providers.length) {
    return json({ message: 'Nenhuma loja parceira configurada (faltam as chaves da Shopee e/ou do AliExpress).' }, 200)
  }

  const { data: runId, error: beginError } = await db.rpc('radar_begin_run', { p_trigger: trigger })
  if (beginError) throw beginError
  if (!runId) return json({ message: 'Já existe uma coleta em andamento.' }, 409)
  await db.from('radar_runs').update({ source: 'parceiros' }).eq('id', runId)

  const errors: { term: string; message: string }[] = []
  let fetched = 0
  let upserted = 0
  let belowMin = 0
  let refreshed = 0
  let expired = 0
  let autoPublished = 0
  let termsCount = 0
  let fatal: string | null = null

  try {
    const { data: terms, error } = await db
      .from('radar_search_terms')
      .select('id, term, category_id, max_results, min_price, marketplaces')
      .eq('active', true)
      .order('last_run_at', { ascending: true, nullsFirst: true })
      .limit(MAX_TERMS_PER_RUN)
    if (error) throw error
    termsCount = terms?.length ?? 0

    for (const provider of providers) {
      const seen = new Set<string>()
      for (const term of terms ?? []) {
        const wanted = Array.isArray(term.marketplaces) ? (term.marketplaces as string[]) : []
        if (!wanted.includes(provider.slug)) continue
        try {
          const found = await provider.search(term.term as string, Math.min(MAX_PARTNER_RESULTS, (term.max_results as number) ?? MAX_PARTNER_RESULTS))
          fetched += found.length
          const kept = found.filter((item) => !belowMinPrice(item.price, term.min_price as number | null))
          belowMin += found.length - kept.length
          const items = kept.map((item) => {
            const { score, breakdown, flags } = scoreCandidate(item)
            return {
              ...item,
              score,
              score_breakdown: { ...breakdown, ...(flags.length ? { _alertas: flags } : {}) },
              raw: { source: provider.slug, sold_quantity: item.sold_quantity, rating: item.rating },
            }
          })
          if (items.length) {
            const { data: count, error: upsertError } = await db.rpc('radar_upsert_candidates', {
              p_marketplace_slug: provider.slug,
              p_search_term: term.term,
              p_category_id: term.category_id,
              p_items: items,
              p_run_id: runId,
            })
            if (upsertError) throw upsertError
            upserted += count ?? 0
            for (const item of items) seen.add(item.external_id)
          }
        } catch (termError) {
          const message = termError instanceof Error ? termError.message : String(termError)
          errors.push({ term: `${provider.name}: ${term.term}`, message })
          log('warn', 'termo parceiro falhou', { provider: provider.slug, term: term.term, message })
          // Chave inválida: não adianta tentar os outros termos desta loja.
          if (/signature|assinatura|credential|app_?key|invalid|401|403/i.test(message)) break
        }
        await sleep(300)
      }

      try {
        const result = await refreshPartner(db, provider, seen)
        refreshed += result.refreshed
        expired += result.expired
      } catch (refreshError) {
        errors.push({ term: `${provider.name}: acompanhamento de preço`, message: refreshError instanceof Error ? refreshError.message : String(refreshError) })
      }
    }

    try {
      const result = await autoPublish(db, runId)
      autoPublished = result.published
      errors.push(...result.errors.filter((item) => !/Mercado Livre não configurada/.test(item.message)))
    } catch (publishError) {
      errors.push({ term: 'publicação automática', message: publishError instanceof Error ? publishError.message : String(publishError) })
    }
  } catch (runError) {
    fatal = runError instanceof Error ? runError.message : String(runError)
  } finally {
    const status = fatal ? 'error' : errors.length ? (upserted > 0 ? 'partial' : 'error') : 'success'
    const summary = [
      `Lojas parceiras (${providers.map((provider) => provider.name).join(', ')}): ${upserted} candidatos atualizados`,
      belowMin ? `${belowMin} abaixo do preço mínimo` : '',
      refreshed ? `${refreshed} preços reconsultados` : '',
      expired ? `${expired} inativados sem oferta` : '',
      autoPublished ? `${autoPublished} publicados automaticamente` : '',
      errors.length ? `${errors.length} erro(s)` : '',
    ].filter(Boolean).join(', ')
    await db
      .from('radar_runs')
      .update({
        status,
        finished_at: new Date().toISOString(),
        terms_count: termsCount,
        fetched_count: fetched,
        upserted_count: upserted,
        auto_published_count: autoPublished,
        refreshed_count: refreshed,
        expired_count: expired,
        errors,
        message: fatal ?? summary,
      })
      .eq('id', runId)
    log(status === 'success' ? 'info' : 'warn', 'coleta parceiros finalizada', { runId, status, fetched, upserted, refreshed, expired, autoPublished, errors: errors.length })
  }

  const failed = Boolean(fatal) || (errors.length > 0 && upserted === 0)
  return json({ message: fatal ?? `Lojas parceiras: ${upserted} candidatos atualizados${autoPublished ? `, ${autoPublished} publicados` : ''}${errors.length ? `, ${errors.length} erro(s)` : ''}.` }, failed ? 502 : 200)
}

/* ------------------------- Importação do catálogo ------------------------- */

// A função tem ~150 s por chamada: busca até 80 s, publica até 115 s e grava o resumo.
const CATALOG_SEEDS_UNTIL_MS = 80_000
const CATALOG_TIME_BUDGET_MS = 115_000
const CATALOG_MAX_SEEDS = 40
const CATALOG_DRY_RUN_MAX_SEEDS = 3
const CATALOG_REFRESH_LIMIT = 120
const CATALOG_PUBLISH_BATCH = 400
const MAX_VARIATIONS_PER_PARENT = 3
const MAX_VARIATIONS_PER_PAGE = 30

/** Ids das variações (cor, armazenamento...) de um produto do catálogo do ML. */
function variationIds(product: Dict | undefined): string[] {
  const ids = Array.isArray(product?.children_ids) ? (product.children_ids as unknown[]) : []
  return ids.filter((id): id is string => typeof id === 'string' && /^MLB\d+$/.test(id))
}

/**
 * Publica como produto de catálogo os candidatos completos com vendedor conferido nas últimas horas
 * (inclusive de execuções anteriores que pararam no limite de tempo). O banco reconfere tudo.
 */
async function publishCatalogCandidates(db: Admin, runId: string, deadline: number) {
  const { data: settings, error } = await db.from('automation_settings').select('*').maybeSingle()
  if (error) throw error
  const errors: { term: string; message: string }[] = []
  if (!settings?.auto_publish_enabled || !settings?.catalog_publish_enabled) return { published: 0, errors }
  const tag = affiliateTagFrom(settings as AutoPublishSettings)
  if (!tag) {
    errors.push({ term: 'publicação do catálogo', message: 'Etiqueta de afiliado do Mercado Livre não configurada.' })
  }

  const since = new Date(Date.now() - PUBLISH_FRESH_HOURS * 3_600_000).toISOString()
  const [{ data: rows, error: listError }, { data: marketplaces }] = await Promise.all([
    db
      .from('candidate_products')
      .select('id, status, is_demo, brand, image_url, condition, price, original_price, suggested_category_id, score, score_breakdown, last_seen_at, last_run_id, product_id, permalink, affiliate_url, marketplace_id')
      .eq('status', 'pending')
      .eq('is_demo', false)
      .is('product_id', null)
      .not('suggested_category_id', 'is', null)
      .gte('last_seen_at', since)
      .order('score', { ascending: false })
      .limit(CATALOG_PUBLISH_BATCH),
    db.from('marketplaces').select('id, slug'),
  ])
  if (listError) throw listError
  const slugById = new Map((marketplaces ?? []).map((m) => [m.id as string, m.slug as string]))

  let published = 0
  const now = Date.now()
  for (const row of rows ?? []) {
    if (Date.now() > deadline) break
    // Mesmas regras do banco: o que ele recusaria nem é tentado (não vira erro a cada execução).
    if (catalogPublishBlockers(row as unknown as CatalogPublishCandidate, now, Number(settings.auto_publish_max_discount ?? 100)).length) continue
    const candidate = { ...row, marketplace_slug: slugById.get(row.marketplace_id as string) ?? null } as unknown as AutoPublishCandidate
    const url = affiliateUrlFor(candidate, tag)
    if (!url) continue
    const { error: publishError } = await db.rpc('publish_catalog_candidate_internal', {
      p_candidate_id: row.id,
      p_affiliate_url: url,
      p_run_id: runId,
    })
    if (publishError) {
      errors.push({ term: 'publicação do catálogo', message: publishError.message })
      if (/desligada|Limite/i.test(publishError.message)) break
      continue
    }
    published++
  }
  return { published, errors }
}

/**
 * Importação do catálogo em lote: processa a próxima página de cada semente pendente
 * (catalog_import_seeds), grava os candidatos (upsert pela chave loja + id do produto), publica os
 * completos e registra um resumo com números reais. dry_run consulta a API mas não grava nada.
 */
async function collectCatalog(db: Admin, trigger: string, options: { dryRun: boolean; maxSeeds?: number }) {
  const started = Date.now()
  const elapsed = () => Date.now() - started
  const { data: runId, error: beginError } = await db.rpc('radar_begin_run', { p_trigger: trigger })
  if (beginError) throw beginError
  if (!runId) return json({ message: 'Já existe uma coleta em andamento.' }, 409)
  await db.from('radar_runs').update({ source: 'catalogo', dry_run: options.dryRun }).eq('id', runId)

  const stats: ImportStats = emptyStats(options.dryRun)
  const errors: { term: string; message: string }[] = []
  const preview: { busca: string; encontrados: number; novos: number; atualizados: number; rejeitados: number }[] = []
  const seen = new Set<string>()
  const noBestSellers: BestSellers = new Map()
  let fatal: string | null = null
  marketSeen.clear()

  try {
    const { data: marketplace } = await db.from('marketplaces').select('id').eq('slug', MARKETPLACE_SLUG).maybeSingle()
    if (!marketplace) throw new Error('Loja mercado-livre não cadastrada.')

    // 1. Reconfere o preço dos publicados há mais tempo sem conferência (catálogo grande continua atualizado).
    if (!options.dryRun) {
      try {
        const result = await refreshPublished(db, seen, CATALOG_REFRESH_LIMIT)
        stats.refreshed = result.refreshed
        stats.expired = result.expired
      } catch (refreshError) {
        bump(stats.errors_by_source, MARKETPLACE_SLUG)
        errors.push({ term: 'acompanhamento de preço', message: refreshError instanceof Error ? refreshError.message : String(refreshError) })
      }
    }

    // 2. Sementes pendentes, intercalando categorias (prioridade) e retomando de onde pararam (next_offset).
    const maxSeeds = options.dryRun
      ? Math.min(options.maxSeeds ?? CATALOG_DRY_RUN_MAX_SEEDS, CATALOG_DRY_RUN_MAX_SEEDS)
      : Math.min(options.maxSeeds ?? CATALOG_MAX_SEEDS, CATALOG_MAX_SEEDS)
    const { data: seeds, error: seedsError } = await db
      .from('catalog_import_seeds')
      .select('id, query, category_id, min_price, page_size, max_pages, next_offset, attempts, total_found, total_saved')
      .eq('status', 'pending')
      .eq('marketplace_slug', MARKETPLACE_SLUG)
      .lte('next_run_at', new Date().toISOString())
      .order('priority', { ascending: false })
      .order('next_run_at', { ascending: true })
      .limit(maxSeeds)
    if (seedsError) throw seedsError

    for (const seed of (seeds ?? []) as (CatalogSeed & { total_found: number; total_saved: number })[]) {
      if (elapsed() > CATALOG_SEEDS_UNTIL_MS) break
      stats.seeds_processed++
      try {
        const search = await mlGet(db, `/products/search?${seedSearchParams(seed)}`)
        const products = Array.isArray(search?.results) ? (search.results as Dict[]) : []
        const paging = search?.paging && typeof search.paging === 'object' ? (search.paging as Dict) : null
        const total = paging && Number.isFinite(Number(paging.total)) ? Number(paging.total) : null
        stats.found += products.length

        const byId = new Map(products.map((product) => [String(product.id ?? ''), product]))
        const ids = [...byId.keys()].filter((id) => /^MLB\d+$/.test(id))
        const lastSeen = new Map<string, string | null>()
        if (ids.length) {
          const { data: rows, error } = await db
            .from('candidate_products')
            .select('external_id, last_seen_at')
            .eq('marketplace_id', marketplace.id)
            .in('external_id', ids)
          if (error) throw error
          for (const row of rows ?? []) lastSeen.set(row.external_id as string, row.last_seen_at as string | null)
        }
        const { fresh, duplicates, recent } = classifyIds(ids, seen, lastSeen, Date.now())
        stats.duplicates += duplicates.length
        stats.skipped_recent += recent.length
        stats.checked += fresh.length

        let failures = 0
        const built = await mapWithConcurrency(fresh, 4, async (id) => {
          try {
            return await buildCandidate(db, byId.get(id) as Dict, noBestSellers)
          } catch (lookupError) {
            failures++
            log('warn', 'consulta de ofertas falhou', { id, message: lookupError instanceof Error ? lookupError.message : String(lookupError) })
            return undefined
          }
        })
        // API instável: a página inteira é tentada de novo mais tarde, em vez de perder os produtos.
        if (fresh.length && failures > fresh.length / 2) throw new Error(`Falha ao consultar ${failures} de ${fresh.length} produtos`)

        // Produto "pai" sem ofertas (ex.: o modelo sem cor/armazenamento): as ofertas ficam nas variações.
        const parents = fresh.filter((id, index) => built[index] === null && variationIds(byId.get(id)).length)
        const childIds = parents.flatMap((id) => variationIds(byId.get(id)).slice(0, MAX_VARIATIONS_PER_PARENT)).slice(0, MAX_VARIATIONS_PER_PAGE)
        const parentsWithOffers = new Set<string>()
        if (childIds.length) {
          const childSeen = new Map<string, string | null>()
          const { data: rows, error } = await db
            .from('candidate_products')
            .select('external_id, last_seen_at')
            .eq('marketplace_id', marketplace.id)
            .in('external_id', childIds)
          if (error) throw error
          for (const row of rows ?? []) {
            childSeen.set(row.external_id as string, row.last_seen_at as string | null)
            lastSeen.set(row.external_id as string, row.last_seen_at as string | null)
          }
          const children = classifyIds(childIds, seen, childSeen, Date.now())
          stats.duplicates += children.duplicates.length
          stats.skipped_recent += children.recent.length
          stats.checked += children.fresh.length
          stats.variations_checked += children.fresh.length
          const parentOf = new Map(parents.flatMap((id) => variationIds(byId.get(id)).map((child) => [child, id] as const)))
          for (const child of children.recent) parentsWithOffers.add(parentOf.get(child) as string)
          const childBuilt = await mapWithConcurrency(children.fresh, 4, async (id) => {
            try {
              const product = await mlGet(db, `/products/${encodeURIComponent(id)}`)
              const candidate = product ? await buildCandidate(db, product, noBestSellers) : null
              if (candidate) parentsWithOffers.add(parentOf.get(id) as string)
              return candidate
            } catch (lookupError) {
              failures++
              log('warn', 'consulta de variação falhou', { id, message: lookupError instanceof Error ? lookupError.message : String(lookupError) })
              return undefined
            }
          })
          built.push(...childBuilt.filter((candidate) => candidate !== null))
        }
        if (failures) bump(stats.errors_by_source, MARKETPLACE_SLUG, failures)

        const items: NonNullable<Awaited<ReturnType<typeof buildCandidate>>>[] = []
        let rejected = 0
        for (const [index, candidate] of built.entries()) {
          if (candidate === undefined) continue
          // Pai sem ofertas cujas variações foram importadas não conta como rejeitado.
          if (candidate === null && index < fresh.length && parentsWithOffers.has(fresh[index])) continue
          if (candidate === null) {
            bump(stats.rejected, 'sem_vendedor_ativo')
            rejected++
            continue
          }
          if (belowMinPrice(candidate.price, seed.min_price)) {
            bump(stats.rejected, 'abaixo_do_preco_minimo')
            rejected++
            continue
          }
          for (const issue of catalogIssues(candidate)) bump(stats.incomplete, issue)
          items.push(candidate)
        }
        const created = items.filter((item) => !lastSeen.has(item.external_id)).length
        stats.new += created
        stats.updated += items.length - created

        if (options.dryRun) {
          preview.push({ busca: seed.query, encontrados: products.length, novos: created, atualizados: items.length - created, rejeitados: rejected })
        } else {
          if (items.length) {
            await ensureCategoryPaths(db, items.map((item) => (typeof item.raw.category_id === 'string' ? item.raw.category_id : null)), 120)
            const { error: upsertError } = await db.rpc('radar_upsert_candidates', {
              p_marketplace_slug: MARKETPLACE_SLUG,
              p_search_term: `catálogo: ${seed.query}`,
              p_category_id: seed.category_id,
              p_items: items,
              p_run_id: runId,
            })
            if (upsertError) throw upsertError
          }
          const state = nextSeedState(seed, products.length, total, new Date())
          if (state.status === 'done') stats.seeds_finished++
          const { error: seedError } = await db
            .from('catalog_import_seeds')
            .update({
              ...state,
              last_run_at: new Date().toISOString(),
              last_found: products.length,
              total_found: seed.total_found + products.length,
              total_saved: seed.total_saved + items.length,
            })
            .eq('id', seed.id)
          if (seedError) throw seedError
        }
      } catch (seedError) {
        const message = seedError instanceof Error ? seedError.message : String(seedError)
        stats.seeds_failed++
        bump(stats.errors_by_source, MARKETPLACE_SLUG)
        errors.push({ term: `catálogo: ${seed.query}`, message })
        log('warn', 'semente do catálogo falhou', { query: seed.query, message })
        if (!options.dryRun) {
          await db
            .from('catalog_import_seeds')
            .update({ ...failedSeedState(seed, message, new Date()), last_run_at: new Date().toISOString() })
            .eq('id', seed.id)
        }
        if (/credenciais|recusou o token/i.test(message)) {
          fatal = message
          break
        }
      }
      await sleep(200)
    }

    if (!options.dryRun && !fatal) {
      try {
        const result = await publishCatalogCandidates(db, runId, started + CATALOG_TIME_BUDGET_MS)
        stats.published = result.published
        stats.publish_errors = result.errors.length
        errors.push(...result.errors.slice(0, 10))
      } catch (publishError) {
        errors.push({ term: 'publicação do catálogo', message: publishError instanceof Error ? publishError.message : String(publishError) })
      }
      try {
        await updateMarket(db)
      } catch (marketError) {
        errors.push({ term: 'raio-X do preço', message: marketError instanceof Error ? marketError.message : String(marketError) })
      }
      const { count } = await db
        .from('candidate_products')
        .select('id', { count: 'exact', head: true })
        .eq('last_run_id', runId)
        .eq('status', 'pending')
      stats.pending_review = count ?? 0
    }
  } catch (runError) {
    fatal = runError instanceof Error ? runError.message : String(runError)
  } finally {
    const worked = stats.seeds_processed > stats.seeds_failed || stats.refreshed > 0
    const status = fatal ? 'error' : errors.length ? (worked ? 'partial' : 'error') : 'success'
    const message = fatal ?? importSummary(stats)
    await db
      .from('radar_runs')
      .update({
        status,
        finished_at: new Date().toISOString(),
        terms_count: stats.seeds_processed,
        fetched_count: stats.found,
        upserted_count: options.dryRun ? 0 : stats.new + stats.updated,
        auto_published_count: stats.published,
        refreshed_count: stats.refreshed,
        expired_count: stats.expired,
        errors: errors.slice(0, 50),
        message,
        stats: options.dryRun ? { ...stats, preview } : stats,
      })
      .eq('id', runId)
    log(status === 'success' ? 'info' : 'warn', 'importação do catálogo finalizada', { runId, status, ...stats })
  }

  return json({ message: fatal ?? importSummary(stats), stats, ...(options.dryRun ? { preview } : {}) }, fatal ? 502 : 200)
}

/* --------------------------------- OAuth --------------------------------- */

async function oauthStart(db: Admin) {
  if (!ML_CLIENT_ID) return json({ error: 'ML_CLIENT_ID não configurado.' }, 400)
  const state = crypto.randomUUID()
  await db.from('integration_tokens').upsert({
    provider: STATE_PROVIDER,
    access_token: state,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  })
  const url = `${ML_AUTH}?${new URLSearchParams({ response_type: 'code', client_id: ML_CLIENT_ID, redirect_uri: REDIRECT_URI, state })}`
  return json({ url })
}

async function oauthCallback(db: Admin, params: URLSearchParams) {
  const back = (kind: 'ok' | 'erro', message: string) =>
    Response.redirect(`${SITE_URL}/admin/radar?${kind}=${encodeURIComponent(message)}`, 302)

  const code = params.get('code')
  const state = params.get('state')
  if (!code || !state) return back('erro', 'Resposta do Mercado Livre incompleta.')

  const { data: row } = await db.from('integration_tokens').select('*').eq('provider', STATE_PROVIDER).maybeSingle()
  const validState = row?.access_token === state && row.expires_at && new Date(row.expires_at).getTime() > Date.now()
  await db.from('integration_tokens').delete().eq('provider', STATE_PROVIDER)
  if (!validState) return back('erro', 'Link de conexão expirado. Tente conectar de novo.')

  try {
    const token = await requestToken({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI })
    await saveToken(db, token)
    return back('ok', 'Mercado Livre conectado. Você já pode executar o coletor.')
  } catch (error) {
    return back('erro', error instanceof Error ? error.message : 'Falha ao conectar o Mercado Livre.')
  }
}

/* -------------------------------- Handler -------------------------------- */

Deno.serve(async (req) => {
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const url = new URL(req.url)

  try {
    if (req.method === 'GET' && url.pathname.endsWith('/oauth/callback')) {
      return await oauthCallback(db, url.searchParams)
    }
    if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

    const caller = await authorize(req, db)
    if (!caller) return json({ error: 'Não autorizado' }, 401)

    const body = (await req.json().catch(() => ({}))) as { action?: string; trigger?: string; source?: string; dry_run?: boolean; max_seeds?: number }
    if (body.action === 'oauth_start') {
      if (caller !== 'admin') return json({ error: 'Apenas administradores' }, 403)
      return await oauthStart(db)
    }

    const trigger = caller === 'cron' ? 'schedule' : 'manual'
    if (body.source === 'parceiros') return await collectPartners(db, trigger)
    if (body.source === 'catalogo') {
      const maxSeeds = Number.isInteger(body.max_seeds) && (body.max_seeds as number) > 0 ? (body.max_seeds as number) : undefined
      return await collectCatalog(db, trigger, { dryRun: body.dry_run === true, maxSeeds })
    }
    return await collect(db, trigger)
  } catch (error) {
    log('error', 'falha inesperada', { message: error instanceof Error ? error.message : String(error) })
    return json({ error: 'Falha inesperada no coletor.' }, 500)
  }
})
