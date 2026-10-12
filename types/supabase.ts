/* eslint-disable no-unused-vars */
// Gerado a partir do banco real (Supabase). Para atualizar, regenere após cada migration.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      articles: {
        Row: {
          author: string
          category: string | null
          content: string
          id: string
          image_url: string | null
          meta_description: string | null
          published_at: string
          seo_title: string | null
          slug: string
          status: Database["public"]["Enums"]["article_status"]
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          author: string
          category?: string | null
          content: string
          id?: string
          image_url?: string | null
          meta_description?: string | null
          published_at?: string
          seo_title?: string | null
          slug: string
          status?: Database["public"]["Enums"]["article_status"]
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          author?: string
          category?: string | null
          content?: string
          id?: string
          image_url?: string | null
          meta_description?: string | null
          published_at?: string
          seo_title?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["article_status"]
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      automation_settings: {
        Row: {
          auto_publish_enabled: boolean
          auto_publish_max_per_day: number
          auto_publish_max_per_run: number
          auto_publish_min_score: number
          created_at: string
          id: boolean
          ml_matt_tool: string | null
          ml_matt_word: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_publish_enabled?: boolean
          auto_publish_max_per_day?: number
          auto_publish_max_per_run?: number
          auto_publish_min_score?: number
          created_at?: string
          id?: boolean
          ml_matt_tool?: string | null
          ml_matt_word?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_publish_enabled?: boolean
          auto_publish_max_per_day?: number
          auto_publish_max_per_run?: number
          auto_publish_min_score?: number
          created_at?: string
          id?: boolean
          ml_matt_tool?: string | null
          ml_matt_word?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      banners: {
        Row: {
          active: boolean
          call_to_action: string | null
          created_at: string
          href: string | null
          id: string
          image_url: string | null
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          call_to_action?: string | null
          created_at?: string
          href?: string | null
          id?: string
          image_url?: string | null
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          call_to_action?: string | null
          created_at?: string
          href?: string | null
          id?: string
          image_url?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      candidate_products: {
        Row: {
          last_run_id: string | null
          publish_mode: 'manual' | 'auto' | null
          published_by: string | null
          affiliate_url: string | null
          brand: string | null
          condition: string | null
          created_at: string
          currency: string
          discount_pct: number | null
          external_id: string
          first_seen_at: string
          free_shipping: boolean
          id: string
          image_url: string | null
          is_demo: boolean
          last_seen_at: string
          marketplace_id: string
          original_price: number | null
          permalink: string
          price: number
          product_id: string | null
          rating: number | null
          raw: Json | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviews_count: number | null
          score: number
          score_breakdown: Json
          search_term: string | null
          sold_quantity: number | null
          status: Database["public"]["Enums"]["candidate_status"]
          suggested_category_id: string | null
          times_seen: number
          title: string
          updated_at: string
        }
        Insert: {
          last_run_id?: string | null
          publish_mode?: 'manual' | 'auto' | null
          published_by?: string | null
          affiliate_url?: string | null
          brand?: string | null
          condition?: string | null
          created_at?: string
          currency?: string
          external_id: string
          first_seen_at?: string
          free_shipping?: boolean
          id?: string
          image_url?: string | null
          is_demo?: boolean
          last_seen_at?: string
          marketplace_id: string
          original_price?: number | null
          permalink: string
          price: number
          product_id?: string | null
          rating?: number | null
          raw?: Json | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviews_count?: number | null
          score?: number
          score_breakdown?: Json
          search_term?: string | null
          sold_quantity?: number | null
          status?: Database["public"]["Enums"]["candidate_status"]
          suggested_category_id?: string | null
          times_seen?: number
          title: string
          updated_at?: string
        }
        Update: {
          last_run_id?: string | null
          publish_mode?: 'manual' | 'auto' | null
          published_by?: string | null
          affiliate_url?: string | null
          brand?: string | null
          condition?: string | null
          created_at?: string
          currency?: string
          external_id?: string
          first_seen_at?: string
          free_shipping?: boolean
          id?: string
          image_url?: string | null
          is_demo?: boolean
          last_seen_at?: string
          marketplace_id?: string
          original_price?: number | null
          permalink?: string
          price?: number
          product_id?: string | null
          rating?: number | null
          raw?: Json | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviews_count?: number | null
          score?: number
          score_breakdown?: Json
          search_term?: string | null
          sold_quantity?: number | null
          status?: Database["public"]["Enums"]["candidate_status"]
          suggested_category_id?: string | null
          times_seen?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_products_last_run_id_fkey"
            columns: ["last_run_id"]
            isOneToOne: false
            referencedRelation: "radar_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_products_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_products_suggested_category_id_fkey"
            columns: ["suggested_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          ml_category_id: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          ml_category_id?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          ml_category_id?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      clicks: {
        Row: {
          campaign: string | null
          created_at: string
          device_type: string | null
          id: string
          marketplace_id: string | null
          medium: string | null
          product_id: string | null
          referrer: string | null
          source: string | null
        }
        Insert: {
          campaign?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          marketplace_id?: string | null
          medium?: string | null
          product_id?: string | null
          referrer?: string | null
          source?: string | null
        }
        Update: {
          campaign?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          marketplace_id?: string | null
          medium?: string | null
          product_id?: string | null
          referrer?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clicks_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clicks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          description: string
          discount_type: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value: number
          id: string
          marketplace: string
          minimum_purchase: number | null
          status: Database["public"]["Enums"]["coupon_status"]
          title: string
          updated_at: string
          valid_until: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          discount_type: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value: number
          id?: string
          marketplace: string
          minimum_purchase?: number | null
          status?: Database["public"]["Enums"]["coupon_status"]
          title: string
          updated_at?: string
          valid_until: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          discount_type?: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value?: number
          id?: string
          marketplace?: string
          minimum_purchase?: number | null
          status?: Database["public"]["Enums"]["coupon_status"]
          title?: string
          updated_at?: string
          valid_until?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_tokens: {
        Row: {
          access_token: string | null
          expires_at: string | null
          meta: Json
          provider: string
          refresh_token: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          expires_at?: string | null
          meta?: Json
          provider: string
          refresh_token?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          expires_at?: string | null
          meta?: Json
          provider?: string
          refresh_token?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      marketplaces: {
        Row: {
          active: boolean
          affiliate_hosts: string[]
          created_at: string
          id: string
          logo: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          affiliate_hosts?: string[]
          created_at?: string
          id?: string
          logo?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          affiliate_hosts?: string[]
          created_at?: string
          id?: string
          logo?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      product_price_history: {
        Row: {
          id: string
          price: number
          product_id: string
          recorded_at: string
        }
        Insert: {
          id?: string
          price: number
          product_id: string
          recorded_at?: string
        }
        Update: {
          id?: string
          price?: number
          product_id?: string
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          inactive_reason: string | null
          missing_offer_count: number
          offer_checked_at: string | null
          publish_mode: 'manual' | 'auto'
          published_at: string | null
          published_by: string | null
          published_run_id: string | null
          affiliate_url: string
          best_value: boolean
          brand: string
          category_id: string
          coupon_id: string | null
          created_at: string
          current_price: number
          description: string
          discount_percentage: number | null
          external_id: string | null
          featured: boolean
          flash_deal: boolean
          free_shipping: boolean
          gallery: string[]
          id: string
          image_url: string
          installment_value: number | null
          installments: string | null
          last_price_update: string
          marketplace_id: string
          name: string
          old_price: number | null
          rating: number | null
          reviews_count: number | null
          short_description: string
          slug: string
          source_url: string | null
          status: Database["public"]["Enums"]["product_status"]
          trending: boolean
          updated_at: string
        }
        Insert: {
          inactive_reason?: string | null
          missing_offer_count?: number
          offer_checked_at?: string | null
          publish_mode?: 'manual' | 'auto'
          published_at?: string | null
          published_by?: string | null
          published_run_id?: string | null
          affiliate_url: string
          best_value?: boolean
          brand?: string
          category_id: string
          coupon_id?: string | null
          created_at?: string
          current_price: number
          description?: string
          discount_percentage?: number | null
          external_id?: string | null
          featured?: boolean
          flash_deal?: boolean
          free_shipping?: boolean
          gallery?: string[]
          id?: string
          image_url: string
          installment_value?: number | null
          installments?: string | null
          last_price_update?: string
          marketplace_id: string
          name: string
          old_price?: number | null
          rating?: number | null
          reviews_count?: number | null
          short_description?: string
          slug: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          trending?: boolean
          updated_at?: string
        }
        Update: {
          inactive_reason?: string | null
          missing_offer_count?: number
          offer_checked_at?: string | null
          publish_mode?: 'manual' | 'auto'
          published_at?: string | null
          published_by?: string | null
          published_run_id?: string | null
          affiliate_url?: string
          best_value?: boolean
          brand?: string
          category_id?: string
          coupon_id?: string | null
          created_at?: string
          current_price?: number
          description?: string
          discount_percentage?: number | null
          external_id?: string | null
          featured?: boolean
          flash_deal?: boolean
          free_shipping?: boolean
          gallery?: string[]
          id?: string
          image_url?: string
          installment_value?: number | null
          installments?: string | null
          last_price_update?: string
          marketplace_id?: string
          name?: string
          old_price?: number | null
          rating?: number | null
          reviews_count?: number | null
          short_description?: string
          slug?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          trending?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_published_run_id_fkey"
            columns: ["published_run_id"]
            isOneToOne: false
            referencedRelation: "radar_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          marketing_opt_in: boolean
          role: Database["public"]["Enums"]["profile_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          marketing_opt_in?: boolean
          role?: Database["public"]["Enums"]["profile_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          marketing_opt_in?: boolean
          role?: Database["public"]["Enums"]["profile_role"]
          updated_at?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          marketplace_id: string | null
          slug: string
          starts_at: string
          status: Database["public"]["Enums"]["promotion_status"]
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          marketplace_id?: string | null
          slug: string
          starts_at?: string
          status?: Database["public"]["Enums"]["promotion_status"]
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          marketplace_id?: string | null
          slug?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["promotion_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      radar_runs: {
        Row: {
          auto_published_count: number
          expired_count: number
          refreshed_count: number
          errors: Json
          fetched_count: number
          finished_at: string | null
          id: string
          message: string | null
          started_at: string
          status: string
          terms_count: number
          trigger: string
          upserted_count: number
        }
        Insert: {
          auto_published_count?: number
          expired_count?: number
          refreshed_count?: number
          errors?: Json
          fetched_count?: number
          finished_at?: string | null
          id?: string
          message?: string | null
          started_at?: string
          status?: string
          terms_count?: number
          trigger?: string
          upserted_count?: number
        }
        Update: {
          auto_published_count?: number
          expired_count?: number
          refreshed_count?: number
          errors?: Json
          fetched_count?: number
          finished_at?: string | null
          id?: string
          message?: string | null
          started_at?: string
          status?: string
          terms_count?: number
          trigger?: string
          upserted_count?: number
        }
        Relationships: []
      }
      radar_search_terms: {
        Row: {
          min_price: number | null
          active: boolean
          category_id: string | null
          created_at: string
          id: string
          last_run_at: string | null
          max_results: number
          term: string
          updated_at: string
        }
        Insert: {
          min_price?: number | null
          active?: boolean
          category_id?: string | null
          created_at?: string
          id?: string
          last_run_at?: string | null
          max_results?: number
          term: string
          updated_at?: string
        }
        Update: {
          min_price?: number | null
          active?: boolean
          category_id?: string | null
          created_at?: string
          id?: string
          last_run_at?: string | null
          max_results?: number
          term?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "radar_search_terms_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          value: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          value?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          value?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_product_redirect: {
        Args: { p_product_id: string }
        Returns: {
          affiliate_url: string
          id: string
          marketplace_id: string
        }[]
      }
      get_public_products: {
        Args: { p_product_id?: string }
        Returns: {
          best_value: boolean
          brand: string
          category_id: string
          category_name: string
          category_slug: string
          created_at: string
          current_price: number
          description: string
          discount_percentage: number | null
          featured: boolean
          flash_deal: boolean
          free_shipping: boolean
          gallery: string[]
          id: string
          image_url: string
          installment_value: number | null
          installments: string | null
          last_price_update: string
          marketplace_id: string
          marketplace_name: string
          marketplace_slug: string
          name: string
          old_price: number | null
          rating: number | null
          reviews_count: number | null
          short_description: string
          slug: string
          trending: boolean
          updated_at: string
        }[]
      }
      get_public_price_history: {
        Args: { p_limit?: number; p_product_id: string }
        Returns: { price: number; recorded_at: string }[]
      }
      integration_status: {
        Args: { p_provider: string }
        Returns: { connected: boolean; expires_at: string | null; updated_at: string }[]
      }
      is_admin: { Args: never; Returns: boolean }
      publish_candidate: {
        Args: {
          p_affiliate_url: string
          p_candidate_id: string
          p_category_id: string
          p_name?: string
        }
        Returns: string
      }
      radar_begin_run: { Args: { p_trigger: string }; Returns: string | null }
      radar_check_secret: { Args: { p_secret: string }; Returns: boolean }
      radar_invoke: { Args: { p_trigger?: string }; Returns: number }
      publish_candidate_core: {
        Args: {
          p_actor: string | null
          p_affiliate_url: string
          p_candidate_id: string
          p_category_id: string
          p_mode: string
          p_name: string | null
          p_run_id: string | null
        }
        Returns: string
      }
      publish_candidate_internal: {
        Args: { p_affiliate_url: string; p_candidate_id: string; p_run_id: string }
        Returns: string
      }
      radar_refresh_products: {
        Args: { p_items: Json }
        Returns: { expired: number; refreshed: number }[]
      }
      radar_upsert_candidates:
        | {
            Args: { p_category_id: string | null; p_items: Json; p_marketplace_slug: string; p_search_term: string }
            Returns: number
          }
        | {
            Args: { p_category_id: string | null; p_items: Json; p_marketplace_slug: string; p_run_id: string; p_search_term: string }
            Returns: number
          }
      slugify: { Args: { p_text: string }; Returns: string }
      unpublish_products: {
        Args: { p_product_ids?: string[]; p_run_id?: string }
        Returns: number
      }
    }
    Enums: {
      article_status: "draft" | "active"
      candidate_status: "pending" | "approved" | "rejected"
      coupon_discount_type: "percent" | "amount"
      coupon_status: "active" | "expired" | "scheduled"
      product_status: "draft" | "active" | "inactive" | "expired"
      profile_role: "user" | "admin"
      promotion_status: "draft" | "active" | "expired"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
