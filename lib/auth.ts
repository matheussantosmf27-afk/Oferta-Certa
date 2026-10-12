import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

/** Usuário autenticado validado no servidor do Supabase (não confia só no cookie). */
export const getCurrentUser = cache(async () => {
  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return data.user
})

export const getCurrentProfile = cache(async () => {
  const user = await getCurrentUser()
  if (!user) return null
  const supabase = await createServerClient()
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  return data
})

export async function requireUser(next: string) {
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`)
  return user
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false
  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc('is_admin')
  return !error && data === true
}

/** Garante usuário admin; usado em todas as páginas e ações do painel. */
export async function requireAdmin() {
  const user = await requireUser('/admin')
  if (!(await isCurrentUserAdmin())) redirect('/?erro=acesso-negado')
  return user
}

/** Aceita apenas caminhos internos para evitar redirecionamento aberto. */
export function safeNextPath(value: unknown, fallback = '/minha-conta'): string {
  if (typeof value !== 'string') return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  return value
}
