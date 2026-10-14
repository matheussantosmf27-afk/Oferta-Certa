import type { MetadataRoute } from 'next'
import { getCategories, listProducts } from '@/services/catalog'
import { getSiteUrl } from '@/lib/site'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl()
  const [categories, products] = await Promise.all([getCategories(), listProducts({ sort: 'recentes', limit: 100 })])

  return [
    { url: `${base}/`, changeFrequency: 'hourly', priority: 1 },
    { url: `${base}/ofertas`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${base}/categorias`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/privacidade`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/termos`, changeFrequency: 'yearly', priority: 0.2 },
    ...categories.map((category) => ({
      url: `${base}/categoria/${category.slug}`,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    ...products.map((product) => ({
      url: `${base}/produto/${product.slug}`,
      lastModified: product.last_price_update,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ]
}
