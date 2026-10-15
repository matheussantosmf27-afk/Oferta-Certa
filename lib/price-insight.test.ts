import { describe, expect, it } from 'vitest'
import { priceInsight } from './price-insight'

const market = { offers: 6, min: 90, median: 120, max: 150 }
const day = (n: number) => new Date(Date.UTC(2026, 9, 1 + n)).toISOString()

describe('priceInsight', () => {
  it('classifica o preço contra a mediana dos vendedores', () => {
    expect(priceInsight({ price: 90, oldPrice: null, market, history: [] })).toMatchObject({ vsMedianPct: -25, verdict: 'otimo', isLowest: true })
    expect(priceInsight({ price: 114, oldPrice: null, market, history: [] }).verdict).toBe('bom')
    expect(priceInsight({ price: 124, oldPrice: null, market, history: [] }).verdict).toBe('na_media')
    expect(priceInsight({ price: 140, oldPrice: null, market, history: [] }).verdict).toBe('acima')
  })

  it('com um vendedor só, não compara', () => {
    expect(priceInsight({ price: 90, oldPrice: null, market: { offers: 1, min: 90, median: 90, max: 90 }, history: [] }).verdict).toBeNull()
  })

  it('confirma o desconto quando o histórico de 7+ dias viu o preço anterior', () => {
    const history = [{ price: 148, recorded_at: day(0) }, { price: 100, recorded_at: day(8) }]
    expect(priceInsight({ price: 100, oldPrice: 150, market, history }).discountCheck).toBe('confirmado')
  })

  it('avisa quando o preço anterior está acima do que todos os vendedores cobram', () => {
    expect(priceInsight({ price: 100, oldPrice: 300, market, history: [] }).discountCheck).toBe('acima_do_mercado')
  })

  it('sem dados para confirmar, fica como informado pela loja', () => {
    expect(priceInsight({ price: 100, oldPrice: 150, market, history: [{ price: 100, recorded_at: day(0) }] }).discountCheck).toBe('informado')
    expect(priceInsight({ price: 100, oldPrice: null, market, history: [] }).discountCheck).toBe('sem_desconto')
  })
})
