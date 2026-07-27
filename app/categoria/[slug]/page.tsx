import { notFound } from 'next/navigation'
import { SectionHeading } from '@/components/section-heading'
import { ProductCard } from '@/components/product-card'
import { getCategoryBySlug, getProductsByCategory } from '@/services/data'
import { EmptyState } from '@/components/empty-state'

export default async function CategoryPage(props: { params: Promise<{ slug: string }> }) {
  const { params } = props
  const { slug } = await params
  const category = getCategoryBySlug(slug)
  if (!category) {
    notFound()
  }

  const products = getProductsByCategory(category.id)

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-8">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft sm:p-10">
        <SectionHeading title={category.name} description={category.description} />
      </div>

      <section className="mt-8">
        {products.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <EmptyState title="Nenhuma oferta encontrada" description="Por enquanto não há produtos nessa categoria." />
        )}
      </section>
    </div>
  )
}
