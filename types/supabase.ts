export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string
          name: string
          slug: string
          short_description: string
          description: string
          brand: string
          category_id: string
          marketplace_id: string
          external_id: string | null
          affiliate_url: string
          image_url: string
          gallery: string[]
          current_price: number
          old_price: number | null
          discount_percentage: number | null
          installments: string | null
          installment_value: number | null
          free_shipping: boolean
          coupon_id: string | null
          status: string
          featured: boolean
          trending: boolean
          best_value: boolean
          flash_deal: boolean
          created_at: string
          updated_at: string
          last_price_update: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          short_description: string
          description: string
          brand: string
          category_id: string
          marketplace_id: string
          external_id?: string | null
          affiliate_url: string
          image_url: string
          gallery?: string[]
          current_price: number
          old_price?: number | null
          discount_percentage?: number | null
          installments?: string | null
          installment_value?: number | null
          free_shipping?: boolean
          coupon_id?: string | null
          status?: string
          featured?: boolean
          trending?: boolean
          best_value?: boolean
          flash_deal?: boolean
          created_at?: string
          updated_at?: string
          last_price_update?: string
        }
        Update: {
          name?: string
          slug?: string
          short_description?: string
          description?: string
          brand?: string
          category_id?: string
          marketplace_id?: string
          external_id?: string | null
          affiliate_url?: string
          image_url?: string
          gallery?: string[]
          current_price?: number
          old_price?: number | null
          discount_percentage?: number | null
          installments?: string | null
          installment_value?: number | null
          free_shipping?: boolean
          coupon_id?: string | null
          status?: string
          featured?: boolean
          trending?: boolean
          best_value?: boolean
          flash_deal?: boolean
          created_at?: string
          updated_at?: string
          last_price_update?: string
        }
      }
      clicks: {
        Row: {
          id: string
          product_id: string | null
          marketplace_id: string | null
          referrer: string | null
          source: string | null
          medium: string | null
          campaign: string | null
          device_type: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id?: string | null
          marketplace_id?: string | null
          referrer?: string | null
          source?: string | null
          medium?: string | null
          campaign?: string | null
          device_type?: string | null
          created_at?: string
        }
        Update: {
          product_id?: string | null
          marketplace_id?: string | null
          referrer?: string | null
          source?: string | null
          medium?: string | null
          campaign?: string | null
          device_type?: string | null
          created_at?: string
        }
      }
    }
  }
}
