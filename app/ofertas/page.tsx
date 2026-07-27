import { SectionHeading } from '@/components/section-heading'
import { ProductCard } from '@/components/product-card'
import { getAllProducts } from '@/services/data'

export default function DealsPage() {
  const products = getAllProducts()

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-8">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft sm:p-10">
        <SectionHeading title="Ofertas" description="Veja as ofertas e oportunidades mais recentes." />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  )
}
