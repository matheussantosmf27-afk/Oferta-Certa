import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { getPublicSupabaseEnv } from './env'

/**
 * Cliente anônimo, sem cookies, para ler o catálogo público no servidor.
 * Não depende da sessão, então as páginas podem ser cacheadas.
 */
export function createPublicClient() {
  const { url, publishableKey } = getPublicSupabaseEnv()
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
