import { createServerClient } from '@/lib/supabase/server'
import { Flash, PageTitle } from '@/components/admin/flash'
import { SubmitButton } from '@/components/ui'
import { deleteSearchTerm, saveSearchTerm } from '@/app/admin/actions'
import { DEFAULT_STORES, RADAR_STORES } from '@/lib/stores'

export default async function SearchTermsPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const params = await searchParams
  const supabase = await createServerClient()
  const [{ data: terms }, { data: categories }] = await Promise.all([
    supabase.from('radar_search_terms').select('*').order('term'),
    supabase.from('categories').select('id, name').order('name'),
  ])

  const CategorySelect = ({ value }: { value?: string | null }) => (
    <select name="category_id" defaultValue={value ?? ''} className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm">
      <option value="">Sem categoria</option>
      {(categories ?? []).map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  )

  const StoreChecks = ({ value }: { value?: string[] | null }) => (
    <fieldset className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
      <legend className="sr-only">Lojas pesquisadas</legend>
      {RADAR_STORES.map((store) => (
        <label key={store.slug} className="flex items-center gap-1">
          <input type="checkbox" name="marketplaces" value={store.slug} defaultChecked={(value ?? DEFAULT_STORES).includes(store.slug)} /> {store.name}
        </label>
      ))}
    </fieldset>
  )

  return (
    <div className="space-y-5">
      <PageTitle title="Termos do Radar" description="O coletor busca cada termo ativo nas lojas marcadas (Mercado Livre, Shopee, AliExpress) e envia os resultados para a fila. Preço mínimo descarta acessórios baratos que não são o produto buscado; prefira termos específicos (ex.: “notebook i5 16gb”, “smart tv 50 polegadas”)." />
      <Flash ok={params.ok} erro={params.erro} />

      <form action={saveSearchTerm} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-4">
        <label className="min-w-[12rem] flex-1 text-sm">
          <span className="block font-medium text-slate-700">Novo termo</span>
          <input name="term" required maxLength={80} placeholder="ex.: monitor gamer" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <CategorySelect />
        <label className="text-sm">
          <span className="block font-medium text-slate-700">Resultados</span>
          <input name="max_results" type="number" min={1} max={50} defaultValue={30} className="mt-1 w-20 rounded-md border border-slate-300 px-2 py-2" />
        </label>
        <label className="text-sm">
          <span className="block font-medium text-slate-700">Preço mín. (R$)</span>
          <input name="min_price" type="number" min={0} step="0.01" placeholder="opcional" className="mt-1 w-28 rounded-md border border-slate-300 px-2 py-2" />
        </label>
        <StoreChecks />
        <input type="hidden" name="active" value="on" />
        <SubmitButton pendingText="Salvando…">Adicionar</SubmitButton>
      </form>

      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {(terms ?? []).map((term) => (
          <li key={term.id} className="flex flex-wrap items-center gap-2 p-3">
            <form action={saveSearchTerm} className="flex flex-1 flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={term.id} />
              <input name="term" defaultValue={term.term} required className="min-w-[10rem] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <CategorySelect value={term.category_id} />
              <input name="max_results" type="number" min={1} max={50} defaultValue={term.max_results} aria-label="Resultados" className="w-20 rounded-md border border-slate-300 px-2 py-2 text-sm" />
              <input
                name="min_price"
                type="number"
                min={0}
                step="0.01"
                defaultValue={term.min_price ?? ''}
                placeholder="Preço mín."
                aria-label="Preço mínimo (R$)"
                className="w-28 rounded-md border border-slate-300 px-2 py-2 text-sm"
              />
              <StoreChecks value={term.marketplaces} />
              <label className="flex items-center gap-1 text-sm text-slate-700">
                <input type="checkbox" name="active" defaultChecked={term.active} /> Ativo
              </label>
              <SubmitButton variant="secondary" pendingText="…">Salvar</SubmitButton>
            </form>
            <form action={deleteSearchTerm}>
              <input type="hidden" name="id" value={term.id} />
              <SubmitButton variant="secondary" pendingText="…" className="text-red-700">Excluir</SubmitButton>
            </form>
            <p className="w-full text-xs text-slate-400">
              Última coleta: {term.last_run_at ? new Date(term.last_run_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'nunca'}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
