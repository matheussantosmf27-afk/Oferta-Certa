/**
 * Destino do botão "Comprar": só https e só para um domínio de afiliado cadastrado para a loja
 * do produto (marketplaces.affiliate_hosts). Qualquer outro destino é recusado.
 */
export function isAllowedAffiliateUrl(value: string | null | undefined, allowedHosts: string[]): boolean {
  if (!value) return false
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false
  const host = url.hostname.toLowerCase()
  return allowedHosts.some((allowed) => {
    const clean = allowed.trim().toLowerCase()
    return Boolean(clean) && (host === clean || host.endsWith(`.${clean}`))
  })
}
