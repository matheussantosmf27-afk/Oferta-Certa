export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          slug: string
          name: string
          description: string | null
          icon: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          description?: string | null
          icon?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          slug?: string
          name?: string
          description?: string | null
          icon?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey'
            columns: ['id']
            referencedRelation: 'products'
            referencedColumns: ['category_id']
          }
        ]
      }
      marketplaces: {
        Row: {
          id: string
          slug: string
          name: string
          logo: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          logo?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          slug?: string
          name?: string
          logo?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'products_marketplace_id_fkey'
            columns: ['id']
            referencedRelation: 'products'
            referencedColumns: ['marketplace_id']
          },
          {
            foreignKeyName: 'promotions_marketplace_id_fkey'
            columns: ['id']
            referencedRelation: 'promotions'
            referencedColumns: ['marketplace_id']
          },
          {
            foreignKeyName: 'clicks_marketplace_id_fkey'
            columns: ['id']
            referencedRelation: 'clicks'
            referencedColumns: ['marketplace_id']
          }
        ]
      }
      coupons: {
        Row: {
          id: string
          code: string
          title: string
          description: string
          marketplace: string
          discount_type: Database['public']['Enums']['coupon_discount_type']
          discount_value: string
          minimum_purchase: string | null
          valid_until: string
          status: Database['public']['Enums']['coupon_status']
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          title: string
          description: string
          marketplace: string
          discount_type: Database['public']['Enums']['coupon_discount_type']
          discount_value: string
          minimum_purchase?: string | null
          valid_until: string
          status?: Database['public']['Enums']['coupon_status']
          created_at?: string
          updated_at?: string
        }
        Update: {
          code?: string
          title?: string
          description?: string
          marketplace?: string
          discount_type?: Database['public']['Enums']['coupon_discount_type']
          discount_value?: string
          minimum_purchase?: string | null
          valid_until?: string
          status?: Database['public']['Enums']['coupon_status']
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'products_coupon_id_fkey'
            columns: ['id']
            referencedRelation: 'products'
            referencedColumns: ['coupon_id']
          }
        ]
      }
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
          current_price: string
          old_price: string | null
          discount_percentage: number | null
          installments: string | null
          installment_value: string | null
          free_shipping: boolean
          coupon_id: string | null
          status: Database['public']['Enums']['product_status']
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
          current_price: string
          old_price?: string | null
          discount_percentage?: number | null
          installments?: string | null
          installment_value?: string | null
          free_shipping?: boolean
          coupon_id?: string | null
          status?: Database['public']['Enums']['product_status']
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
          current_price?: string
          old_price?: string | null
          discount_percentage?: number | null
          installments?: string | null
          installment_value?: string | null
          free_shipping?: boolean
          coupon_id?: string | null
          status?: Database['public']['Enums']['product_status']
          featured?: boolean
          trending?: boolean
          best_value?: boolean
          flash_deal?: boolean
          created_at?: string
          updated_at?: string
          last_price_update?: string
        }
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey'
            columns: ['category_id']
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_marketplace_id_fkey'
            columns: ['marketplace_id']
            referencedRelation: 'marketplaces'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_coupon_id_fkey'
            columns: ['coupon_id']
            referencedRelation: 'coupons'
            referencedColumns: ['id']
          }
        ]
      }
      product_price_history: {
        Row: {
          id: string
          product_id: string
          price: string
          recorded_at: string
        }
        Insert: {
          id?: string
          product_id: string
          price: string
          recorded_at?: string
        }
        Update: {
          product_id?: string
          price?: string
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'product_price_history_product_id_fkey'
            columns: ['product_id']
            referencedRelation: 'products'
            referencedColumns: ['id']
          }
        ]
      }
      articles: {
        Row: {
          id: string
          title: string
          slug: string
          summary: string
          content: string
          image_url: string | null
          author: string
          category: string | null
          published_at: string
          updated_at: string
          seo_title: string | null
          meta_description: string | null
          status: Database['public']['Enums']['article_status']
        }
        Insert: {
          id?: string
          title: string
          slug: string
          summary: string
          content: string
          image_url?: string | null
          author: string
          category?: string | null
          published_at?: string
          updated_at?: string
          seo_title?: string | null
          meta_description?: string | null
          status?: Database['public']['Enums']['article_status']
        }
        Update: {
          title?: string
          slug?: string
          summary?: string
          content?: string
          image_url?: string | null
          author?: string
          category?: string | null
          published_at?: string
          updated_at?: string
          seo_title?: string | null
          meta_description?: string | null
          status?: Database['public']['Enums']['article_status']
        }
      }
      promotions: {
        Row: {
          id: string
          title: string
          slug: string
          description: string | null
          marketplace_id: string | null
          starts_at: string
          ends_at: string | null
          active: boolean
          status: Database['public']['Enums']['promotion_status']
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          description?: string | null
          marketplace_id?: string | null
          starts_at?: string
          ends_at?: string | null
          active?: boolean
          status?: Database['public']['Enums']['promotion_status']
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          slug?: string
          description?: string | null
          marketplace_id?: string | null
          starts_at?: string
          ends_at?: string | null
          active?: boolean
          status?: Database['public']['Enums']['promotion_status']
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'promotions_marketplace_id_fkey'
            columns: ['marketplace_id']
            referencedRelation: 'marketplaces'
            referencedColumns: ['id']
          }
        ]
      }
      banners: {
        Row: {
          id: string
          title: string
          subtitle: string | null
          image_url: string | null
          call_to_action: string | null
          href: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          subtitle?: string | null
          image_url?: string | null
          call_to_action?: string | null
          href?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          subtitle?: string | null
          image_url?: string | null
          call_to_action?: string | null
          href?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      settings: {
        Row: {
          id: string
          name: string
          value: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          value?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          value?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      newsletter_subscribers: {
        Row: {
          id: string
          email: string
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          created_at?: string
        }
        Update: {
          email?: string
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          role: Database['public']['Enums']['profile_role']
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role?: Database['public']['Enums']['profile_role']
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          role?: Database['public']['Enums']['profile_role']
          created_at?: string
          updated_at?: string
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
        Relationships: [
          {
            foreignKeyName: 'clicks_product_id_fkey'
            columns: ['product_id']
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'clicks_marketplace_id_fkey'
            columns: ['marketplace_id']
            referencedRelation: 'marketplaces'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      is_admin: {
        Args: []
        Returns: boolean
      }
    }
    Enums: {
      product_status: 'draft' | 'active' | 'inactive' | 'expired'
      coupon_discount_type: 'percent' | 'amount'
      coupon_status: 'active' | 'expired' | 'scheduled'
      article_status: 'draft' | 'active'
      profile_role: 'user' | 'admin'
      promotion_status: 'draft' | 'active' | 'expired'
    }
    CompositeTypes: Record<string, never>
  }
}
