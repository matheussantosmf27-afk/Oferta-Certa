import { describe, expect, it } from 'vitest'
import { calculateDiscountPercentage, formatCurrency, summarizePriceHistory } from './price'

describe('calculateDiscountPercentage', () => {
  it('calcula o desconto arredondado', () => {
    expect(calculateDiscountPercentage(2199, 2799)).toBe(21)
  })

  it('não inventa desconto sem preço anterior', () => {
    expect(calculateDiscountPercentage(100)).toBeNull()
    expect(calculateDiscountPercentage(100, 0)).toBeNull()
  })

  it('não gera desconto quando o preço anterior é menor ou igual', () => {
    expect(calculateDiscountPercentage(100, 100)).toBeNull()
    expect(calculateDiscountPercentage(100, 90)).toBeNull()
  })
})

describe('formatCurrency', () => {
  it('formata em reais', () => {
    expect(formatCurrency(2199).replace(/\s/g, ' ')).toBe('R$ 2.199,00')
  })
})

describe('summarizePriceHistory', () => {
  const now = Date.parse('2026-10-20T12:00:00Z')

  it('ordena, calcula mínimo e máximo e o período', () => {
    const summary = summarizePriceHistory(
      [
        { price: 90, recorded_at: '2026-10-10T12:00:00Z' },
        { price: 100, recorded_at: '2026-10-01T12:00:00Z' },
        { price: 95, recorded_at: '2026-10-05T12:00:00Z' },
        { price: 85, recorded_at: '2026-10-15T12:00:00Z' },
        { price: 88, recorded_at: '2026-10-18T12:00:00Z' },
      ],
      now
    )
    expect(summary?.points.map((p) => p.price)).toEqual([100, 95, 90, 85, 88])
    expect(summary).toMatchObject({ min: 85, max: 100, days: 19, fewData: false })
  })

  it('avisa quando há poucos dados', () => {
    expect(summarizePriceHistory([{ price: 10, recorded_at: '2026-10-19T12:00:00Z' }], now)?.fewData).toBe(true)
    expect(summarizePriceHistory([], now)).toBeNull()
    expect(summarizePriceHistory([{ price: 0, recorded_at: '2026-10-19T12:00:00Z' }], now)).toBeNull()
  })
})
