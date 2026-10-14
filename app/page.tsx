import Link from 'next/link'
import { ProductGrid } from '@/components/product-card'
import { SectionHeading } from '@/components/section-heading'
import { EmptyState } from '@/components/empty-state'
import { getCategories, listProducts } from '@/services/catalog'

// Página pública em cache, renovada a cada 5 minutos (preços mudam a cada coleta).
export const revalidate = 300

export default async function HomePage() {
  const [deals, featured, recent, categories] = await Promise.all([
    listProducts({ sort: 'maior-desconto', withDiscountOnly: true, limit: 8 }),
    listProducts({ featuredOnly: true, limit: 8 }),
    listProducts({ sort: 'recentes', limit: 12 }),
    getCategories(),
  ])

  const hasProducts = deals.length + featured.length + recent.length > 0

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <section className="rounded-lg bg-brand-700 px-6 py-8 text-white sm:px-10">
        <h1 className="max-w-2xl text-2xl font-bold sm:text-3xl">Ofertas reais, preços conferidos.</h1>
        <p className="mt-2 max-w-2xl text-sm text-brand-50 sm:text-base">
          Selecionamos oportunidades nas maiores lojas do Brasil e mostramos o desconto só quando ele existe de verdade.
        </p>
        <form action="/buscar" method="get" role="search" className="mt-5 flex max-w-xl gap-2">
          <label htmlFor="busca-home" className="sr-only">
            Buscar ofertas
          </label>
          <input
            id="busca-home"
            name="q"
            type="search"
            placeholder="Ex.: air fryer, notebook, fone bluetooth"
            className="min-w-0 flex-1 rounded-md border-0 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
          <button type="submit" className="rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
            Buscar
          </button>
        </form>
      </section>

      {!hasProducts ? (
        <EmptyState
          title="Estamos preparando as primeiras ofertas"
          description="Nossa equipe está conferindo preços e links. Volte em breve ou explore as categorias."
          action={
            <Link href="/categorias" className="text-sm font-semibold text-brand-700 hover:underline">
              Ver categorias
            </Link>
          }
        />
      ) : null}

      {deals.length ? (
        <section className="space-y-4">
          <SectionHeading title="Ofertas do dia" description="Maiores descontos em relação ao preço anterior informado pela loja." href="/ofertas" />
          <ProductGrid products={deals} />
        </section>
      ) : null}

      {featured.length ? (
        <section className="space-y-4">
          <SectionHeading title="Destaques" description="Produtos escolhidos pela nossa curadoria." />
          <ProductGrid products={featured} />
        </section>
      ) : null}

      {categories.length ? (
        <section className="space-y-4">
          <SectionHeading title="Categorias" href="/categorias" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/categoria/${category.slug}`}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:border-brand-300"
              >
                <span className="text-2xl" aria-hidden>
                  {category.icon}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{category.name}</span>
                  <span className="block text-xs text-slate-500">
                    {category.productsCount} {category.productsCount === 1 ? 'oferta' : 'ofertas'}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {recent.length ? (
        <section className="space-y-4">
          <SectionHeading title="Atualizados recentemente" />
          <ProductGrid products={recent} />
        </section>
      ) : null}
    </div>
  )
}
