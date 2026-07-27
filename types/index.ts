export type ProductStatus = 'draft' | 'active' | 'inactive' | 'expired'

export interface Product {
  id: string
  slug: string
  name: string
  short_description: string
  description: string
  brand: string
  category_id: string
  categoryName: string
  marketplace_id: string
  marketplaceName: string
  external_id?: string
  affiliate_url: string
  image_url: string
  gallery: string[]
  current_price: number
  old_price?: number
  discount_percentage?: number
  installments?: string
  installment_value?: number
  free_shipping?: boolean
  coupon_id?: string
  status: ProductStatus
  featured?: boolean
  trending?: boolean
  best_value?: boolean
  flash_deal?: boolean
  created_at: string
  updated_at: string
  last_price_update: string
}

export interface Category {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  productsCount: number
}

export interface Coupon {
  id: string
  code: string
  title: string
  description: string
  marketplace: string
  discount_type: 'percent' | 'amount'
  discount_value: number
  minimum_purchase?: number
  valid_until: string
  status: 'active' | 'expired' | 'scheduled'
}

export interface Article {
  id: string
  title: string
  slug: string
  summary: string
  content: string
  image_url: string
  author: string
  published_at: string
  updated_at: string
  category: string
  seo_title: string
  meta_description: string
  status: 'active' | 'draft'
}
