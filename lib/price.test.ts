import { describe, expect, it } from 'vitest'
import { calculateDiscountPercentage, displayDiscount, formatCurrency, summarizePriceHistory } from './price'

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

  it('ignora valores nulos, negativos, zero e não numéricos', () => {
    expect(calculateDiscountPercentage(100, null)).toBeNull()
    expect(calculateDiscountPercentage(-10, 100)).toBeNull()
    expect(calculateDiscountPercentage(0, 100)).toBeNull()
    expect(calculateDiscountPercentage(Number.NaN, 100)).toBeNull()
    expect(calculateDiscountPercentage(100, Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('trata quedas acima de 70% como inconsistentes', () => {
    expect(calculateDiscountPercentage(25, 100)).toBeNull()
    expect(calculateDiscountPercentage(30, 100)).toBe(70)
  })

  it('não mostra desconto que arredonda para zero', () => {
    expect(calculateDiscountPercentage(99.8, 100)).toBeNull()
  })
})

describe('displayDiscount', () => {
  it('mostra o desconto corroborado pelo servidor quando os números batem', () => {
    expect(displayDiscount({ current_price: 75, old_price: 100, discount_percentage: 25 })).toBe(25)
  })

  it('sem corroboração do servidor (preço anterior ou % ausentes), não mostra', () => {
    expect(displayDiscount({ current_price: 75, old_price: null, discount_percentage: null })).toBeNull()
    expect(displayDiscount({ current_price: 75, old_price: 100, discount_percentage: null })).toBeNull()
  })

  it('números incoerentes entre si não viram selo', () => {
    expect(displayDiscount({ current_price: 75, old_price: 100, discount_percentage: 60 })).toBeNull()
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

describe('summarizePriceHistory: período observado', () => {
  it('mede o intervalo entre o primeiro e o último registro, não até hoje', () => {
    const now = Date.parse('2026-10-30T12:00:00Z')
    const summary = summarizePriceHistory(
      [
        { price: 100, recorded_at: '2026-10-01T12:00:00Z' },
        { price: 90, recorded_at: '2026-10-03T12:00:00Z' },
      ],
      now
    )
    expect(summary?.spanDays).toBe(2)
    expect(summary?.fewData).toBe(true)
  })

  it('descarta registros inválidos', () => {
    expect(summarizePriceHistory([{ price: -5, recorded_at: '2026-10-01T12:00:00Z' }, { price: 10, recorded_at: 'data ruim' }])).toBeNull()
  })
})
