import Link from 'next/link'

export function SearchHero() {
  return (
    <div className="rounded-md bg-surface-50 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">Ofertas rápidas</p>
          <p className="mt-1 text-sm text-slate-600">Encontre promoções e cupons em destaque.</p>
        </div>
        <Link href="/buscar?q=" className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
          Buscar ofertas
        </Link>
      </div>
    </div>
  )
}
