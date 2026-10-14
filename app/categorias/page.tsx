import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyState } from '@/components/empty-state'
import { getCategories } from '@/services/catalog'

// Página pública em cache, renovada a cada 5 minutos (preços mudam a cada coleta).
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Categorias',
  description: 'Navegue pelas ofertas por categoria.',
  alternates: { canonical: '/categorias' },
}

export default async function CategoriesPage() {
  const categories = await getCategories()
  return (
    <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-slate-950">Categorias</h1>
      <div className="mt-6">
        {categories.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/categoria/${category.slug}`}
                className="flex items-start gap-4 rounded-lg border border-slate-200 bg-white p-4 transition hover:border-brand-300"
              >
                <span className="text-3xl" aria-hidden>
                  {category.icon}
                </span>
                <span>
                  <span className="block font-semibold text-slate-950">{category.name}</span>
                  {category.description ? <span className="mt-1 block text-sm text-slate-600">{category.description}</span> : null}
                  <span className="mt-2 block text-xs font-medium text-brand-700">
                    {category.productsCount} {category.productsCount === 1 ? 'oferta' : 'ofertas'}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="Nenhuma categoria" description="As categorias aparecerão aqui assim que forem cadastradas." />
        )}
      </div>
    </div>
  )
}
