import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { Flash, PageTitle } from '@/components/admin/flash'
import { SubmitButton } from '@/components/ui'
import { addCatalogSeed, runRadarNow, updateCatalogSeed } from '@/app/admin/actions'

const fmt = (value: string | null) =>
  value ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : '—'

const STATUS_LABEL: Record<string, string> = { pending: 'na fila', done: 'concluída', error: 'com erro', paused: 'pausada' }

const ISSUE_LABEL: Record<string, string> = {
  marca: 'sem marca',
  imagem: 'sem imagem',
  modelo: 'sem modelo na ficha',
  descricao: 'sem descrição',
  categoria_da_loja: 'sem categoria da loja',
  sem_marca: 'sem marca',
  sem_imagem: 'sem imagem',
  sem_categoria: 'sem categoria do site',
  usado: 'usados/recondicionados',
}

interface Quality {
  published?: number
  by_source?: Record<string, number>
  with_trusted_discount?: number
  products_missing?: Record<string, number>
  candidates_pending?: number
  candidates_incomplete?: Record<string, number>
  seeds?: Record<string, number>
}

export default async function CatalogImportPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; status?: string }> }) {
  const params = await searchParams
  const statusFilter = ['pending', 'done', 'error', 'paused'].includes(params.status ?? '') ? (params.status as string) : null
  const supabase = await createServerClient()
  let seedsQuery = supabase
    .from('catalog_import_seeds')
    .select('id, query, status, next_offset, max_pages, last_run_at, last_found, total_found, total_saved, last_error, attempts, categories(name)')
    .order('status')
    .order('priority', { ascending: false })
    .limit(300)
  if (statusFilter) seedsQuery = seedsQuery.eq('status', statusFilter)
  const [{ data: quality, error: qualityError }, { data: seeds }, { data: runs }, { data: categories }] = await Promise.all([
    supabase.rpc('get_catalog_quality', {}),
    seedsQuery,
    supabase
      .from('radar_runs')
      .select('id, trigger, status, started_at, finished_at, message, dry_run, auto_published_count')
      .eq('source', 'catalogo')
      .order('started_at', { ascending: false })
      .limit(12),
    supabase.from('categories').select('id, name').order('name'),
  ])
  const q = (quality ?? {}) as Quality
  const bySource = q.by_source ?? {}

  return (
    <div className="space-y-6">
      <PageTitle
        title="Importação do catálogo"
        description="Buscas por marca, modelo e tipo de produto na API oficial do Mercado Livre. Roda sozinha a cada 10 minutos, uma página por busca, e retoma de onde parou."
      >
        <div className="flex flex-wrap gap-2">
          <form action={runRadarNow}>
            <input type="hidden" name="source" value="catalogo" />
            <input type="hidden" name="dry_run" value="on" />
            <SubmitButton variant="secondary" pendingText="Simulando…">
              Simular (não grava)
            </SubmitButton>
          </form>
          <form action={runRadarNow}>
            <input type="hidden" name="source" value="catalogo" />
            <SubmitButton pendingText="Importando…">Importar agora</SubmitButton>
          </form>
        </div>
      </PageTitle>
      <Flash ok={params.ok} erro={params.erro ?? qualityError?.message} />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Produtos publicados" value={q.published} />
        <Stat label="Do catálogo (sem exigir promoção)" value={bySource.catalogo ?? 0} />
        <Stat label="Ofertas do Radar" value={(bySource.radar ?? 0) + (bySource.manual ?? 0)} hint={bySource.manual ? `${bySource.manual} manuais` : undefined} />
        <Stat label="Com desconto conferido" value={q.with_trusted_discount} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Produtos publicados com dados faltando</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {Object.entries(q.products_missing ?? {}).map(([key, value]) => (
              <li key={key} className="flex justify-between gap-2">
                <span>{ISSUE_LABEL[key] ?? key}</span>
                <span className="tabular font-medium">{value}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">Descrição e ficha são completadas pelo coletor aos poucos. Nada é inventado para preencher.</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Fila de revisão ({q.candidates_pending ?? 0} pendentes)</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {Object.entries(q.candidates_incomplete ?? {}).map(([key, value]) => (
              <li key={key} className="flex justify-between gap-2">
                <span>{ISSUE_LABEL[key] ?? key}</span>
                <span className="tabular font-medium">{value}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            Incompletos não são publicados sozinhos. Corrija e publique pela{' '}
            <Link href="/admin/radar" className="text-brand-700 hover:underline">
              fila do Radar
            </Link>{' '}
            (lá dá para escolher a categoria e o nome).
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-slate-950">Últimas importações</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Início</th>
                <th className="p-3">Status</th>
                <th className="p-3">Resumo (números reais da execução)</th>
              </tr>
            </thead>
            <tbody>
              {(runs ?? []).map((run) => (
                <tr key={run.id} className="border-t border-slate-100 align-top">
                  <td className="p-3 text-slate-700">
                    {fmt(run.started_at)}
                    <p className="text-xs text-slate-400">
                      {run.dry_run ? 'simulação' : run.trigger === 'schedule' ? 'agendada' : 'manual'}
                    </p>
                  </td>
                  <td className="p-3">{run.status}</td>
                  <td className="p-3 text-xs text-slate-600">{run.message ?? 'em andamento…'}</td>
                </tr>
              ))}
              {!runs?.length ? (
                <tr>
                  <td colSpan={3} className="p-3 text-slate-500">
                    Nenhuma importação ainda.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-semibold text-slate-950">Buscas da importação</h2>
          <nav className="flex flex-wrap gap-1 text-sm" aria-label="Filtrar buscas">
            {[null, 'pending', 'done', 'error', 'paused'].map((status) => (
              <Link
                key={status ?? 'todas'}
                href={status ? `/admin/catalogo?status=${status}` : '/admin/catalogo'}
                className={`rounded-full border px-3 py-1 ${statusFilter === status ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
              >
                {status ? STATUS_LABEL[status] : 'todas'} {status ? `(${q.seeds?.[status] ?? 0})` : ''}
              </Link>
            ))}
          </nav>
        </div>

        <form action={addCatalogSeed} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3">
          <label className="min-w-[14rem] flex-1 text-sm">
            <span className="block font-medium text-slate-700">Nova busca (marca, modelo ou tipo)</span>
            <input name="query" required minLength={2} maxLength={100} placeholder="Ex.: Samsung Galaxy S25 FE" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="block font-medium text-slate-700">Categoria (se a loja não indicar)</span>
            <select name="category_id" className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-2">
              <option value="">—</option>
              {(categories ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block font-medium text-slate-700">Preço mínimo (R$)</span>
            <input name="min_price" type="number" min={0} step="0.01" className="mt-1 w-28 rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="block font-medium text-slate-700">Páginas</span>
            <input name="max_pages" type="number" min={1} max={10} defaultValue={2} className="mt-1 w-20 rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <SubmitButton pendingText="Adicionando…">Adicionar</SubmitButton>
        </form>

        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Busca</th>
                <th className="p-3">Situação</th>
                <th className="p-3">Encontrados</th>
                <th className="p-3">Gravados</th>
                <th className="p-3">Última execução</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {(seeds ?? []).map((seed) => {
                const category = seed.categories as { name?: string } | { name?: string }[] | null
                const categoryName = Array.isArray(category) ? category[0]?.name : category?.name
                return (
                  <tr key={seed.id} className="border-t border-slate-100 align-top">
                    <td className="p-3">
                      <span className="font-medium text-slate-900">{seed.query}</span>
                      {categoryName ? <p className="text-xs text-slate-500">{categoryName}</p> : null}
                    </td>
                    <td className="p-3">
                      {STATUS_LABEL[seed.status] ?? seed.status}
                      {seed.status === 'pending' && seed.next_offset ? (
                        <p className="text-xs text-slate-500">
                          página {seed.next_offset / 20 + 1} de {seed.max_pages}
                        </p>
                      ) : null}
                      {seed.last_error ? <p className="max-w-xs text-xs text-red-700">{seed.last_error}</p> : null}
                    </td>
                    <td className="tabular p-3">{seed.total_found}</td>
                    <td className="tabular p-3">{seed.total_saved}</td>
                    <td className="p-3 text-slate-600">{fmt(seed.last_run_at)}</td>
                    <td className="p-3">
                      <form action={updateCatalogSeed}>
                        <input type="hidden" name="seed_id" value={seed.id} />
                        <input type="hidden" name="action" value={seed.status === 'pending' ? 'pause' : 'resume'} />
                        <SubmitButton variant="secondary" pendingText="…">
                          {seed.status === 'pending' ? 'Pausar' : seed.status === 'done' ? 'Importar de novo' : 'Retomar'}
                        </SubmitButton>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: number | undefined; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold text-slate-950">{value ?? '—'}</p>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
}
