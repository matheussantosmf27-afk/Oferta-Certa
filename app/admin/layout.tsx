import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'

export const metadata: Metadata = { title: 'Painel', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

const NAV = [
  { href: '/admin', label: 'Painel' },
  { href: '/admin/radar', label: 'Radar de Ofertas' },
  { href: '/admin/radar/termos', label: 'Termos do Radar' },
  { href: '/admin/catalogo', label: 'Importação do catálogo' },
  { href: '/admin/automacao', label: 'Publicação automática' },
  { href: '/admin/produtos', label: 'Produtos' },
  { href: '/admin/categorias', label: 'Categorias' },
  { href: '/admin/marketplaces', label: 'Marketplaces' },
]

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin()
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[13rem_1fr]">
        <nav aria-label="Administração" className="lg:sticky lg:top-4 lg:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Administração</p>
          <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1">
            {NAV.map((item) => (
              <li key={item.href} className="shrink-0">
                <Link href={item.href} className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white hover:text-slate-950">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
