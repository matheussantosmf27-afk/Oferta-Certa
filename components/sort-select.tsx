import { SORT_OPTIONS } from '@/services/catalog'
import type { ProductSort } from '@/types'

/** Formulário GET de ordenação; preserva os demais parâmetros como campos ocultos. */
export function SortForm({
  action,
  sort,
  hidden = {},
}: {
  action: string
  sort: ProductSort
  hidden?: Record<string, string | undefined>
}) {
  return (
    <form action={action} method="get" className="flex items-center gap-2">
      {Object.entries(hidden).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null
      )}
      <label htmlFor="ordem" className="text-sm text-slate-600">
        Ordenar por
      </label>
      <select
        id="ordem"
        name="ordem"
        defaultValue={sort}
        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50">
        Aplicar
      </button>
    </form>
  )
}
