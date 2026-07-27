export function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  })
}

export function calculateDiscountPercentage(currentPrice: number, oldPrice?: number) {
  if (!oldPrice || oldPrice <= currentPrice) return null
  return Math.round(((oldPrice - currentPrice) / oldPrice) * 100)
}
