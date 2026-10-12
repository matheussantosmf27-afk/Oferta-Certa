import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthCard } from '@/components/auth/auth-card'
import { LoginForm } from '@/components/auth/auth-forms'
import { getCurrentUser, safeNextPath } from '@/lib/auth'

export const metadata: Metadata = { title: 'Entrar', robots: { index: false } }

const NOTICES: Record<string, string> = {
  'link-invalido': 'O link expirou ou já foi usado. Entre com sua senha ou peça um novo link.',
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const params = await searchParams
  const next = safeNextPath(params.next)
  if (await getCurrentUser()) redirect(next)

  return (
    <AuthCard title="Entrar" description="Acesse seus favoritos e sua conta.">
      <LoginForm next={next} notice={params.erro ? NOTICES[params.erro] : undefined} />
    </AuthCard>
  )
}
