import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/auth-helpers-nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

export const createBrowserClient = (): SupabaseClient<Database, 'public'> =>
  createSupabaseBrowserClient<Database, 'public'>(supabaseUrl, supabaseAnonKey)
