import type { Metadata } from 'next'
import { ProductGrid } from '@/components/product-card'
import { EmptyState } from '@/components/empty-state'
import { SortForm } from '@/components/sort-select'
import { getCategories, listProducts, parseSort } from '@/services/catalog'

interface SearchParams {
  q?: string
  categoria?: string
  ordem?: string
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const { q } = await searchParams
  return { title: q ? `Ofertas de ${q}` : 'Buscar ofertas', robots: { index: false, follow: true } }
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const query = (params.q ?? '').trim()
  const sort = parseSort(params.ordem)
  const [categories, products] = await Promise.all([
    getCategories(),
    query || params.categoria ? listProducts({ q: query, categorySlug: params.categoria, sort, limit: 60 }) : Promise.resolve([]),
  ])

  return (
    <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-slate-950">{query ? `Resultados para “${query}”` : 'Buscar ofertas'}</h1>

      <form action="/buscar" method="get" className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="q" className="block text-sm font-medium text-slate-700">
            Produto ou marca
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="categoria" className="block text-sm font-medium text-slate-700">
            Categoria
          </label>
          <select id="categoria" name="categoria" defaultValue={params.categoria ?? ''} className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm">
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <input type="hidden" name="ordem" value={sort} />
        <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Buscar
        </button>
      </form>

      {query || params.categoria ? (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {products.length} {products.length === 1 ? 'oferta encontrada' : 'ofertas encontradas'}
            </p>
            <SortForm action="/buscar" sort={sort} hidden={{ q: query, categoria: params.categoria }} />
          </div>
          {products.length ? (
            <ProductGrid products={products} />
          ) : (
            <EmptyState title="Nenhuma oferta encontrada" description="Tente outro termo, uma palavra mais curta ou outra categoria." />
          )}
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState title="O que você procura?" description="Digite o nome do produto, uma marca ou escolha uma categoria." />
        </div>
      )}
    </div>
  )
}
