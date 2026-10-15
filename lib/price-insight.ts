/**
 * "Raio-X do preço": compara o preço mostrado com o de todos os vendedores do mesmo produto
 * e explica o status do desconto calculado no servidor (product_discount_status).
 * Só usa dados reais (API da loja e coletas do site); sem dados suficientes, não opina.
 */

export interface MarketSnapshot {
  offers: number
  min: number
  median: number
  max: number
}

export type PriceVerdict = 'otimo' | 'bom' | 'na_media' | 'acima'
export type DiscountStatus = 'confirmado' | 'compativel' | 'acima_do_mercado' | 'nao_confirmado'

export interface PriceInsight {
  /** Diferença para a mediana dos vendedores, em % (negativo = abaixo). Null com menos de 2 vendedores. */
  vsMedianPct: number | null
  verdict: PriceVerdict | null
  isLowest: boolean
}

const pct = (value: number, reference: number) => Math.round(((value - reference) / reference) * 100)

export function priceInsight(input: { price: number; market: MarketSnapshot | null }): PriceInsight {
  const { price, market } = input
  const comparable = market && market.offers >= 2 && market.median > 0 && price > 0 ? market : null
  const vsMedianPct = comparable ? pct(price, comparable.median) : null
  const verdict: PriceVerdict | null =
    vsMedianPct === null ? null : vsMedianPct <= -15 ? 'otimo' : vsMedianPct <= -3 ? 'bom' : vsMedianPct <= 5 ? 'na_media' : 'acima'
  return { vsMedianPct, verdict, isLowest: Boolean(market && price > 0 && price <= market.min) }
}

/** Aceita só os status conhecidos vindos do banco. */
export function parseDiscountStatus(value: unknown): DiscountStatus | null {
  return value === 'confirmado' || value === 'compativel' || value === 'acima_do_mercado' || value === 'nao_confirmado' ? value : null
}

/** Se o desconto pode ser exibido com o percentual (o servidor também só envia nesses casos). */
export function isDiscountTrusted(status: DiscountStatus | null): boolean {
  return status === 'confirmado' || status === 'compativel'
}
