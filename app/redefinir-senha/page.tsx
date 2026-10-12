import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthCard } from '@/components/auth/auth-card'
import { NewPasswordForm } from '@/components/auth/auth-forms'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Nova senha', robots: { index: false } }

export default async function NewPasswordPage() {
  await requireUser('/redefinir-senha')
  return (
    <AuthCard title="Criar nova senha">
      <NewPasswordForm />
      <Link href="/minha-conta" className="mt-4 inline-block text-sm text-brand-700 hover:underline">
        Ir para Minha Conta
      </Link>
    </AuthCard>
  )
}
