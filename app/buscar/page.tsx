import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { ProductGrid } from '@/components/product-card'
import { EmptyState } from '@/components/empty-state'
import { SORT_OPTIONS, getSearchFacets, searchCatalog } from '@/services/catalog'
import { SEARCH_PAGE_SIZE, pageWindow, parseSearchState, searchHref, totalPages, type SearchState } from '@/lib/search-params'

type SearchParams = Record<string, string | string[] | undefined>

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const { q } = parseSearchState(await searchParams)
  return { title: q ? `Busca: ${q}` : 'Buscar produtos', robots: { index: false, follow: true } }
}

const SORT_LABELS = Object.fromEntries(SORT_OPTIONS.map((option) => [option.value, option.label]))

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const state = parseSearchState(await searchParams)
  const active = Boolean(state.q || state.categoria || state.marca)
  const [result, facets] = active
    ? await Promise.all([
        searchCatalog({ q: state.q, category: state.categoria, brand: state.marca, sort: state.ordem, page: state.pagina, pageSize: SEARCH_PAGE_SIZE }),
        getSearchFacets(state.q, state.categoria, state.marca),
      ])
    : [null, null]
  const pages = result ? totalPages(result.total) : 1
  const categoryName = facets?.categories.find((category) => category.slug === state.categoria)?.name ?? state.categoria
  const first = result && result.total ? (state.pagina - 1) * SEARCH_PAGE_SIZE + 1 : 0
  const last = result ? Math.min(state.pagina * SEARCH_PAGE_SIZE, result.total) : 0

  return (
    <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <h1 className="font-display text-2xl font-bold tracking-tight text-night">
        {state.q ? `Resultados para “${state.q}”` : categoryName && active ? categoryName : 'Buscar produtos'}
      </h1>

      <form action="/buscar" method="get" role="search" className="mt-4 flex gap-2 rounded-xl border border-surface-300 bg-white p-3">
        <label htmlFor="q" className="sr-only">
          Produto, marca, modelo ou código
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={state.q}
          placeholder="Ex.: Galaxy S25 Ultra 256 GB, notebook Lenovo, creatina 300 g"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        {state.categoria ? <input type="hidden" name="categoria" value={state.categoria} /> : null}
        {state.ordem !== 'relevancia' ? <input type="hidden" name="ordem" value={state.ordem} /> : null}
        <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          <Search className="h-4 w-4" aria-hidden /> Buscar
        </button>
      </form>

      {!active || !result || !facets ? (
        <div className="mt-6">
          <EmptyState
            title="O que você procura?"
            description="Digite o nome do produto, a marca, o modelo ou o código (EAN). Exemplos: “iPhone 16 Pro”, “JBL Tune 530BT”, “air fryer Mondial 4 litros”."
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
          {/* Celular: filtros recolhidos para os resultados aparecerem logo; computador: barra lateral aberta. */}
          <details className="rounded-xl border border-surface-300 bg-white p-3 lg:hidden">
            <summary className="cursor-pointer text-sm font-semibold text-slate-900">
              Filtrar por categoria e marca{state.categoria || state.marca ? ' (filtro ativo)' : ''}
            </summary>
            <div className="mt-3 space-y-5">
            <ActiveFilters state={state} categoryName={categoryName} />
            <FacetList
              title="Categorias"
              items={facets.categories.map((category) => ({
                label: category.name,
                count: category.count,
                href: searchHref(state, { categoria: category.slug === state.categoria ? null : category.slug }),
                selected: category.slug === state.categoria,
              }))}
            />
            <FacetList
              title="Marcas"
              items={facets.brands.map((brand) => {
                const selected = brand.name.toLowerCase() === state.marca?.toLowerCase()
                return { label: brand.name, count: brand.count, href: searchHref(state, { marca: selected ? null : brand.name }), selected }
              })}
            />
            </div>
          </details>
          <aside className="hidden space-y-5 lg:block" aria-label="Filtros">
            <ActiveFilters state={state} categoryName={categoryName} />
            <FacetList
              title="Categorias"
              items={facets.categories.map((category) => ({
                label: category.name,
                count: category.count,
                href: searchHref(state, { categoria: category.slug === state.categoria ? null : category.slug }),
                selected: category.slug === state.categoria,
              }))}
            />
            <FacetList
              title="Marcas"
              items={facets.brands.map((brand) => {
                const selected = brand.name.toLowerCase() === state.marca?.toLowerCase()
                return { label: brand.name, count: brand.count, href: searchHref(state, { marca: selected ? null : brand.name }), selected }
              })}
            />
          </aside>

          <section className="min-w-0 space-y-4" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                {result.error
                  ? 'Não foi possível buscar agora.'
                  : result.total
                    ? `${first}–${last} de ${result.total} ${result.total === 1 ? 'produto' : 'produtos'}`
                    : 'Nenhum produto encontrado'}
              </p>
              <nav aria-label="Ordenar" className="flex flex-wrap items-center gap-1 text-sm">
                <span className="mr-1 text-slate-500">Ordenar:</span>
                {SORT_OPTIONS.filter((option) => option.value !== 'maior-preco').map((option) => (
                  <Link
                    key={option.value}
                    href={searchHref(state, { ordem: option.value })}
                    aria-current={state.ordem === option.value ? 'true' : undefined}
                    className={`rounded-full border px-3 py-1 ${
                      state.ordem === option.value ? 'border-night bg-night text-white' : 'border-surface-300 bg-white text-slate-700 hover:border-brand-500'
                    }`}
                  >
                    {option.value === 'maior-desconto' ? 'Maior desconto conferido' : SORT_LABELS[option.value]}
                  </Link>
                ))}
              </nav>
            </div>

            {result.approximate && result.products.length ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Nenhum produto com exatamente “{state.q}”. Mostrando resultados parecidos — confira o nome antes de comprar.
              </p>
            ) : null}
            {state.ordem === 'maior-desconto' ? (
              <p className="text-xs text-slate-500">
                Primeiro vêm os descontos conferidos pelo nosso histórico ou pelo preço dos outros vendedores; depois, produtos sem promoção confirmada.
              </p>
            ) : null}

            {result.error ? (
              <EmptyState
                title="A busca está indisponível no momento"
                description="Tente de novo em instantes. Se continuar, navegue pelas categorias."
                action={
                  <Link href={searchHref(state)} className="text-sm font-semibold text-brand-700 hover:underline">
                    Tentar de novo
                  </Link>
                }
              />
            ) : result.products.length ? (
              <ProductGrid products={result.products} showDealStatus />
            ) : (
              <EmptyState
                title="Nenhum produto encontrado"
                description={
                  state.categoria || state.marca
                    ? 'Tente remover algum filtro, usar menos palavras ou conferir a grafia do modelo.'
                    : 'Tente menos palavras, só a marca ou o modelo (ex.: “Galaxy S25”), ou confira a grafia.'
                }
                action={
                  state.categoria || state.marca ? (
                    <Link href={searchHref(state, { categoria: null, marca: null })} className="text-sm font-semibold text-brand-700 hover:underline">
                      Buscar sem filtros
                    </Link>
                  ) : undefined
                }
              />
            )}

            {pages > 1 ? <Pagination state={state} pages={pages} /> : null}
          </section>
        </div>
      )}
    </div>
  )
}

function ActiveFilters({ state, categoryName }: { state: SearchState; categoryName: string | null }) {
  if (!state.categoria && !state.marca) return null
  return (
    <div className="flex flex-wrap gap-2">
      {state.categoria ? (
        <Link
          href={searchHref(state, { categoria: null })}
          className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800 hover:bg-brand-100"
        >
          {categoryName} <X className="h-3.5 w-3.5" aria-label="remover filtro" />
        </Link>
      ) : null}
      {state.marca ? (
        <Link
          href={searchHref(state, { marca: null })}
          className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800 hover:bg-brand-100"
        >
          {state.marca} <X className="h-3.5 w-3.5" aria-label="remover filtro" />
        </Link>
      ) : null}
    </div>
  )
}

function FacetList({ title, items }: { title: string; items: { label: string; count: number; href: string; selected: boolean }[] }) {
  if (items.length < 2 && !items.some((item) => item.selected)) return null
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <ul className="mt-2 max-h-72 space-y-0.5 overflow-y-auto text-sm">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.selected ? 'true' : undefined}
              className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 ${
                item.selected ? 'bg-night font-medium text-white' : 'text-slate-700 hover:bg-surface-100'
              }`}
            >
              <span className="min-w-0 truncate">{item.label}</span>
              <span className={`tabular text-xs ${item.selected ? 'text-white/70' : 'text-slate-400'}`}>{item.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Pagination({ state, pages }: { state: SearchState; pages: number }) {
  const linkClass = 'inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-sm'
  return (
    <nav aria-label="Páginas" className="flex flex-wrap items-center justify-center gap-1 pt-2">
      {state.pagina > 1 ? (
        <Link href={searchHref(state, { pagina: state.pagina - 1 })} className={`${linkClass} border-surface-300 bg-white hover:border-brand-500`} aria-label="Página anterior">
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Link>
      ) : null}
      {pageWindow(state.pagina, pages).map((page, index) =>
        page === null ? (
          <span key={`gap-${index}`} className="px-1 text-slate-400">
            …
          </span>
        ) : (
          <Link
            key={page}
            href={searchHref(state, { pagina: page })}
            aria-current={page === state.pagina ? 'page' : undefined}
            className={`${linkClass} ${page === state.pagina ? 'border-night bg-night text-white' : 'border-surface-300 bg-white hover:border-brand-500'}`}
          >
            {page}
          </Link>
        )
      )}
      {state.pagina < pages ? (
        <Link href={searchHref(state, { pagina: state.pagina + 1 })} className={`${linkClass} border-surface-300 bg-white hover:border-brand-500`} aria-label="Próxima página">
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : null}
    </nav>
  )
}
