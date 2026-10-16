'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { User } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'

/**
 * Link "Entrar" / e-mail do usuário, resolvido no navegador. Assim o cabeçalho não depende
 * de cookies no servidor e as páginas públicas podem ficar em cache.
 */
function useSessionEmail(): string | null | undefined {
  const [email, setEmail] = useState<string | null | undefined>(undefined)
  // Login e "Sair" acontecem no servidor (cookies) e terminam numa navegação: relê a sessão a cada página.
  const pathname = usePathname()
  useEffect(() => {
    const supabase = createBrowserClient()
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setEmail(data.session?.user.email ?? null)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null)
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [pathname])
  return email
}

export function AccountLink({ variant = 'desktop' }: { variant?: 'desktop' | 'menu' }) {
  const email = useSessionEmail()

  if (variant === 'menu') {
    return email ? (
      <Link href="/minha-conta" className="block rounded px-3 py-2 text-sm text-slate-800 hover:bg-slate-50">
        Minha conta
      </Link>
    ) : (
      <Link href="/login" className="block rounded px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-slate-50">
        Entrar
      </Link>
    )
  }

  // Enquanto carrega, reserva o espaço para não "pular" o layout.
  if (email === undefined) return <span className="inline-block h-9 w-16" aria-hidden />

  return email ? (
    <Link href="/minha-conta" className="inline-flex max-w-[12rem] items-center gap-1.5 truncate text-sm font-medium text-white/80 hover:text-white">
      <User className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">{email}</span>
    </Link>
  ) : (
    <Link href="/login" className="rounded-md bg-white px-3.5 py-2 text-sm font-semibold text-night hover:bg-brand-50">
      Entrar
    </Link>
  )
}
