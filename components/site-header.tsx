import Link from 'next/link'
import { Search, Menu } from 'lucide-react'

const navItems = [
  'Celulares',
  'Informática',
  'TV e Áudio',
  'Casa',
  'Eletrodomésticos',
  'Games',
  'Ferramentas',
  'Automotivo',
  'Beleza',
  'Esportes'
]

export function SiteHeader() {
  return (
    <header className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3 text-slate-900">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-600 text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M3 7.5V16.5C3 17.3284 3.67157 18 4.5 18H8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 7.5V16.5C21 17.3284 20.3284 18 19.5 18H15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 6V18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-bold leading-none">Oferta Certa</p>
            </div>
          </Link>

          <form action="/buscar" method="get" className="flex flex-1 items-center">
            <label htmlFor="q" className="sr-only">Buscar</label>
            <div className="relative w-full">
              <input
                id="q"
                name="q"
                placeholder="O que você está procurando?"
                className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white">
                <Search className="h-4 w-4" /> Buscar
              </button>
            </div>
          </form>

          <div className="hidden items-center gap-4 md:flex">
            <Link href="/favoritos" className="text-sm font-medium text-slate-700 hover:text-slate-900">Favoritos</Link>
          </div>

          <button type="button" className="inline-flex items-center justify-center rounded-md bg-slate-50 p-2 text-slate-700 md:hidden">
            <Menu className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="Categorias rápidas" className="mt-3 w-full overflow-x-auto">
          <ul className="flex gap-3 px-1 text-sm">
            {navItems.map((label) => (
              <li key={label} className="shrink-0">
                <Link href={`/categoria/${label.toLowerCase().replace(/\s+/g, '-')}`} className="inline-flex items-center gap-2 rounded-md bg-surface-50 px-3 py-2 text-slate-700 hover:bg-surface-100">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}
