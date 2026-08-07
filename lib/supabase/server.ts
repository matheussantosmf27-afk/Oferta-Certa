import 'dotenv/config'
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseServerKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) as string

export const createServerClient = async (): Promise<SupabaseClient<Database, 'public'>> => {
  const nextCookies = await cookies()

  return createSupabaseServerClient<Database, 'public'>(supabaseUrl, supabaseServerKey, {
    cookies: {
      getAll: () => {
        return nextCookies.getAll().map(({ name, value }) => ({ name, value }))
      },
      setAll: (cookieList) => {
        cookieList.forEach(({ name, value, options }) => {
          nextCookies.set({ name, value, ...options })
        })
      },
    },
  })
}
