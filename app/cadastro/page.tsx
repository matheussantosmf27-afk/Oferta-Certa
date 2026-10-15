import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthCard } from '@/components/auth/auth-card'
import { GoogleButton } from '@/components/auth/google-button'
import { SignUpForm } from '@/components/auth/auth-forms'
import { getCurrentUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Criar conta', robots: { index: false } }

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect('/minha-conta')
  return (
    <AuthCard title="Criar conta" description="Salve favoritos e acompanhe ofertas.">
      <GoogleButton />
      <SignUpForm />
    </AuthCard>
  )
}
