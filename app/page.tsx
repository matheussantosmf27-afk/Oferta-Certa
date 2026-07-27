// Removed unused imports
import { ProductCard } from '@/components/product-card'
import { SectionHeading } from '@/components/section-heading'
import { SearchHero } from '@/components/search-hero'
import { categories, featuredProducts, topDeals } from '@/data/demo'

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <section className="mt-2">
        <div className="grid gap-6 lg:grid-cols-3 lg:items-center">
          <div className="col-span-2">
            <div className="rounded-md bg-surface-50 p-4">
              <h1 className="text-2xl font-semibold text-slate-900">Ofertas do dia</h1>
              <p className="mt-1 text-sm text-slate-600">As melhores oportunidades selecionadas para você.</p>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {topDeals.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>

          <aside className="hidden lg:block">
            <SearchHero />
            <div className="mt-4 rounded-md bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Produtos selecionados</h3>
              <div className="mt-3 space-y-3">
                {featuredProducts.slice(0, 3).map((product) => (
                  <div key={product.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{product.name}</p>
                      <p className="text-xs text-slate-600">{product.marketplaceName}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">R$ {product.current_price.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="mt-10 space-y-6">
        <SectionHeading title="Categorias em destaque" description="Explore as ofertas por categoria." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <article key={category.id} className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-5 transition hover:-translate-y-1 hover:shadow-card">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-brand-50 text-brand-700">{category.icon}</div>
              <h3 className="mt-4 text-lg font-semibold text-slate-950">{category.name}</h3>
              <p className="mt-2 text-sm text-slate-500">{category.productsCount} produtos</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10 space-y-6">
        <SectionHeading title="Ofertas em destaque" description="Aproveite descontos, cupons e oportunidades selecionadas." />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {topDeals.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  )
}
