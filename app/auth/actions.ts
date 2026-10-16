'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser, safeNextPath } from '@/lib/auth'

export interface FormState {
  error?: string
  success?: string
}

const AUTH_ERRORS: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.',
  'User already registered': 'Já existe uma conta com este e-mail.',
}

function translateAuthError(message: string): string {
  if (AUTH_ERRORS[message]) return AUTH_ERRORS[message]
  if (/password/i.test(message) && /characters/i.test(message)) return 'A senha precisa ter pelo menos 8 caracteres.'
  if (/rate limit/i.test(message)) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
  return 'Não foi possível concluir. Tente novamente.'
}

async function getOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'https'
  if (host) return `${proto}://${host}`
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

function field(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = field(formData, 'email')
  const password = String(formData.get('password') ?? '')
  if (!email || !password) return { error: 'Informe e-mail e senha.' }

  const supabase = await createServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: translateAuthError(error.message) }

  // O cabeçalho lê a sessão no navegador; não é preciso invalidar o cache das páginas públicas.
  redirect(safeNextPath(formData.get('next')))
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const fullName = field(formData, 'full_name')
  const email = field(formData, 'email')
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('password_confirm') ?? '')

  if (!email || !password) return { error: 'Informe e-mail e senha.' }
  if (password.length < 8) return { error: 'A senha precisa ter pelo menos 8 caracteres.' }
  if (password !== confirm) return { error: 'As senhas não conferem.' }

  const origin = await getOrigin()
  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/auth/confirm?next=/minha-conta`,
    },
  })
  if (error) return { error: translateAuthError(error.message) }

  if (data.session) {
    redirect('/minha-conta')
  }
  return { success: 'Conta criada! Enviamos um link de confirmação para o seu e-mail.' }
}

export async function signOut() {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  redirect('/')
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = field(formData, 'email')
  if (!email) return { error: 'Informe seu e-mail.' }
  const origin = await getOrigin()
  const supabase = await createServerClient()
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/redefinir-senha`,
  })
  // Mesma resposta para e-mail existente ou não, para não revelar contas.
  return { success: 'Se existir uma conta com este e-mail, você receberá um link para criar uma nova senha.' }
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Sua sessão expirou. Entre novamente.' }
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('password_confirm') ?? '')
  if (password.length < 8) return { error: 'A senha precisa ter pelo menos 8 caracteres.' }
  if (password !== confirm) return { error: 'As senhas não conferem.' }

  const supabase = await createServerClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: translateAuthError(error.message) }
  return { success: 'Senha atualizada com sucesso.' }
}

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Sua sessão expirou. Entre novamente.' }
  const fullName = field(formData, 'full_name').slice(0, 120)
  const marketingOptIn = formData.get('marketing_opt_in') === 'on'

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName || null, marketing_opt_in: marketingOptIn })
    .eq('id', user.id)
  if (error) {
    console.error('[auth] updateProfile', error)
    return { error: 'Não foi possível salvar seus dados.' }
  }
  revalidatePath('/minha-conta')
  return { success: 'Dados atualizados.' }
}
