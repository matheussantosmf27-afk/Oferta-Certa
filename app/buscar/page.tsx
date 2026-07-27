import Link from 'next/link'
import { Search } from 'lucide-react'
import { getCategories, searchProducts } from '@/services/data'
import { SectionHeading } from '@/components/section-heading'
import { ProductCard } from '@/components/product-card'
import { EmptyState } from '@/components/empty-state'

interface SearchPageProps {
  searchParams?: Promise<{ q?: string }>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = searchParams ? await searchParams : { q: undefined }
  const query = params.q ?? ''
  const products = query ? searchProducts(query) : []

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft sm:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Buscar</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950">Resultados para {query ? `“${query}”` : 'sua busca'}</h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-sm text-slate-700">
            <Search className="h-4 w-4" />
            {query || 'Pesquisa livre'}
          </div>
        </div>
        <p className="text-sm leading-6 text-slate-600">
          Pesquise por produto, marca ou categoria. Utilize palavras-chave para encontrar ofertas.
        </p>
      </div>

      <section className="mt-10 space-y-6">
        <SectionHeading title="Categorias" description="Explore sugestões rápidas para descobrir ofertas." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {getCategories().map((category) => (
            <Link key={category.id} href={`/categoria/${category.slug}`} className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-5 transition hover:-translate-y-1 hover:shadow-card">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-brand-50 text-brand-700">{category.icon}</div>
              <h2 className="mt-4 text-lg font-semibold text-slate-950">{category.name}</h2>
              <p className="mt-2 text-sm text-slate-500">{category.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10">
        {query ? (
          products.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <EmptyState title="Nenhum resultado encontrado" description="Tente outro termo de busca ou remova filtros para ver mais ofertas." />
          )
        ) : (
          <EmptyState title="Faça sua busca" description="Digite o nome do produto ou categoria que você deseja encontrar." />
        )}
      </section>
    </div>
  )
}
