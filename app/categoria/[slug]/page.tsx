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
    title: `Ofertas de ${category.name}`,
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
          <h1 className="text-2xl font-semibold text-slate-950">{category.name}</h1>
          {category.description ? <p className="mt-1 text-sm text-slate-600">{category.description}</p> : null}
        </div>
        {products.length ? <SortForm action={`/categoria/${category.slug}`} sort={sort} /> : null}
      </div>

      <div className="mt-6">
        {products.length ? (
          <ProductGrid products={products} />
        ) : (
          <EmptyState title="Nenhuma oferta nesta categoria ainda" description="Estamos conferindo novas ofertas. Volte em breve." />
        )}
      </div>
    </div>
  )
}
