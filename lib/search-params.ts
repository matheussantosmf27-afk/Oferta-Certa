// Parâmetros da página de busca (/buscar): leitura validada e montagem de URLs compartilháveis.
import type { ProductSort } from '@/types'

export const SEARCH_PAGE_SIZE = 24
export const MAX_SEARCH_PAGE = 100

const SORTS: ProductSort[] = ['relevancia', 'menor-preco', 'maior-preco', 'maior-desconto', 'recentes']
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export interface SearchState {
  q: string
  categoria: string | null
  marca: string | null
  ordem: ProductSort
  pagina: number
}

type RawParams = Record<string, string | string[] | undefined>

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? ''

/** Lê e valida os parâmetros da URL; valores inválidos voltam ao padrão (nunca quebram a página). */
export function parseSearchState(params: RawParams): SearchState {
  const q = first(params.q).replace(/\s+/g, ' ').trim().slice(0, 100)
  const categoria = first(params.categoria).trim().toLowerCase()
  const marca = first(params.marca).replace(/\s+/g, ' ').trim().slice(0, 60)
  const ordem = first(params.ordem) as ProductSort
  const pagina = Number.parseInt(first(params.pagina), 10)
  return {
    q,
    categoria: SLUG.test(categoria) && categoria.length <= 60 ? categoria : null,
    marca: marca || null,
    ordem: SORTS.includes(ordem) ? ordem : 'relevancia',
    pagina: Number.isFinite(pagina) && pagina >= 1 ? Math.min(pagina, MAX_SEARCH_PAGE) : 1,
  }
}

/**
 * URL da busca com o estado atual e as mudanças pedidas. Trocar busca, filtro ou ordem volta para
 * a página 1; valores padrão (relevância, página 1) não aparecem na URL.
 */
export function searchHref(state: SearchState, changes: Partial<SearchState> = {}): string {
  const next: SearchState = { ...state, ...changes }
  const resetsPage = ['q', 'categoria', 'marca', 'ordem'].some((key) => key in changes)
  if (resetsPage && !('pagina' in changes)) next.pagina = 1
  const params = new URLSearchParams()
  if (next.q) params.set('q', next.q)
  if (next.categoria) params.set('categoria', next.categoria)
  if (next.marca) params.set('marca', next.marca)
  if (next.ordem !== 'relevancia') params.set('ordem', next.ordem)
  if (next.pagina > 1) params.set('pagina', String(next.pagina))
  const query = params.toString()
  return query ? `/buscar?${query}` : '/buscar'
}

export function totalPages(total: number, pageSize = SEARCH_PAGE_SIZE): number {
  return Math.max(1, Math.min(MAX_SEARCH_PAGE, Math.ceil(Math.max(0, total) / pageSize)))
}

/** Números de página para a navegação: primeira, última e vizinhas da atual, com reticências (null). */
export function pageWindow(current: number, last: number): (number | null)[] {
  const pages = new Set([1, last, current - 1, current, current + 1].filter((page) => page >= 1 && page <= last))
  const sorted = [...pages].sort((a, b) => a - b)
  const out: (number | null)[] = []
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) out.push(null)
    out.push(page)
  })
  return out
}
