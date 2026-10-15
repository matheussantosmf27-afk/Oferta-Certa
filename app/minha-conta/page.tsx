import type { Metadata } from 'next'
import Link from 'next/link'
import { Heart, LayoutDashboard } from 'lucide-react'
import { NewPasswordForm, ProfileForm } from '@/components/auth/auth-forms'
import { getCurrentProfile, isCurrentUserAdmin, requireUser } from '@/lib/auth'
import { signOut } from '@/app/auth/actions'

export const metadata: Metadata = { title: 'Minha conta', robots: { index: false } }

export default async function AccountPage() {
  const user = await requireUser('/minha-conta')
  const [profile, isAdmin] = await Promise.all([getCurrentProfile(), isCurrentUserAdmin()])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-night">Minha conta</h1>
          <p className="mt-1 text-sm text-slate-600">{user.email}</p>
        </div>
        <form action={signOut}>
          <button type="submit" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">
            Sair
          </button>
        </form>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/favoritos" className="flex items-center gap-3 rounded-xl border border-surface-300 bg-white p-4 hover:border-brand-300">
          <Heart className="h-5 w-5 text-rose-500" aria-hidden />
          <span className="text-sm font-medium text-slate-900">Meus favoritos</span>
        </Link>
        {isAdmin ? (
          <Link href="/admin" className="flex items-center gap-3 rounded-xl border border-surface-300 bg-white p-4 hover:border-brand-300">
            <LayoutDashboard className="h-5 w-5 text-brand-700" aria-hidden />
            <span className="text-sm font-medium text-slate-900">Painel administrativo</span>
          </Link>
        ) : null}
      </div>

      <section className="mt-8 rounded-xl border border-surface-300 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-950">Seus dados</h2>
        <div className="mt-4">
          <ProfileForm fullName={profile?.full_name ?? ''} marketingOptIn={profile?.marketing_opt_in ?? false} />
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-surface-300 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-950">Alterar senha</h2>
        <div className="mt-4">
          <NewPasswordForm />
        </div>
      </section>
    </div>
  )
}
