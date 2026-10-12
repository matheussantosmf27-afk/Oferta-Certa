import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { getPublicSupabaseEnv } from './env'

/**
 * Cliente com a service role: IGNORA o RLS.
 * Use somente no servidor, para tarefas que não dependem do usuário
 * (registro de cliques, coletor do Radar) ou depois de verificar que o usuário é admin.
 * Nunca importe este arquivo em componentes 'use client'.
 */
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('createAdminClient só pode ser usado no servidor')
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('Variável de ambiente ausente: SUPABASE_SERVICE_ROLE_KEY')
  }

  const { url } = getPublicSupabaseEnv()
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
