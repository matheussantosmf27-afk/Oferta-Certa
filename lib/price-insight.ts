/**
 * "Raio-X do preço": compara o preço mostrado com o de todos os vendedores do mesmo produto
 * e com o histórico que o site registrou, para dizer se o desconto se sustenta.
 * Só usa dados reais (API da loja e coletas do site); sem dados suficientes, não opina.
 */

export interface MarketSnapshot {
  offers: number
  min: number
  median: number
  max: number
}

export type PriceVerdict = 'otimo' | 'bom' | 'na_media' | 'acima'
export type DiscountCheck = 'confirmado' | 'acima_do_mercado' | 'informado' | 'sem_desconto'

export interface PriceInsight {
  /** Diferença para a mediana dos vendedores, em % (negativo = abaixo). Null com menos de 2 vendedores. */
  vsMedianPct: number | null
  verdict: PriceVerdict | null
  isLowest: boolean
  discountCheck: DiscountCheck
}

const pct = (value: number, reference: number) => Math.round(((value - reference) / reference) * 100)

export function priceInsight(input: {
  price: number
  oldPrice: number | null
  market: MarketSnapshot | null
  /** Preços registrados pelo site, com data. */
  history: { price: number; recorded_at: string }[]
}): PriceInsight {
  const { price, oldPrice, market, history } = input
  const comparable = market && market.offers >= 2 && market.median > 0 ? market : null
  const vsMedianPct = comparable ? pct(price, comparable.median) : null
  const verdict: PriceVerdict | null =
    vsMedianPct === null ? null : vsMedianPct <= -15 ? 'otimo' : vsMedianPct <= -3 ? 'bom' : vsMedianPct <= 5 ? 'na_media' : 'acima'

  let discountCheck: DiscountCheck = 'sem_desconto'
  if (oldPrice && oldPrice > price) {
    const times = history.map((point) => new Date(point.recorded_at).getTime()).filter(Number.isFinite)
    const spanDays = times.length ? (Math.max(...times) - Math.min(...times)) / 86_400_000 : 0
    const highest = history.length ? Math.max(...history.map((point) => point.price)) : 0
    if (spanDays >= 7 && highest >= oldPrice * 0.9) discountCheck = 'confirmado'
    else if (comparable && oldPrice > comparable.max * 1.1) discountCheck = 'acima_do_mercado'
    else discountCheck = 'informado'
  }

  return { vsMedianPct, verdict, isLowest: Boolean(market && price <= market.min), discountCheck }
}
