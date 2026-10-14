'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { getPublicSupabaseEnv } from '@/lib/supabase/env'
import { slugify } from '@/lib/slug'
import { parseStores } from '@/lib/stores'
import { analyzeMercadoLivreAffiliateLink, buildMercadoLivreAffiliateUrl } from '@/supabase/functions/_shared/autopublish'

// Todas as ações usam o cliente da sessão: o RLS (is_admin) é a barreira final,
// e requireAdmin() bloqueia antes mesmo de chegar ao banco.

function text(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

function optionalNumber(formData: FormData, name: string): number | null {
  // Campos usam <input type="number" step="0.01">, que sempre envia ponto decimal.
  const raw = text(formData, name).replace(',', '.')
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : null
}

function back(path: string, kind: 'ok' | 'erro', message: string): never {
  const separator = path.includes('?') ? '&' : '?'
  redirect(`${path}${separator}${kind}=${encodeURIComponent(message)}`)
}

function returnTo(formData: FormData, fallback: string): string {
  const value = text(formData, 'return_to')
  return value.startsWith('/admin') ? value : fallback
}

function friendly(error: { message: string; code?: string }): string {
  if (error.code === '23505') return 'Já existe um registro com esse identificador (slug ou código).'
  if (error.code === '23503') return 'Não é possível excluir: há registros ligados a este item.'
  return error.message
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

/* ------------------------------- Radar ------------------------------- */

export async function publishCandidate(formData: FormData) {
  await requireAdmin()
  const path = returnTo(formData, '/admin/radar')
  const candidateId = text(formData, 'candidate_id')
  const affiliateUrl = text(formData, 'affiliate_url')
  const categoryId = text(formData, 'category_id')
  const name = text(formData, 'name')

  if (!affiliateUrl) back(path, 'erro', 'Cole o seu link de afiliado antes de publicar.')
  if (!categoryId) back(path, 'erro', 'Escolha a categoria do produto.')

  const supabase = await createServerClient()
  const { error } = await supabase.rpc('publish_candidate', {
    p_candidate_id: candidateId,
    p_affiliate_url: affiliateUrl,
    p_category_id: categoryId,
    p_name: name || undefined,
  })
  if (error) back(path, 'erro', friendly(error))

  revalidatePath('/', 'layout')
  back(path, 'ok', 'Produto publicado no site.')
}

export async function rejectCandidate(formData: FormData) {
  const user = await requireAdmin()
  const path = returnTo(formData, '/admin/radar')
  const candidateId = text(formData, 'candidate_id')
  const reason = text(formData, 'reason').slice(0, 300) || null

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('candidate_products')
    .update({ status: 'rejected', rejection_reason: reason, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', candidateId)
    .eq('status', 'pending')
  if (error) back(path, 'erro', friendly(error))
  back(path, 'ok', 'Candidato rejeitado.')
}

export async function restoreCandidate(formData: FormData) {
  await requireAdmin()
  const path = returnTo(formData, '/admin/radar')
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('candidate_products')
    .update({ status: 'pending', rejection_reason: null, reviewed_by: null, reviewed_at: null })
    .eq('id', text(formData, 'candidate_id'))
    .eq('status', 'rejected')
  if (error) back(path, 'erro', friendly(error))
  back(path, 'ok', 'Candidato voltou para a fila.')
}

/** Dispara o coletor (Edge Function) usando a sessão do admin. */
export async function runRadarNow(formData?: FormData) {
  await requireAdmin()
  // 'parceiros' = Shopee e AliExpress; sem valor = Mercado Livre.
  const source = formData?.get('source') === 'parceiros' ? 'parceiros' : undefined
  const supabase = await createServerClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) back('/admin/radar', 'erro', 'Sessão expirada. Entre novamente.')

  const { url, publishableKey } = getPublicSupabaseEnv()
  let message = ''
  let ok = false
  try {
    const response = await fetch(`${url}/functions/v1/radar-collect`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'manual', ...(source ? { source } : {}) }),
      cache: 'no-store',
      signal: AbortSignal.timeout(55_000),
    })
    const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string }
    ok = response.ok
    message = body.message ?? body.error ?? `Resposta ${response.status}`
  } catch (error) {
    message = error instanceof Error && error.name === 'TimeoutError'
      ? 'A coleta continua em segundo plano; atualize a página em alguns minutos.'
      : 'Não foi possível chamar o coletor.'
    ok = error instanceof Error && error.name === 'TimeoutError'
  }
  revalidatePath('/admin/radar')
  back('/admin/radar', ok ? 'ok' : 'erro', message)
}

/** Inicia a conexão OAuth com o Mercado Livre e leva o admin à tela de autorização. */
export async function connectMercadoLivre() {
  await requireAdmin()
  const supabase = await createServerClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) back('/admin/radar', 'erro', 'Sessão expirada. Entre novamente.')

  const { url, publishableKey } = getPublicSupabaseEnv()
  let authorizeUrl: string | null = null
  let message = 'Não foi possível iniciar a conexão.'
  try {
    const response = await fetch(`${url}/functions/v1/radar-collect`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'oauth_start' }),
      cache: 'no-store',
    })
    const body = (await response.json().catch(() => ({}))) as { url?: string; error?: string }
    if (response.ok && body.url?.startsWith('https://auth.mercadolivre.com.br/')) authorizeUrl = body.url
    else if (body.error) message = body.error
  } catch {
    // mensagem padrão
  }
  if (!authorizeUrl) back('/admin/radar', 'erro', message)
  redirect(authorizeUrl)
}

export async function saveSearchTerm(formData: FormData) {
  await requireAdmin()
  const id = text(formData, 'id')
  const term = text(formData, 'term').toLowerCase().slice(0, 80)
  const maxResults = Math.min(50, Math.max(1, Number(text(formData, 'max_results')) || 30))
  const payload = {
    term,
    category_id: text(formData, 'category_id') || null,
    max_results: maxResults,
    min_price: optionalNumber(formData, 'min_price'),
    active: formData.get('active') === 'on',
    marketplaces: parseStores(formData.getAll('marketplaces')),
  }
  if (!term) back('/admin/radar/termos', 'erro', 'Informe o termo de busca.')
  if (!payload.marketplaces.length) back('/admin/radar/termos', 'erro', 'Marque pelo menos uma loja para o termo.')

  const supabase = await createServerClient()
  const { error } = id
    ? await supabase.from('radar_search_terms').update(payload).eq('id', id)
    : await supabase.from('radar_search_terms').insert(payload)
  if (error) back('/admin/radar/termos', 'erro', friendly(error))
  back('/admin/radar/termos', 'ok', 'Termo salvo.')
}

export async function deleteSearchTerm(formData: FormData) {
  await requireAdmin()
  const supabase = await createServerClient()
  const { error } = await supabase.from('radar_search_terms').delete().eq('id', text(formData, 'id'))
  if (error) back('/admin/radar/termos', 'erro', friendly(error))
  back('/admin/radar/termos', 'ok', 'Termo excluído.')
}

/* ------------------------ Publicação automática ----------------------- */

function boundedInt(formData: FormData, name: string, min: number, max: number, fallback: number): number {
  const value = Math.round(Number(text(formData, name)))
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

export async function saveAutomationSettings(formData: FormData) {
  const user = await requireAdmin()
  const path = '/admin/automacao'
  const enabled = formData.get('auto_publish_enabled') === 'on'

  const supabase = await createServerClient()
  // A etiqueta de afiliado só muda por validateAffiliateLink (link real reproduzido); aqui ela não é editável.
  const { data: current } = await supabase.from('automation_settings').select('ml_matt_word, ml_matt_tool').maybeSingle()
  if (enabled && (!current?.ml_matt_word || !current?.ml_matt_tool)) {
    back(path, 'erro', 'Valide um link de afiliado real antes de ligar a publicação automática.')
  }

  const { error } = await supabase
    .from('automation_settings')
    .update({
      auto_publish_enabled: enabled,
      auto_publish_min_score: boundedInt(formData, 'auto_publish_min_score', 0, 100, 40),
      auto_publish_max_per_run: boundedInt(formData, 'auto_publish_max_per_run', 0, 200, 20),
      auto_publish_max_per_day: boundedInt(formData, 'auto_publish_max_per_day', 0, 1000, 100),
      auto_publish_max_discount: boundedInt(formData, 'auto_publish_max_discount', 0, 100, 60),
      auto_publish_block_foreign_titles: formData.get('auto_publish_block_foreign_titles') === 'on',
      updated_by: user.id,
    })
    .eq('id', true)
  if (error) back(path, 'erro', friendly(error))
  back(path, 'ok', enabled ? 'Configuração salva. Publicação automática LIGADA.' : 'Configuração salva. Publicação automática desligada.')
}

/** Desligamento imediato: a Edge Function e o banco checam o interruptor antes de cada publicação. */
export async function disableAutoPublish() {
  const user = await requireAdmin()
  const supabase = await createServerClient()
  const { error } = await supabase.from('automation_settings').update({ auto_publish_enabled: false, updated_by: user.id }).eq('id', true)
  if (error) back('/admin/automacao', 'erro', friendly(error))
  back('/admin/automacao', 'ok', 'Publicação automática desligada.')
}

/**
 * Analisa um link de afiliado REAL gerado no portal (passo 4.2 b/c): só aceita o link completo com
 * matt_word e matt_tool fixos, e confere se o construtor reproduz exatamente o mesmo link.
 * Se tudo bater, guarda a etiqueta (sem ligar a automação).
 */
export async function validateAffiliateLink(formData: FormData) {
  const user = await requireAdmin()
  const path = '/admin/automacao'
  const link = text(formData, 'affiliate_link')
  const analysis = analyzeMercadoLivreAffiliateLink(link)
  if (analysis.kind !== 'params') back(path, 'erro', analysis.reason)
  if (analysis.extraParams.length) {
    back(
      path,
      'erro',
      `O link tem parâmetros além de matt_word e matt_tool (${analysis.extraParams.join(', ')}). Gere outro link para o mesmo produto e compare: se algum valor mudar, a geração automática não é confiável.`
    )
  }
  const rebuilt = buildMercadoLivreAffiliateUrl(analysis.productUrl, analysis.tag)
  if (rebuilt !== new URL(link).toString()) back(path, 'erro', 'O link montado automaticamente não ficou idêntico ao link real. Mantenha o fluxo manual.')

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('automation_settings')
    .update({ ml_matt_word: analysis.tag.mattWord, ml_matt_tool: analysis.tag.mattTool, updated_by: user.id })
    .eq('id', true)
  if (error) back(path, 'erro', friendly(error))
  back(path, 'ok', 'Link completo reconhecido e reproduzido parâmetro a parâmetro. Etiqueta salva; a automação continua desligada até você ligar.')
}

export async function unpublishProduct(formData: FormData) {
  await requireAdmin()
  const path = returnTo(formData, '/admin/produtos')
  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc('unpublish_products', { p_product_ids: [text(formData, 'product_id')] })
  if (error) back(path, 'erro', friendly(error))
  revalidatePath('/', 'layout')
  back(path, 'ok', data ? 'Produto despublicado (inativo).' : 'O produto já não estava publicado.')
}

export async function unpublishRun(formData: FormData) {
  await requireAdmin()
  const path = returnTo(formData, '/admin/automacao')
  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc('unpublish_products', { p_run_id: text(formData, 'run_id') })
  if (error) back(path, 'erro', friendly(error))
  revalidatePath('/', 'layout')
  back(path, 'ok', `${data ?? 0} produto(s) publicados automaticamente nessa execução foram despublicados.`)
}

/* ----------------------------- Categorias ---------------------------- */

export async function saveCategory(formData: FormData) {
  await requireAdmin()
  const id = text(formData, 'id')
  const name = text(formData, 'name')
  if (!name) back('/admin/categorias', 'erro', 'Informe o nome da categoria.')
  const payload = {
    name,
    slug: slugify(text(formData, 'slug') || name),
    description: text(formData, 'description') || null,
    icon: text(formData, 'icon') || null,
  }
  const supabase = await createServerClient()
  const { error } = id
    ? await supabase.from('categories').update(payload).eq('id', id)
    : await supabase.from('categories').insert(payload)
  if (error) back('/admin/categorias', 'erro', friendly(error))
  revalidatePath('/', 'layout')
  back('/admin/categorias', 'ok', 'Categoria salva.')
}

export async function deleteCategory(formData: FormData) {
  await requireAdmin()
  const supabase = await createServerClient()
  const { error } = await supabase.from('categories').delete().eq('id', text(formData, 'id'))
  if (error) back('/admin/categorias', 'erro', friendly(error))
  revalidatePath('/', 'layout')
  back('/admin/categorias', 'ok', 'Categoria excluída.')
}

/* ---------------------------- Marketplaces --------------------------- */

export async function saveMarketplace(formData: FormData) {
  await requireAdmin()
  const id = text(formData, 'id')
  const name = text(formData, 'name')
  if (!name) back('/admin/marketplaces', 'erro', 'Informe o nome do marketplace.')
  const hosts = text(formData, 'affiliate_hosts')
    .split(/[\s,]+/)
    .map((host) => host.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
    .filter(Boolean)
  const payload = {
    name,
    slug: slugify(text(formData, 'slug') || name),
    logo: text(formData, 'logo') || null,
    active: formData.get('active') === 'on',
    affiliate_hosts: hosts,
  }
  const supabase = await createServerClient()
  const { error } = id
    ? await supabase.from('marketplaces').update(payload).eq('id', id)
    : await supabase.from('marketplaces').insert(payload)
  if (error) back('/admin/marketplaces', 'erro', friendly(error))
  back('/admin/marketplaces', 'ok', 'Marketplace salvo.')
}

export async function deleteMarketplace(formData: FormData) {
  await requireAdmin()
  const supabase = await createServerClient()
  const { error } = await supabase.from('marketplaces').delete().eq('id', text(formData, 'id'))
  if (error) back('/admin/marketplaces', 'erro', friendly(error))
  back('/admin/marketplaces', 'ok', 'Marketplace excluído.')
}

/* ------------------------------ Produtos ----------------------------- */

export async function saveProduct(formData: FormData) {
  await requireAdmin()
  const id = text(formData, 'id')
  const formPath = id ? `/admin/produtos/${id}` : '/admin/produtos/novo'

  const name = text(formData, 'name')
  const affiliateUrl = text(formData, 'affiliate_url')
  const imageUrl = text(formData, 'image_url')
  const currentPrice = optionalNumber(formData, 'current_price')
  const oldPrice = optionalNumber(formData, 'old_price')
  const status = text(formData, 'status') as 'draft' | 'active' | 'inactive' | 'expired'

  if (!name) back(formPath, 'erro', 'Informe o nome do produto.')
  if (currentPrice === null) back(formPath, 'erro', 'Informe um preço atual válido.')
  if (!text(formData, 'category_id') || !text(formData, 'marketplace_id')) back(formPath, 'erro', 'Escolha categoria e marketplace.')
  if (affiliateUrl && !isHttpsUrl(affiliateUrl)) back(formPath, 'erro', 'O link de afiliado precisa começar com https://.')
  if (imageUrl && !isHttpsUrl(imageUrl)) back(formPath, 'erro', 'A imagem precisa ser uma URL https.')
  if (status === 'active' && !affiliateUrl) back(formPath, 'erro', 'Produto ativo precisa de link de afiliado.')

  const payload = {
    name,
    slug: slugify(text(formData, 'slug') || name),
    short_description: text(formData, 'short_description'),
    description: text(formData, 'description'),
    brand: text(formData, 'brand'),
    category_id: text(formData, 'category_id'),
    marketplace_id: text(formData, 'marketplace_id'),
    affiliate_url: affiliateUrl,
    image_url: imageUrl,
    current_price: currentPrice as number,
    // Nunca guarda "preço anterior" menor ou igual ao atual (evita desconto fictício).
    old_price: oldPrice !== null && oldPrice > (currentPrice as number) ? oldPrice : null,
    installments: text(formData, 'installments') || null,
    free_shipping: formData.get('free_shipping') === 'on',
    featured: formData.get('featured') === 'on',
    // Salvo no painel = escolha manual; a rotina de destaques automáticos não mexe mais.
    featured_source: null,
    status: (['draft', 'active', 'inactive', 'expired'].includes(status) ? status : 'draft') as typeof status,
    last_price_update: new Date().toISOString(),
  }

  const supabase = await createServerClient()
  let productId = id
  let previousPrice: number | null = null
  if (id) {
    const { data: previous } = await supabase.from('products').select('current_price').eq('id', id).maybeSingle()
    previousPrice = previous?.current_price ?? null
    const { error } = await supabase.from('products').update(payload).eq('id', id)
    if (error) back(formPath, 'erro', friendly(error))
  } else {
    const { data, error } = await supabase.from('products').insert(payload).select('id').single()
    if (error || !data) back(formPath, 'erro', error ? friendly(error) : 'Falha ao salvar.')
    productId = data.id
  }

  if (previousPrice === null || previousPrice !== payload.current_price) {
    await supabase.from('product_price_history').insert({ product_id: productId, price: payload.current_price })
  }

  revalidatePath('/', 'layout')
  back(`/admin/produtos/${productId}`, 'ok', 'Produto salvo.')
}

export async function deleteProduct(formData: FormData) {
  await requireAdmin()
  const supabase = await createServerClient()
  const { error } = await supabase.from('products').delete().eq('id', text(formData, 'id'))
  if (error) back('/admin/produtos', 'erro', friendly(error))
  revalidatePath('/', 'layout')
  back('/admin/produtos', 'ok', 'Produto excluído.')
}
