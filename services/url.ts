import { getProductBySlug } from './data'

export function resolveProductUrl(productSlug: string) {
  return `/produto/${productSlug}`
}

export function resolveAffiliateRedirect(productId: string) {
  const product = getProductBySlug(productId)
  return product ? `/go/${product.slug}` : '/'
}
