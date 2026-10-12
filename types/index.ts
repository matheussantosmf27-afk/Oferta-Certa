import type { Database, Tables } from './supabase'

/** Produto como exibido no site público (sem link de afiliado). */
export type Product = Database['public']['Functions']['get_public_products']['Returns'][number]

export type Category = Tables<'categories'> & { productsCount: number }

export type Coupon = Tables<'coupons'>

export type Article = Tables<'articles'>

export type ProductSort = 'relevancia' | 'menor-preco' | 'maior-preco' | 'maior-desconto' | 'recentes'
