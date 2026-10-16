// Regras puras da importação do catálogo (testadas em catalog-import.test.ts).
// A Edge Function faz as chamadas; o banco reconfere a publicação em publish_catalog_candidate_internal.

export const CATALOG_REFRESH_DAYS = 7
export const MAX_SEED_ATTEMPTS = 3
export const RECENT_HOURS = 12
/** Candidato visto há mais tempo que isso precisa de nova consulta ao vendedor antes de publicar. */
export const PUBLISH_FRESH_HOURS = 6

export interface CatalogSeed {
  id: string
  query: string
  category_id: string | null
  min_price: number | null
  page_size: number
  max_pages: number
  next_offset: number
  attempts: number
}

export interface SeedState {
  status: 'pending' | 'done' | 'error'
  next_offset: number
  next_run_at: string
  attempts: number
  last_error: string | null
}

/** Parâmetros da busca no catálogo do Mercado Livre para a página atual da semente. */
export function seedSearchParams(seed: Pick<CatalogSeed, 'query' | 'page_size' | 'next_offset'>): URLSearchParams {
  return new URLSearchParams({
    status: 'active',
    site_id: 'MLB',
    q: seed.query,
    limit: String(Math.min(Math.max(seed.page_size, 1), 50)),
    offset: String(Math.max(seed.next_offset, 0)),
  })
}

/**
 * Estado da semente depois de uma página bem-sucedida: avança para a próxima página ou, ao fim
 * (página incompleta, limite de páginas ou total da busca), marca como concluída e agenda a
 * reimportação para daqui a CATALOG_REFRESH_DAYS dias, recomeçando da primeira página.
 */
export function nextSeedState(
  seed: Pick<CatalogSeed, 'page_size' | 'max_pages' | 'next_offset'>,
  pageFound: number,
  total: number | null,
  now: Date
): SeedState {
  const nextOffset = seed.next_offset + seed.page_size
  const finished =
    pageFound < seed.page_size || nextOffset >= seed.page_size * seed.max_pages || (total !== null && nextOffset >= total)
  if (finished) {
    return {
      status: 'done',
      next_offset: 0,
      next_run_at: new Date(now.getTime() + CATALOG_REFRESH_DAYS * 86_400_000).toISOString(),
      attempts: 0,
      last_error: null,
    }
  }
  return { status: 'pending', next_offset: nextOffset, next_run_at: now.toISOString(), attempts: 0, last_error: null }
}

/**
 * Falha temporária: a semente continua na mesma página e tenta de novo mais tarde (30 min × tentativas).
 * Depois de MAX_SEED_ATTEMPTS falhas seguidas, fica com status 'error' até alguém reativar no painel.
 */
export function failedSeedState(seed: Pick<CatalogSeed, 'next_offset' | 'attempts'>, message: string, now: Date): SeedState {
  const attempts = seed.attempts + 1
  return {
    status: attempts >= MAX_SEED_ATTEMPTS ? 'error' : 'pending',
    next_offset: seed.next_offset,
    next_run_at: new Date(now.getTime() + 30 * 60_000 * attempts).toISOString(),
    attempts,
    last_error: message.slice(0, 300),
  }
}

/**
 * Separa os ids de uma página: já vistos nesta execução (duplicados), atualizados há pouco
 * (pulados para não repetir chamadas à API numa reexecução) e os que precisam ser consultados.
 * Marca os novos como vistos.
 */
export function classifyIds(
  ids: string[],
  seenThisRun: Set<string>,
  lastSeenAt: Map<string, string | null>,
  now: number,
  recentHours = RECENT_HOURS
): { fresh: string[]; duplicates: string[]; recent: string[] } {
  const fresh: string[] = []
  const duplicates: string[] = []
  const recent: string[] = []
  for (const id of ids) {
    if (seenThisRun.has(id)) {
      duplicates.push(id)
      continue
    }
    seenThisRun.add(id)
    const seen = lastSeenAt.get(id)
    if (seen && now - new Date(seen).getTime() < recentHours * 3_600_000) recent.push(id)
    else fresh.push(id)
  }
  return { fresh, duplicates, recent }
}

export type CatalogIssue = 'sem_marca' | 'sem_imagem' | 'usado' | 'titulo_estrangeiro'

/** Pendências que impedem a publicação automática (o candidato fica na fila para correção). */
export function catalogIssues(candidate: {
  brand: string | null
  image_url: string | null
  condition: string | null
  score_breakdown?: unknown
}): CatalogIssue[] {
  const issues: CatalogIssue[] = []
  if (!candidate.brand?.trim()) issues.push('sem_marca')
  if (!candidate.image_url?.trim()) issues.push('sem_imagem')
  if (candidate.condition && candidate.condition !== 'new') issues.push('usado')
  if (alerts(candidate.score_breakdown).includes('titulo_estrangeiro')) issues.push('titulo_estrangeiro')
  return issues
}

function alerts(breakdown: unknown): string[] {
  if (!breakdown || typeof breakdown !== 'object') return []
  const value = (breakdown as Record<string, unknown>)._alertas
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export interface CatalogPublishCandidate {
  status: string
  is_demo: boolean
  brand: string | null
  image_url: string | null
  condition: string | null
  price: number | null
  original_price?: number | null
  suggested_category_id: string | null
  score_breakdown: unknown
  last_seen_at: string | null
  product_id: string | null
}

/** Motivos para NÃO publicar como produto de catálogo (espelha publish_catalog_candidate_internal). */
export function catalogPublishBlockers(candidate: CatalogPublishCandidate, now: number, maxDiscount = 100): string[] {
  const blockers: string[] = []
  if (candidate.status !== 'pending') blockers.push('nao_pendente')
  if (candidate.is_demo) blockers.push('demonstracao')
  if (candidate.product_id) blockers.push('ja_publicado')
  if (!candidate.price || candidate.price <= 0) blockers.push('sem_preco')
  if (!candidate.suggested_category_id) blockers.push('sem_categoria')
  if (alerts(candidate.score_breakdown).includes('desconto_suspeito')) blockers.push('desconto_suspeito')
  const { price, original_price: original } = candidate
  if (price && original && original > price && ((original - price) / original) * 100 > maxDiscount) blockers.push('desconto_acima_do_limite')
  if (!candidate.last_seen_at || now - new Date(candidate.last_seen_at).getTime() > PUBLISH_FRESH_HOURS * 3_600_000) {
    blockers.push('vendedor_nao_confirmado')
  }
  blockers.push(...catalogIssues(candidate))
  return blockers
}

export interface ImportStats {
  dry_run: boolean
  seeds_processed: number
  seeds_finished: number
  seeds_failed: number
  found: number
  duplicates: number
  skipped_recent: number
  checked: number
  /** Variações (cor, armazenamento) consultadas porque o produto principal não tinha ofertas. */
  variations_checked: number
  rejected: Record<string, number>
  new: number
  updated: number
  incomplete: Record<string, number>
  published: number
  pending_review: number
  publish_errors: number
  refreshed: number
  expired: number
  errors_by_source: Record<string, number>
}

export function emptyStats(dryRun: boolean): ImportStats {
  return {
    dry_run: dryRun,
    seeds_processed: 0,
    seeds_finished: 0,
    seeds_failed: 0,
    found: 0,
    duplicates: 0,
    skipped_recent: 0,
    checked: 0,
    variations_checked: 0,
    rejected: {},
    new: 0,
    updated: 0,
    incomplete: {},
    published: 0,
    pending_review: 0,
    publish_errors: 0,
    refreshed: 0,
    expired: 0,
    errors_by_source: {},
  }
}

export function bump(counter: Record<string, number>, key: string, amount = 1) {
  counter[key] = (counter[key] ?? 0) + amount
}

const total = (counter: Record<string, number>) => Object.values(counter).reduce((sum, value) => sum + value, 0)

/** Resumo legível, sempre separando encontrados, gravados e publicados. */
export function importSummary(stats: ImportStats): string {
  const parts = [
    stats.dry_run ? 'SIMULAÇÃO (nada gravado)' : '',
    `${stats.seeds_processed} buscas`,
    `${stats.found} encontrados`,
    stats.duplicates ? `${stats.duplicates} duplicados ignorados` : '',
    stats.skipped_recent ? `${stats.skipped_recent} já atualizados nas últimas ${RECENT_HOURS}h` : '',
    stats.variations_checked ? `${stats.variations_checked} variações consultadas` : '',
    total(stats.rejected) ? `${total(stats.rejected)} rejeitados` : '',
    stats.dry_run ? `${stats.new} seriam novos, ${stats.updated} seriam atualizados` : `${stats.new} novos, ${stats.updated} atualizados`,
    total(stats.incomplete) ? `${total(stats.incomplete)} incompletos` : '',
    stats.dry_run ? '' : `${stats.published} publicados`,
    stats.pending_review ? `${stats.pending_review} aguardando revisão` : '',
    stats.refreshed ? `${stats.refreshed} preços reconferidos` : '',
    stats.expired ? `${stats.expired} inativados sem vendedor` : '',
    total(stats.errors_by_source) ? `${total(stats.errors_by_source)} erro(s)` : '',
  ]
  return parts.filter(Boolean).join(', ')
}

/** GTIN/EAN, modelo, linha e código do modelo informados nos atributos do produto do catálogo. */
export function productIdentifiers(attributes: unknown): { gtins: string[]; model: string | null; line: string | null; model_code: string | null } {
  const list = Array.isArray(attributes) ? attributes : []
  const value = (id: string) => {
    const attr = list.find((item) => item && typeof item === 'object' && (item as Record<string, unknown>).id === id) as Record<string, unknown> | undefined
    const text = typeof attr?.value_name === 'string' ? attr.value_name.trim() : ''
    return text || null
  }
  const gtins = [
    ...new Set(
      (value('GTIN') ?? '')
        .split(/[,;\s]+/)
        .map((code) => code.trim())
        .filter((code) => /^\d{8,14}$/.test(code))
    ),
  ].slice(0, 5)
  return { gtins, model: value('MODEL'), line: value('LINE'), model_code: value('ALPHANUMERIC_MODEL') }
}
