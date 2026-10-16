/** Estado de carregamento da busca (aparece enquanto o servidor consulta o catálogo). */
export default function SearchLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8" aria-busy="true" aria-live="polite">
      <p className="sr-only">Buscando produtos…</p>
      <div className="h-8 w-64 animate-pulse rounded bg-surface-200" />
      <div className="mt-4 h-14 animate-pulse rounded-xl bg-surface-200" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <div className="hidden space-y-2 lg:block">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="h-7 animate-pulse rounded bg-surface-200" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="h-72 animate-pulse rounded-xl bg-surface-200" />
          ))}
        </div>
      </div>
    </div>
  )
}
