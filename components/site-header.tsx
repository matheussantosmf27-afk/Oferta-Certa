import Link from 'next/link'
import { Heart, Menu, Search } from 'lucide-react'
import { getCategories } from '@/services/catalog'
import { CartLink } from '@/components/cart/cart-link'
import { AccountLink } from '@/components/account-link'

function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2 text-slate-900" aria-label="Oferta Certa — início">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-600 text-white">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M20 12l-8 8-8-8 8-8h6a2 2 0 012 2v6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="16" cy="8" r="1.5" fill="currentColor" />
        </svg>
      </span>
      <span className="hidden text-lg font-bold leading-none sm:inline">Oferta Certa</span>
    </Link>
  )
}

export async function SiteHeader() {
  const categories = await getCategories()

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 sm:gap-6">
          <Logo />

          <form action="/buscar" method="get" role="search" className="min-w-0 flex-1">
            <label htmlFor="busca-topo" className="sr-only">
              Buscar ofertas
            </label>
            <div className="relative">
              <input
                id="busca-topo"
                name="q"
                type="search"
                placeholder="O que você procura?"
                className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-3 pr-11 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
              <button
                type="submit"
                aria-label="Buscar"
                className="absolute right-1 top-1/2 inline-flex h-8 w-9 -translate-y-1/2 items-center justify-center rounded bg-brand-600 text-white hover:bg-brand-700"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </form>

          <nav aria-label="Conta" className="hidden items-center gap-4 md:flex">
            <Link href="/favoritos" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-950">
              <Heart className="h-4 w-4" aria-hidden /> Favoritos
            </Link>
            <CartLink withLabel />
            <AccountLink />
          </nav>

          <div className="md:hidden">
            <CartLink />
          </div>

          <details className="relative md:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-center rounded-md border border-slate-200 p-2 text-slate-700 [&::-webkit-details-marker]:hidden">
              <Menu className="h-5 w-5" aria-hidden />
              <span className="sr-only">Abrir menu</span>
            </summary>
            <div className="absolute right-0 z-30 mt-2 w-56 rounded-md border border-slate-200 bg-white p-2 shadow-soft">
              <Link href="/favoritos" className="block rounded px-3 py-2 text-sm text-slate-800 hover:bg-slate-50">
                Favoritos
              </Link>
              <Link href="/categorias" className="block rounded px-3 py-2 text-sm text-slate-800 hover:bg-slate-50">
                Categorias
              </Link>
              <Link href="/ofertas" className="block rounded px-3 py-2 text-sm text-slate-800 hover:bg-slate-50">
                Ofertas
              </Link>
              <AccountLink variant="menu" />
            </div>
          </details>
        </div>

        {categories.length ? (
          <nav aria-label="Categorias" className="-mx-1 mt-3 overflow-x-auto">
            <ul className="flex gap-2 px-1 pb-1 text-sm">
              <li className="shrink-0">
                <Link href="/ofertas" className="inline-flex rounded-md bg-brand-50 px-3 py-1.5 font-medium text-brand-800 hover:bg-brand-100">
                  Ofertas do dia
                </Link>
              </li>
              {categories.map((category) => (
                <li key={category.id} className="shrink-0">
                  <Link href={`/categoria/${category.slug}`} className="inline-flex rounded-md bg-surface-100 px-3 py-1.5 text-slate-700 hover:bg-surface-200">
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    </header>
  )
}
