/** Lojas pesquisadas pelo Radar (as que têm coleta automática). */
export const RADAR_STORES = [
  { slug: 'mercado-livre', name: 'Mercado Livre' },
  { slug: 'shopee', name: 'Shopee' },
  { slug: 'aliexpress', name: 'AliExpress' },
] as const

export const DEFAULT_STORES: string[] = RADAR_STORES.map((store) => store.slug)

/** Aceita só lojas conhecidas, sem repetição. */
export function parseStores(values: unknown[]): string[] {
  const known = new Set<string>(DEFAULT_STORES)
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && known.has(value)))]
}

/** Avisos específicos de cada loja exibidos na página do produto. */
export function storeNotice(slug: string | null | undefined): string | null {
  if (slug === 'aliexpress') {
    return 'Produto internacional: o prazo de entrega costuma ser maior e podem incidir impostos de importação, mostrados pelo AliExpress antes do pagamento.'
  }
  if (slug === 'amazon') return 'Preço conferido manualmente; confirme o valor atual na Amazon antes de comprar.'
  return null
}
