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

export interface PricePoint {
  price: number
  recorded_at: string
}

export interface PriceHistorySummary {
  points: PricePoint[]
  min: number
  max: number
  days: number
  /** Poucos registros ou período curto: o gráfico ainda não diz muito. */
  fewData: boolean
}

/** Ordena do mais antigo ao mais recente e resume; null se não houver registros válidos. */
export function summarizePriceHistory(raw: PricePoint[], now = Date.now()): PriceHistorySummary | null {
  const points = raw
    .filter((point) => Number.isFinite(point.price) && point.price > 0 && !Number.isNaN(Date.parse(point.recorded_at)))
    .sort((a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at))
  if (!points.length) return null
  const prices = points.map((point) => point.price)
  const days = Math.max(0, Math.floor((now - Date.parse(points[0].recorded_at)) / 86_400_000))
  return { points, min: Math.min(...prices), max: Math.max(...prices), days, fewData: points.length < 5 || days < 7 }
}
