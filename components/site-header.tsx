import Link from 'next/link'
import { Heart, Menu, Search } from 'lucide-react'
import { getCategories } from '@/services/catalog'
import { CartLink } from '@/components/cart/cart-link'
import { AccountLink } from '@/components/account-link'
import { Logo } from '@/components/logo'
import { CategoryRail } from '@/components/category-rail'

export async function SiteHeader() {
  const categories = (await getCategories()).filter((category) => category.productsCount > 0)

  return (
    <header className="bg-night text-white">
      <div className="mx-auto max-w-7xl px-4 pt-3 sm:px-6 lg:px-8">
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
                className="w-full rounded-lg border border-white/15 bg-white/[0.07] py-2.5 pl-3.5 pr-12 text-sm text-white placeholder:text-white/50 focus:border-scan/70 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-scan/30"
              />
              <button
                type="submit"
                aria-label="Buscar"
                className="absolute right-1 top-1/2 inline-flex h-8 w-9 -translate-y-1/2 items-center justify-center rounded-md bg-brand-600 text-white hover:bg-brand-500"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </form>

          <nav aria-label="Conta" className="hidden items-center gap-4 md:flex">
            <Link href="/favoritos" className="inline-flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white">
              <Heart className="h-4 w-4" aria-hidden /> Favoritos
            </Link>
            <CartLink withLabel />
            <AccountLink />
          </nav>

          <div className="md:hidden">
            <CartLink />
          </div>

          <details className="relative md:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-center rounded-md border border-white/15 p-2 text-white/85 [&::-webkit-details-marker]:hidden">
              <Menu className="h-5 w-5" aria-hidden />
              <span className="sr-only">Abrir menu</span>
            </summary>
            <div className="absolute right-0 z-30 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-2 text-slate-800 shadow-soft">
              <Link href="/favoritos" className="block rounded px-3 py-2 text-sm hover:bg-surface-100">
                Favoritos
              </Link>
              <Link href="/categorias" className="block rounded px-3 py-2 text-sm hover:bg-surface-100">
                Categorias
              </Link>
              <Link href="/ofertas" className="block rounded px-3 py-2 text-sm hover:bg-surface-100">
                Ofertas
              </Link>
              <AccountLink variant="menu" />
            </div>
          </details>
        </div>

        {categories.length ? (
          <CategoryRail categories={categories.map(({ id, slug, name }) => ({ id, slug, name }))} />
        ) : null}
      </div>
    </header>
  )
}
