import { describe, expect, it } from 'vitest'
import {
  backoffDelay,
  mapWithConcurrency,
  mercadoLivreProductUrl,
  normalizeMercadoLivreCatalogProduct,
  scoreCandidate,
  shouldRetry,
} from './radar'

const product = {
  id: 'MLB54982411',
  name: 'Celular Samsung Galaxy A17 256gb',
  pictures: [{ url: 'http://http2.mlstatic.com/D_NQ_NP_1-F.jpg' }],
  attributes: [{ id: 'BRAND', value_name: 'Samsung' }],
}

const offer = (price: number, extra: Record<string, unknown> = {}) => ({
  item_id: `MLB${price}`,
  price,
  currency_id: 'BRL',
  condition: 'new',
  original_price: null,
  shipping: { free_shipping: true },
  ...extra,
})

const offers = (...list: ReturnType<typeof offer>[]) => ({ paging: { total: list.length }, results: list })

describe('normalizeMercadoLivreCatalogProduct', () => {
  it('usa a oferta mais barata e a página oficial do produto', () => {
    const candidate = normalizeMercadoLivreCatalogProduct(product, offers(offer(1349), offer(1339.9), offer(1340)))
    expect(candidate).toMatchObject({
      external_id: 'MLB54982411',
      permalink: 'https://www.mercadolivre.com.br/p/MLB54982411',
      price: 1339.9,
      original_price: null,
      free_shipping: true,
      brand: 'Samsung',
      image_url: 'https://http2.mlstatic.com/D_NQ_NP_1-F.jpg',
      offers_count: 3,
      rating: null,
    })
  })

  it('só aceita preço anterior maior que o atual', () => {
    expect(normalizeMercadoLivreCatalogProduct(product, offers(offer(100, { original_price: 150 })))?.original_price).toBe(150)
    expect(normalizeMercadoLivreCatalogProduct(product, offers(offer(100, { original_price: 90 })))?.original_price).toBeNull()
  })

  it('descarta produto sem vendedor ou com dados inválidos', () => {
    expect(normalizeMercadoLivreCatalogProduct(product, { results: [] })).toBeNull()
    expect(normalizeMercadoLivreCatalogProduct(product, null)).toBeNull()
    expect(normalizeMercadoLivreCatalogProduct({ ...product, id: 'XYZ' }, offers(offer(10)))).toBeNull()
    expect(normalizeMercadoLivreCatalogProduct(product, offers(offer(0)))).toBeNull()
  })

  it('monta a URL oficial do catálogo', () => {
    expect(mercadoLivreProductUrl('MLB1')).toBe('https://www.mercadolivre.com.br/p/MLB1')
  })
})

describe('scoreCandidate', () => {
  const base = normalizeMercadoLivreCatalogProduct(product, offers(offer(100, { original_price: 150 })))!

  it('pontua desconto real, frete e condição nova', () => {
    const result = scoreCandidate(base)
    expect(result.breakdown.desconto).toBeCloseTo(26.7, 1)
    expect(result.breakdown.frete_gratis).toBe(10)
    expect(result.breakdown.condicao).toBe(5)
  })

  it('não dá pontos de desconto sem preço anterior', () => {
    const result = scoreCandidate({ ...base, original_price: null })
    expect(result.breakdown.desconto).toBe(0)
    expect(result.flags).toContain('sem_preco_anterior')
  })

  it('trata desconto acima de 70% como suspeito', () => {
    const result = scoreCandidate({ ...base, original_price: 1000 })
    expect(result.breakdown.desconto).toBe(0)
    expect(result.flags).toContain('desconto_suspeito')
  })

  it('valoriza produtos com vários vendedores, com teto', () => {
    expect(scoreCandidate({ ...base, offers_count: 1 }).breakdown.vendedores).toBeUndefined()
    expect(scoreCandidate({ ...base, offers_count: 300 }).breakdown.vendedores).toBe(10)
  })

  it('mantém a pontuação entre 0 e 100', () => {
    const used = scoreCandidate({ ...base, original_price: null, condition: 'used', free_shipping: false, offers_count: 1 })
    expect(used.score).toBe(0)
  })
})

describe('utilitários', () => {
  it('backoff exponencial com teto', () => {
    expect([0, 1, 2, 3, 4].map((n) => backoffDelay(n))).toEqual([1000, 2000, 4000, 8000, 8000])
  })

  it('repete só em 429 e 5xx', () => {
    expect(shouldRetry(429)).toBe(true)
    expect(shouldRetry(503)).toBe(true)
    expect(shouldRetry(403)).toBe(false)
  })

  it('limita a simultaneidade e preserva a ordem', async () => {
    let running = 0
    let peak = 0
    const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (n) => {
      running++
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, 5))
      running--
      return n * 2
    })
    expect(out).toEqual([2, 4, 6, 8, 10, 12])
    expect(peak).toBeLessThanOrEqual(2)
  })
})
