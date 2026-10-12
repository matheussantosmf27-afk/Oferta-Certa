import { describe, expect, it } from 'vitest'
import { backoffDelay, normalizeMercadoLivreItem, scoreCandidate, shouldRetry } from './radar'

const baseItem = {
  id: 'MLB123',
  title: 'Fone Bluetooth XYZ',
  permalink: 'https://produto.mercadolivre.com.br/MLB-123-fone',
  thumbnail: 'http://http2.mlstatic.com/D_123-I.jpg',
  price: 100,
  original_price: 150,
  currency_id: 'BRL',
  condition: 'new',
  shipping: { free_shipping: true },
  attributes: [{ id: 'BRAND', value_name: 'Marca X' }],
}

describe('normalizeMercadoLivreItem', () => {
  it('normaliza um item válido', () => {
    const item = normalizeMercadoLivreItem(baseItem)
    expect(item).toMatchObject({
      external_id: 'MLB123',
      price: 100,
      original_price: 150,
      free_shipping: true,
      brand: 'Marca X',
      image_url: 'https://http2.mlstatic.com/D_123-O.jpg',
      rating: null,
    })
  })

  it('ignora preço anterior menor ou igual ao atual', () => {
    expect(normalizeMercadoLivreItem({ ...baseItem, original_price: 90 })?.original_price).toBeNull()
    expect(normalizeMercadoLivreItem({ ...baseItem, original_price: 100 })?.original_price).toBeNull()
  })

  it('descarta itens sem dados essenciais', () => {
    expect(normalizeMercadoLivreItem({ ...baseItem, price: 0 })).toBeNull()
    expect(normalizeMercadoLivreItem({ ...baseItem, permalink: 'http://inseguro' })).toBeNull()
    expect(normalizeMercadoLivreItem({ ...baseItem, id: undefined })).toBeNull()
    expect(normalizeMercadoLivreItem(null)).toBeNull()
  })
})

describe('scoreCandidate', () => {
  it('pontua desconto real, frete e condição nova', () => {
    const result = scoreCandidate(normalizeMercadoLivreItem(baseItem)!)
    expect(result.breakdown.desconto).toBeCloseTo(26.7, 1)
    expect(result.breakdown.frete_gratis).toBe(10)
    expect(result.breakdown.condicao).toBe(5)
    expect(result.score).toBeGreaterThan(40)
  })

  it('não dá pontos de desconto sem preço anterior', () => {
    const result = scoreCandidate(normalizeMercadoLivreItem({ ...baseItem, original_price: null })!)
    expect(result.breakdown.desconto).toBe(0)
    expect(result.flags).toContain('sem_preco_anterior')
  })

  it('trata desconto acima de 70% como suspeito', () => {
    const result = scoreCandidate(normalizeMercadoLivreItem({ ...baseItem, original_price: 1000 })!)
    expect(result.breakdown.desconto).toBe(0)
    expect(result.flags).toContain('desconto_suspeito')
  })

  it('mantém a pontuação entre 0 e 100', () => {
    const used = scoreCandidate(normalizeMercadoLivreItem({ ...baseItem, original_price: null, condition: 'used', shipping: {} })!)
    expect(used.score).toBe(0)
  })
})

describe('retry', () => {
  it('usa backoff exponencial com teto', () => {
    expect([0, 1, 2, 3, 4].map((n) => backoffDelay(n))).toEqual([1000, 2000, 4000, 8000, 8000])
  })

  it('repete só em 429 e 5xx', () => {
    expect(shouldRetry(429)).toBe(true)
    expect(shouldRetry(503)).toBe(true)
    expect(shouldRetry(403)).toBe(false)
    expect(shouldRetry(404)).toBe(false)
  })
})
