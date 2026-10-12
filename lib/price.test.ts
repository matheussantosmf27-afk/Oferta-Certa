import { describe, expect, it } from 'vitest'
import { calculateDiscountPercentage, formatCurrency } from './price'

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
