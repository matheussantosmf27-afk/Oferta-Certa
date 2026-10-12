import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'
import { getPublicSupabaseEnv } from './env'

/**
 * Cliente Supabase do usuário atual, para Server Components, Route Handlers e Server Actions.
 * Usa SEMPRE a chave pública: as permissões vêm da sessão do usuário (cookies) e do RLS.
 * Para operações privilegiadas use `createAdminClient` de `./admin`.
 */
export const createServerClient = async () => {
  const { url, publishableKey } = getPublicSupabaseEnv()
  const nextCookies = await cookies()

  return createSupabaseServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => nextCookies.getAll().map(({ name, value }) => ({ name, value })),
      setAll: (cookieList) => {
        try {
          cookieList.forEach(({ name, value, options }) => {
            nextCookies.set({ name, value, ...options })
          })
        } catch {
          // Server Components não podem gravar cookies; o middleware renova a sessão.
        }
      },
    },
  })
}
