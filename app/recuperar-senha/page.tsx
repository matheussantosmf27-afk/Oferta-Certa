import type { Metadata } from 'next'
import { AuthCard } from '@/components/auth/auth-card'
import { ResetRequestForm } from '@/components/auth/auth-forms'

export const metadata: Metadata = { title: 'Recuperar senha', robots: { index: false } }

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Recuperar senha" description="Enviaremos um link para você criar uma nova senha.">
      <ResetRequestForm />
    </AuthCard>
  )
}
