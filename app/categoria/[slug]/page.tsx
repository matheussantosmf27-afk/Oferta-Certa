import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ProductGrid } from '@/components/product-card'
import { EmptyState } from '@/components/empty-state'
import { SortForm } from '@/components/sort-select'
import { getCategoryBySlug, listProducts, parseSort } from '@/services/catalog'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ ordem?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const category = await getCategoryBySlug(slug)
  if (!category) return { title: 'Categoria não encontrada' }
  return {
    title: category.name,
    description: category.description ?? `Ofertas selecionadas de ${category.name}.`,
    alternates: { canonical: `/categoria/${category.slug}` },
  }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { ordem } = await searchParams
  const category = await getCategoryBySlug(slug)
  if (!category) notFound()

  const sort = parseSort(ordem)
  const products = await listProducts({ categorySlug: category.slug, sort, limit: 60 })

  return (
    <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <nav aria-label="Trilha" className="text-sm text-slate-500">
        <Link href="/categorias" className="hover:text-slate-800">
          Categorias
        </Link>{' '}
        / <span className="text-slate-800">{category.name}</span>
      </nav>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-night">{category.name}</h1>
          {category.description ? <p className="mt-1 text-sm text-slate-600">{category.description}</p> : null}
        </div>
        {products.length ? <SortForm action={`/categoria/${category.slug}`} sort={sort} /> : null}
      </div>

      <div className="mt-6">
        {products.length ? (
          <div className="space-y-4">
            <ProductGrid products={products} showDealStatus />
            {category.productsCount > products.length ? (
              <p className="text-center">
                <Link
                  href={`/buscar?categoria=${category.slug}${sort !== 'relevancia' ? `&ordem=${sort}` : ''}`}
                  className="inline-flex rounded-md border border-surface-300 bg-white px-4 py-2 text-sm font-semibold text-brand-700 hover:border-brand-500"
                >
                  Ver todos os {category.productsCount} produtos, com filtro por marca
                </Link>
              </p>
            ) : null}
          </div>
        ) : (
          <EmptyState title="Nenhum produto nesta categoria ainda" description="Estamos importando produtos desta categoria. Volte em breve." />
        )}
      </div>
    </div>
  )
}
