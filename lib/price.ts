export function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  })
}

/** Teto de desconto aceito como plausível; acima disso o valor é tratado como inconsistente. */
export const MAX_PLAUSIBLE_DISCOUNT = 70

const validPrice = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0

/**
 * Desconto em % (arredondado) só para preços válidos, positivos e coerentes:
 * preço anterior maior que o atual e queda de no máximo 70%. Qualquer outro caso: null.
 */
export function calculateDiscountPercentage(currentPrice: number, oldPrice?: number | null) {
  if (!validPrice(currentPrice) || !validPrice(oldPrice) || oldPrice <= currentPrice) return null
  const pct = Math.round(((oldPrice - currentPrice) / oldPrice) * 100)
  return pct >= 1 && pct <= MAX_PLAUSIBLE_DISCOUNT ? pct : null
}

/**
 * Desconto a exibir em cards e na página do produto. O servidor só envia preço anterior e % quando o
 * desconto foi corroborado (histórico do site ou preço dos outros vendedores); aqui conferimos de novo
 * se os números batem entre si, para nunca mostrar um selo incoerente.
 */
export function displayDiscount(product: { current_price: number; old_price: number | null; discount_percentage: number | null }) {
  const computed = calculateDiscountPercentage(product.current_price, product.old_price)
  if (computed === null || product.discount_percentage === null) return null
  return Math.abs(computed - product.discount_percentage) <= 1 ? computed : null
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
  /** Dias entre o primeiro e o último registro. */
  spanDays: number
}

/** Ordena do mais antigo ao mais recente e resume; null se não houver registros válidos. */
export function summarizePriceHistory(raw: PricePoint[], now = Date.now()): PriceHistorySummary | null {
  const points = raw
    .filter((point) => Number.isFinite(point.price) && point.price > 0 && !Number.isNaN(Date.parse(point.recorded_at)))
    .sort((a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at))
  if (!points.length) return null
  const prices = points.map((point) => point.price)
  const days = Math.max(0, Math.floor((now - Date.parse(points[0].recorded_at)) / 86_400_000))
  const spanDays = Math.floor((Date.parse(points[points.length - 1].recorded_at) - Date.parse(points[0].recorded_at)) / 86_400_000)
  return { points, min: Math.min(...prices), max: Math.max(...prices), days, spanDays, fewData: points.length < 5 || spanDays < 7 }
}
