import type { Coupon, Product, Category, Article } from '@/types'
import { categories, topDeals, coupons, blogPosts } from '@/data/demo'

export function getAllProducts(): Product[] {
  return [...topDeals]
}

export function getProductBySlug(slug: string): Product | undefined {
  return getAllProducts().find((product) => product.slug === slug)
}

export function getProductById(id: string): Product | undefined {
  return getAllProducts().find((product) => product.id === id)
}

export function getProductsByCategory(categoryId: string): Product[] {
  return getAllProducts().filter((product) => product.category_id === categoryId)
}

export function getCategories(): Category[] {
  return categories
}

export function getCategoryBySlug(slug: string): Category | undefined {
  return categories.find((category) => category.slug === slug)
}

export function searchProducts(query: string): Product[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []
  return getAllProducts().filter((product) => {
    return [
      product.name,
      product.brand,
      product.categoryName,
      product.marketplaceName,
      product.short_description,
      product.description,
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalized)
  })
}

export function getCoupons(): Coupon[] {
  const now = new Date().toISOString()
  return coupons.filter((coupon) => coupon.valid_until >= now && coupon.status === 'active')
}

export function getArticles(): Article[] {
  return blogPosts
}

export function getArticleBySlug(slug: string): Article | undefined {
  return blogPosts.find((article) => article.slug === slug)
}
