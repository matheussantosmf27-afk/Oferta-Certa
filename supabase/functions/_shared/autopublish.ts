// Regras puras da publicação automática (testadas em autopublish.test.ts).
// O banco (publish_candidate_internal) reconfere tudo; isto evita chamadas inúteis e documenta a regra.
import { discountPercent } from './radar.ts'

export interface AutoPublishSettings {
  auto_publish_enabled: boolean
  auto_publish_min_score: number
  auto_publish_max_per_run: number
  auto_publish_max_per_day: number
  /** Desconto máximo (%) aceito na publicação automática; acima disso vai para a fila manual. */
  auto_publish_max_discount: number
  /** Bloqueia anúncios com título estrangeiro/genérico na publicação automática. */
  auto_publish_block_foreign_titles: boolean
  ml_matt_word: string | null
  ml_matt_tool: string | null
}

export interface AutoPublishCandidate {
  id: string
  status: string
  is_demo: boolean
  score: number
  score_breakdown: unknown
  image_url: string | null
  price: number
  original_price: number | null
  suggested_category_id: string | null
  last_run_id: string | null
  product_id: string | null
  permalink: string
}

export interface AffiliateTag {
  mattWord: string
  mattTool: string
}

const MATT_WORD = /^[A-Za-z0-9_.-]{1,64}$/
const MATT_TOOL = /^[A-Za-z0-9_-]{1,64}$/
const ML_PRODUCT_HOSTS = ['mercadolivre.com.br', 'www.mercadolivre.com.br', 'produto.mercadolivre.com.br']

/** Etiqueta configurada e com formato válido; senão null (sem etiqueta não há link de afiliado). */
export function affiliateTagFrom(settings: Pick<AutoPublishSettings, 'ml_matt_word' | 'ml_matt_tool'>): AffiliateTag | null {
  const mattWord = settings.ml_matt_word?.trim() ?? ''
  const mattTool = settings.ml_matt_tool?.trim() ?? ''
  if (!MATT_WORD.test(mattWord) || !MATT_TOOL.test(mattTool)) return null
  return { mattWord, mattTool }
}

/**
 * Monta o "link completo" de afiliado do Mercado Livre: a URL do produto com matt_word e matt_tool.
 * Só aceita páginas https do próprio Mercado Livre; remove fragmento e parâmetros de afiliado anteriores.
 * Retorna null quando não for possível montar um link confiável.
 */
export function buildMercadoLivreAffiliateUrl(productUrl: string, tag: AffiliateTag): string | null {
  if (!MATT_WORD.test(tag.mattWord) || !MATT_TOOL.test(tag.mattTool)) return null
  let url: URL
  try {
    url = new URL(productUrl)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || !ML_PRODUCT_HOSTS.includes(url.hostname.toLowerCase())) return null
  url.hash = ''
  url.searchParams.delete('matt_word')
  url.searchParams.delete('matt_tool')
  url.searchParams.set('matt_word', tag.mattWord)
  url.searchParams.set('matt_tool', tag.mattTool)
  return url.toString()
}

export type AffiliateLinkAnalysis =
  | { kind: 'short'; reason: string }
  | { kind: 'params'; productUrl: string; tag: AffiliateTag; extraParams: string[] }
  | { kind: 'invalid'; reason: string }

/**
 * Analisa um link de afiliado REAL gerado no portal. Só um link completo, com matt_word e matt_tool
 * fixos na URL do produto, permite a geração automática. Links encurtados (meli.la, /sec/) não.
 * `extraParams` lista parâmetros além da etiqueta: se algum variar a cada link gerado, a automação não é confiável.
 */
export function analyzeMercadoLivreAffiliateLink(link: string): AffiliateLinkAnalysis {
  let url: URL
  try {
    url = new URL(link.trim())
  } catch {
    return { kind: 'invalid', reason: 'Não é uma URL.' }
  }
  const host = url.hostname.toLowerCase()
  if (host === 'meli.la' || host.endsWith('.meli.la') || url.pathname.startsWith('/sec/')) {
    return { kind: 'short', reason: 'Link encurtado: não dá para reproduzir automaticamente. Gere o link completo.' }
  }
  if (url.protocol !== 'https:' || !ML_PRODUCT_HOSTS.includes(host)) {
    return { kind: 'invalid', reason: 'O link não é uma página https do Mercado Livre.' }
  }
  const tag = { mattWord: url.searchParams.get('matt_word') ?? '', mattTool: url.searchParams.get('matt_tool') ?? '' }
  if (!MATT_WORD.test(tag.mattWord) || !MATT_TOOL.test(tag.mattTool)) {
    return { kind: 'invalid', reason: 'O link não tem matt_word e matt_tool válidos.' }
  }
  const extraParams = [...url.searchParams.keys()].filter((key) => key !== 'matt_word' && key !== 'matt_tool')
  const product = new URL(url.toString())
  product.search = ''
  product.hash = ''
  return { kind: 'params', productUrl: product.toString(), tag, extraParams }
}

export type IneligibleReason =
  | 'desligado'
  | 'sem_etiqueta'
  | 'nao_pendente'
  | 'demo'
  | 'ja_publicado'
  | 'pontuacao'
  | 'desconto_suspeito'
  | 'desconto_alto'
  | 'titulo_estrangeiro'
  | 'sem_imagem'
  | 'sem_preco'
  | 'sem_categoria'
  | 'vendedor_nao_confirmado'

function alerts(breakdown: unknown): string[] {
  if (!breakdown || typeof breakdown !== 'object' || Array.isArray(breakdown)) return []
  const list = (breakdown as Record<string, unknown>)._alertas
  return Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string') : []
}

/** Lista os motivos que impedem a publicação automática (vazia = elegível). */
export function autoPublishBlockers(candidate: AutoPublishCandidate, settings: AutoPublishSettings, runId: string): IneligibleReason[] {
  const reasons: IneligibleReason[] = []
  if (!settings.auto_publish_enabled) reasons.push('desligado')
  if (!affiliateTagFrom(settings)) reasons.push('sem_etiqueta')
  if (candidate.status !== 'pending') reasons.push('nao_pendente')
  if (candidate.is_demo) reasons.push('demo')
  if (candidate.product_id) reasons.push('ja_publicado')
  if (!(candidate.score > settings.auto_publish_min_score)) reasons.push('pontuacao')
  const flags = alerts(candidate.score_breakdown)
  if (flags.includes('desconto_suspeito')) reasons.push('desconto_suspeito')
  const discount = discountPercent(candidate.price, candidate.original_price)
  if (discount !== null && discount > settings.auto_publish_max_discount) reasons.push('desconto_alto')
  if (settings.auto_publish_block_foreign_titles && flags.includes('titulo_estrangeiro')) reasons.push('titulo_estrangeiro')
  if (!candidate.image_url?.trim()) reasons.push('sem_imagem')
  if (!(candidate.price > 0)) reasons.push('sem_preco')
  if (!candidate.suggested_category_id) reasons.push('sem_categoria')
  if (!runId || candidate.last_run_id !== runId) reasons.push('vendedor_nao_confirmado')
  return reasons
}

export function isAutoPublishEligible(candidate: AutoPublishCandidate, settings: AutoPublishSettings, runId: string): boolean {
  return autoPublishBlockers(candidate, settings, runId).length === 0
}

/**
 * Escolhe quem publicar nesta execução: só elegíveis, maior pontuação primeiro,
 * respeitando o limite por execução e o que ainda resta do limite diário.
 */
export function selectAutoPublishBatch<T extends AutoPublishCandidate>(
  candidates: T[],
  settings: AutoPublishSettings,
  runId: string,
  publishedToday: number
): T[] {
  const remainingToday = Math.max(0, settings.auto_publish_max_per_day - publishedToday)
  const limit = Math.max(0, Math.min(settings.auto_publish_max_per_run, remainingToday))
  if (!limit) return []
  return candidates
    .filter((candidate) => isAutoPublishEligible(candidate, settings, runId))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
