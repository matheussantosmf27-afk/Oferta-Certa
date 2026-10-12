// Edge Function: coleta do Radar de Ofertas (Mercado Livre).
// Chamada pelo pg_cron (cabeçalho x-radar-secret) ou por um admin no painel (JWT do usuário).
// Também conduz a conexão OAuth com o Mercado Livre (oauth_start / oauth_callback).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  backoffDelay,
  mapWithConcurrency,
  normalizeMercadoLivreCatalogProduct,
  scoreCandidate,
  shouldRetry,
} from '../_shared/radar.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ML_CLIENT_ID = Deno.env.get('ML_CLIENT_ID') ?? ''
const ML_CLIENT_SECRET = Deno.env.get('ML_CLIENT_SECRET') ?? ''
const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://oferta-certa-red.vercel.app').replace(/\/$/, '')
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/radar-collect/oauth/callback`
const ML_API = 'https://api.mercadolibre.com'
const ML_AUTH = 'https://auth.mercadolivre.com.br/authorization'
const MARKETPLACE_SLUG = 'mercado-livre'
const MAX_TERMS_PER_RUN = 12
const MAX_PRODUCTS_PER_TERM = 20
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

/**
 * Busca no CATÁLOGO do Mercado Livre (a busca de anúncios /sites/MLB/search exige
 * permissão especial) e, para cada produto, consulta as ofertas dos vendedores.
 */
async function searchCatalog(db: Admin, term: string, limit: number) {
  const params = new URLSearchParams({ status: 'active', site_id: 'MLB', q: term, limit: String(Math.min(MAX_PRODUCTS_PER_TERM, limit)) })
  const search = await mlGet(db, `/products/search?${params}`)
  const products = Array.isArray(search?.results) ? (search.results as Record<string, unknown>[]) : []

  const candidates = await mapWithConcurrency(products, 4, async (product) => {
    const id = typeof product.id === 'string' ? product.id : ''
    if (!id) return null
    const offers = await mlGet(db, `/products/${encodeURIComponent(id)}/items?limit=20`)
    const candidate = normalizeMercadoLivreCatalogProduct(product, offers)
    if (!candidate) return null
    const { score, breakdown, flags } = scoreCandidate(candidate)
    const results = Array.isArray(offers?.results) ? (offers.results as Record<string, unknown>[]) : []
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
      },
    }
  })

  return { found: products.length, items: candidates.filter((item) => item !== null) }
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
  let fatal: string | null = null

  try {
    const { data: terms, error } = await db
      .from('radar_search_terms')
      .select('id, term, category_id, max_results')
      .eq('active', true)
      .order('last_run_at', { ascending: true, nullsFirst: true })
      .limit(MAX_TERMS_PER_RUN)
    if (error) throw error
    termsCount = terms?.length ?? 0

    for (const term of terms ?? []) {
      try {
        const { found, items } = await searchCatalog(db, term.term, term.max_results)
        fetched += found

        const { data: count, error: upsertError } = await db.rpc('radar_upsert_candidates', {
          p_marketplace_slug: MARKETPLACE_SLUG,
          p_search_term: term.term,
          p_category_id: term.category_id,
          p_items: items,
        })
        if (upsertError) throw upsertError
        upserted += count ?? 0
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
  } catch (runError) {
    fatal = runError instanceof Error ? runError.message : String(runError)
  } finally {
    const status = fatal ? 'error' : errors.length ? (upserted > 0 ? 'partial' : 'error') : 'success'
    const message = fatal ?? (errors.length ? `${errors.length} termo(s) com erro` : `${upserted} candidatos atualizados`)
    await db
      .from('radar_runs')
      .update({
        status,
        finished_at: new Date().toISOString(),
        terms_count: termsCount,
        fetched_count: fetched,
        upserted_count: upserted,
        errors,
        message,
      })
      .eq('id', runId)
    log(status === 'success' ? 'info' : 'warn', 'coleta finalizada', { runId, status, fetched, upserted, errors: errors.length })
  }

  const failed = Boolean(fatal) || (errors.length > 0 && upserted === 0)
  return json(
    { message: fatal ?? `Coleta concluída: ${upserted} candidatos atualizados${errors.length ? `, ${errors.length} termo(s) com erro` : ''}.` },
    failed ? 502 : 200
  )
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

    const body = (await req.json().catch(() => ({}))) as { action?: string; trigger?: string }
    if (body.action === 'oauth_start') {
      if (caller !== 'admin') return json({ error: 'Apenas administradores' }, 403)
      return await oauthStart(db)
    }

    const trigger = caller === 'cron' ? 'schedule' : 'manual'
    return await collect(db, trigger)
  } catch (error) {
    log('error', 'falha inesperada', { message: error instanceof Error ? error.message : String(error) })
    return json({ error: 'Falha inesperada no coletor.' }, 500)
  }
})
