import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

/** Cliente Supabase para componentes 'use client'. Usa apenas a chave pública. */
export const createBrowserClient = (): SupabaseClient<Database, 'public'> =>
  createSupabaseBrowserClient<Database, 'public'>(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string
  )
