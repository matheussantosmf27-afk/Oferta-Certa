import Link from 'next/link'
import { ProductGrid } from '@/components/product-card'
import { SectionHeading } from '@/components/section-heading'
import { EmptyState } from '@/components/empty-state'
import { RadarHero } from '@/components/radar-hero'
import { getCategories, getRadarStatus, listProducts } from '@/services/catalog'
import { radarStatusText } from '@/lib/radar-status'

// Página pública em cache, renovada a cada 5 minutos (preços mudam a cada coleta).
export const revalidate = 300

export default async function HomePage() {
  const [deals, featured, recent, categories, radar] = await Promise.all([
    listProducts({ sort: 'maior-desconto', withDiscountOnly: true, limit: 8 }),
    listProducts({ featuredOnly: true, limit: 8 }),
    listProducts({ sort: 'recentes', limit: 12 }),
    getCategories(),
    getRadarStatus(),
  ])

  const hasProducts = deals.length + featured.length + recent.length > 0

  const status = radarStatusText(radar)

  return (
    <>
      <RadarHero deals={deals} status={status} />
      <div className="mx-auto max-w-7xl space-y-12 px-4 pb-14 pt-10 sm:px-6 lg:px-8">
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
          <SectionHeading title="Ofertas do dia" description="Maiores descontos confirmados pelo nosso histórico ou pelo preço dos outros vendedores." href="/ofertas" />
          <ProductGrid products={deals} />
        </section>
      ) : null}

      {featured.length ? (
        <section className="space-y-4">
          <SectionHeading title="Destaques" description="Quedas de preço reais em categorias diferentes, escolhidas pelo radar a cada 6 horas." />
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
                className="group flex items-center gap-3 rounded-xl border border-surface-300 bg-white p-3.5 transition hover:border-brand-500"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-100 text-2xl transition group-hover:bg-brand-50" aria-hidden>
                  {category.icon}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{category.name}</span>
                  <span className="tabular block text-xs text-slate-500">
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
    </>
  )
}
