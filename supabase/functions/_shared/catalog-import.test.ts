import { describe, expect, it } from 'vitest'
import {
  catalogIssues,
  catalogPublishBlockers,
  classifyIds,
  emptyStats,
  failedSeedState,
  importSummary,
  nextSeedState,
  productIdentifiers,
  seedSearchParams,
  type CatalogPublishCandidate,
} from './catalog-import.ts'

const NOW = new Date('2026-10-15T12:00:00Z')
const seed = { page_size: 20, max_pages: 3, next_offset: 0 }

describe('sementes: paginação e retomada', () => {
  it('monta a busca da página atual', () => {
    const params = seedSearchParams({ query: 'iPhone 16 Pro', page_size: 20, next_offset: 40 })
    expect(params.get('q')).toBe('iPhone 16 Pro')
    expect(params.get('offset')).toBe('40')
    expect(params.get('limit')).toBe('20')
    expect(seedSearchParams({ query: 'x', page_size: 500, next_offset: -5 }).get('limit')).toBe('50')
  })

  it('avança de página enquanto houver resultados', () => {
    expect(nextSeedState(seed, 20, 200, NOW)).toMatchObject({ status: 'pending', next_offset: 20 })
    expect(nextSeedState({ ...seed, next_offset: 20 }, 20, 200, NOW)).toMatchObject({ status: 'pending', next_offset: 40 })
  })

  it('conclui no limite de páginas, na página incompleta ou no total, e agenda a reimportação', () => {
    const last = nextSeedState({ ...seed, next_offset: 40 }, 20, 200, NOW)
    expect(last).toMatchObject({ status: 'done', next_offset: 0 })
    expect(new Date(last.next_run_at).getTime() - NOW.getTime()).toBe(7 * 86_400_000)
    expect(nextSeedState(seed, 12, null, NOW).status).toBe('done')
    expect(nextSeedState(seed, 20, 20, NOW).status).toBe('done')
  })

  it('falha temporária mantém a página e tenta de novo; após 3 falhas fica em erro', () => {
    const first = failedSeedState({ next_offset: 20, attempts: 0 }, 'Mercado Livre respondeu 503', NOW)
    expect(first).toMatchObject({ status: 'pending', next_offset: 20, attempts: 1 })
    expect(new Date(first.next_run_at).getTime() - NOW.getTime()).toBe(30 * 60_000)
    expect(failedSeedState({ next_offset: 20, attempts: 2 }, 'erro', NOW)).toMatchObject({ status: 'error', attempts: 3 })
  })
})

describe('deduplicação', () => {
  it('separa duplicados da execução, atualizados há pouco e novos', () => {
    const seen = new Set(['MLB1'])
    const lastSeen = new Map<string, string | null>([
      ['MLB2', new Date(NOW.getTime() - 2 * 3_600_000).toISOString()],
      ['MLB3', new Date(NOW.getTime() - 48 * 3_600_000).toISOString()],
    ])
    const result = classifyIds(['MLB1', 'MLB2', 'MLB3', 'MLB4', 'MLB4'], seen, lastSeen, NOW.getTime())
    expect(result).toEqual({ duplicates: ['MLB1', 'MLB4'], recent: ['MLB2'], fresh: ['MLB3', 'MLB4'] })
    expect(seen.has('MLB3')).toBe(true)
  })

  it('reexecução da mesma página logo depois não consulta nada de novo', () => {
    const ids = ['MLB10', 'MLB11']
    const firstRun = classifyIds(ids, new Set(), new Map(), NOW.getTime())
    expect(firstRun.fresh).toEqual(ids)
    const stored = new Map(ids.map((id) => [id, NOW.toISOString()]))
    const secondRun = classifyIds(ids, new Set(), stored, NOW.getTime() + 60_000)
    expect(secondRun.fresh).toEqual([])
    expect(secondRun.recent).toEqual(ids)
  })
})

describe('qualidade e publicação de catálogo', () => {
  const ok: CatalogPublishCandidate = {
    status: 'pending',
    is_demo: false,
    brand: 'Samsung',
    image_url: 'https://http2.mlstatic.com/x.jpg',
    condition: 'new',
    price: 1999,
    suggested_category_id: 'cat',
    score_breakdown: { desconto: 0, _alertas: ['sem_preco_anterior'] },
    last_seen_at: NOW.toISOString(),
    product_id: null,
  }

  it('produto completo, sem promoção, pode entrar no catálogo', () => {
    expect(catalogPublishBlockers(ok, NOW.getTime())).toEqual([])
  })

  it('incompletos ficam na fila com o motivo', () => {
    expect(catalogIssues({ brand: ' ', image_url: null, condition: 'used', score_breakdown: { _alertas: ['titulo_estrangeiro'] } })).toEqual([
      'sem_marca',
      'sem_imagem',
      'usado',
      'titulo_estrangeiro',
    ])
    expect(catalogPublishBlockers({ ...ok, suggested_category_id: null }, NOW.getTime())).toEqual(['sem_categoria'])
  })

  it('demonstração, desconto suspeito, vendedor não reconfirmado e já publicado não entram', () => {
    expect(catalogPublishBlockers({ ...ok, is_demo: true }, NOW.getTime())).toContain('demonstracao')
    expect(catalogPublishBlockers({ ...ok, score_breakdown: { _alertas: ['desconto_suspeito'] } }, NOW.getTime())).toContain('desconto_suspeito')
    expect(catalogPublishBlockers({ ...ok, last_seen_at: new Date(NOW.getTime() - 7 * 3_600_000).toISOString() }, NOW.getTime())).toContain(
      'vendedor_nao_confirmado'
    )
    expect(catalogPublishBlockers({ ...ok, product_id: 'p1', status: 'approved' }, NOW.getTime())).toEqual(['nao_pendente', 'ja_publicado'])
    expect(catalogPublishBlockers({ ...ok, price: 0 }, NOW.getTime())).toContain('sem_preco')
    // Desconto acima do limite da automação (70%): o banco recusaria, então nem é tentado.
    expect(catalogPublishBlockers({ ...ok, price: 100, original_price: 400 }, NOW.getTime(), 70)).toContain('desconto_acima_do_limite')
    expect(catalogPublishBlockers({ ...ok, price: 100, original_price: 150 }, NOW.getTime(), 70)).toEqual([])
  })
})

describe('identificadores do produto', () => {
  it('lê GTIN/EAN (vários), modelo, linha e código; ignora códigos inválidos', () => {
    const attributes = [
      { id: 'GTIN', value_name: '7892509123456, 0195949771234 abc' },
      { id: 'MODEL', value_name: 'Galaxy S25 Ultra' },
      { id: 'LINE', value_name: 'Galaxy S' },
      { id: 'ALPHANUMERIC_MODEL', value_name: 'SM-S938B' },
    ]
    expect(productIdentifiers(attributes)).toEqual({
      gtins: ['7892509123456', '0195949771234'],
      model: 'Galaxy S25 Ultra',
      line: 'Galaxy S',
      model_code: 'SM-S938B',
    })
    expect(productIdentifiers(undefined)).toEqual({ gtins: [], model: null, line: null, model_code: null })
  })
})

describe('resumo', () => {
  it('distingue encontrados, gravados e publicados; simulação avisa que nada foi gravado', () => {
    const stats = { ...emptyStats(false), seeds_processed: 2, found: 40, duplicates: 3, new: 20, updated: 10, published: 15, rejected: { sem_vendedor: 2 } }
    expect(importSummary(stats)).toBe('2 buscas, 40 encontrados, 3 duplicados ignorados, 2 rejeitados, 20 novos, 10 atualizados, 15 publicados')
    const dry = { ...emptyStats(true), seeds_processed: 1, found: 20, new: 18, updated: 2 }
    expect(importSummary(dry)).toBe('SIMULAÇÃO (nada gravado), 1 buscas, 20 encontrados, 18 seriam novos, 2 seriam atualizados')
  })
})
