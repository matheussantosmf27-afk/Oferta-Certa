import { createServerClient as createSupabaseServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

export const createServerClient = (): SupabaseClient<Database, 'public'> =>
  createSupabaseServerClient<Database, 'public'>(supabaseUrl, supabaseAnonKey, {
    // fornecemos apenas `getAll` — `setAll` é opcional e evita conflitos de tipagem
    cookies: {
      getAll: async () => {
        const nextCookies = await cookies()
        const cookieList = nextCookies.getAll()
        return cookieList.length > 0
          ? cookieList.map(({ name, value }) => ({ name, value }))
          : null
      },
    },
  })
