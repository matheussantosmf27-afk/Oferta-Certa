import { describe, expect, it } from 'vitest'
import { isDiscountTrusted, parseDiscountStatus, priceInsight } from './price-insight'

const market = { offers: 6, min: 90, median: 120, max: 150 }

describe('priceInsight', () => {
  it('classifica o preço contra a mediana dos vendedores', () => {
    expect(priceInsight({ price: 90, market })).toMatchObject({ vsMedianPct: -25, verdict: 'otimo', isLowest: true })
    expect(priceInsight({ price: 114, market }).verdict).toBe('bom')
    expect(priceInsight({ price: 124, market }).verdict).toBe('na_media')
    expect(priceInsight({ price: 140, market }).verdict).toBe('acima')
  })

  it('com um vendedor só ou sem dados, não compara', () => {
    expect(priceInsight({ price: 90, market: { offers: 1, min: 90, median: 90, max: 90 } }).verdict).toBeNull()
    expect(priceInsight({ price: 90, market: null })).toEqual({ vsMedianPct: null, verdict: null, isLowest: false })
  })

  it('preço inválido não gera veredito', () => {
    expect(priceInsight({ price: 0, market }).verdict).toBeNull()
  })
})

describe('status do desconto', () => {
  it('só confirmado e compatível exibem percentual', () => {
    expect(isDiscountTrusted('confirmado')).toBe(true)
    expect(isDiscountTrusted('compativel')).toBe(true)
    expect(isDiscountTrusted('acima_do_mercado')).toBe(false)
    expect(isDiscountTrusted('nao_confirmado')).toBe(false)
    expect(isDiscountTrusted(null)).toBe(false)
  })

  it('ignora valores desconhecidos vindos do banco', () => {
    expect(parseDiscountStatus('promo')).toBeNull()
    expect(parseDiscountStatus('compativel')).toBe('compativel')
  })
})
