import Image from 'next/image'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { Flash, PageTitle } from '@/components/admin/flash'
import { SubmitButton } from '@/components/ui'
import { formatCurrency } from '@/lib/price'
import { connectMercadoLivre, publishCandidate, rejectCandidate, restoreCandidate, runRadarNow } from '@/app/admin/actions'
import type { Json } from '@/types/supabase'

const PAGE_SIZE = 30

type Search = {
  status?: string
  marketplace?: string
  categoria?: string
  q?: string
  score?: string
  min?: string
  max?: string
  ordem?: string
  pagina?: string
  ok?: string
  erro?: string
}

const SORTS: Record<string, { column: string; ascending: boolean; label: string }> = {
  score: { column: 'score', ascending: false, label: 'Maior pontuação' },
  desconto: { column: 'discount_pct', ascending: false, label: 'Maior desconto' },
  'menor-preco': { column: 'price', ascending: true, label: 'Menor preço' },
  avaliacoes: { column: 'reviews_count', ascending: false, label: 'Mais avaliações' },
  recentes: { column: 'first_seen_at', ascending: false, label: 'Mais recentes' },
}

function breakdownText(breakdown: Json): string {
  if (!breakdown || typeof breakdown !== 'object' || Array.isArray(breakdown)) return ''
  return Object.entries(breakdown)
    .filter(([, value]) => typeof value === 'number' && value !== 0)
    .map(([key, value]) => `${key}: ${Math.round(value as number)}`)
    .join(' · ')
}

export default async function RadarPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams
  const status = (['pending', 'approved', 'rejected'].includes(params.status ?? '') ? params.status : 'pending') as
    | 'pending'
    | 'approved'
    | 'rejected'
  const sort = SORTS[params.ordem ?? ''] ? (params.ordem as string) : 'score'
  const page = Math.max(1, Number(params.pagina) || 1)

  const supabase = await createServerClient()
  const [{ data: categories }, { data: marketplaces }, { data: mlStatus }, { data: lastRun }] = await Promise.all([
    supabase.from('categories').select('id, name').order('name'),
    supabase.from('marketplaces').select('id, name').order('name'),
    supabase.rpc('integration_status', { p_provider: 'mercadolivre' }).maybeSingle(),
    supabase.from('radar_runs').select('*').order('started_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  let query = supabase
    .from('candidate_products')
    .select('*', { count: 'exact' })
    .eq('status', status)
    .eq('is_demo', false)
  if (params.marketplace) query = query.eq('marketplace_id', params.marketplace)
  if (params.categoria) query = query.eq('suggested_category_id', params.categoria)
  if (params.q) query = query.ilike('title', `%${params.q.replace(/[%_,()]/g, ' ').trim()}%`)
  if (Number(params.score)) query = query.gte('score', Number(params.score))
  if (Number(params.min)) query = query.gte('price', Number(params.min))
  if (Number(params.max)) query = query.lte('price', Number(params.max))
  const sortConfig = SORTS[sort]
  query = query
    .order(sortConfig.column, { ascending: sortConfig.ascending, nullsFirst: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  const { data: candidates, count, error } = await query
  const categoryName = new Map((categories ?? []).map((c) => [c.id, c.name]))
  const marketplaceName = new Map((marketplaces ?? []).map((m) => [m.id, m.name]))

  const currentQuery = new URLSearchParams(
    Object.entries({ ...params, ok: undefined, erro: undefined }).filter(([, v]) => v) as [string, string][]
  ).toString()
  const returnTo = `/admin/radar${currentQuery ? `?${currentQuery}` : ''}`
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))
  const pageLink = (target: number) => {
    const next = new URLSearchParams(currentQuery)
    next.set('pagina', String(target))
    return `/admin/radar?${next.toString()}`
  }

  return (
    <div className="space-y-5">
      <PageTitle title="Radar de Ofertas" description="Revise os produtos encontrados. Nada é publicado sem o seu link de afiliado.">
        <form action={runRadarNow}>
          <SubmitButton variant="secondary" pendingText="Coletando…">
            Executar coletor agora
          </SubmitButton>
        </form>
      </PageTitle>

      <Flash ok={params.ok} erro={params.erro ?? (error ? error.message : undefined)} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <div className="space-y-1">
          <p className="text-slate-800">
            Mercado Livre:{' '}
            {mlStatus?.connected ? (
              <strong className="text-brand-700">conectado</strong>
            ) : (
              <strong className="text-amber-700">não conectado</strong>
            )}
          </p>
          <p className="text-slate-500">
            Última coleta:{' '}
            {lastRun
              ? `${new Date(lastRun.started_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} — ${lastRun.status}${lastRun.message ? ` (${lastRun.message})` : ''}`
              : 'nunca'}
            . Coleta automática a cada 3 horas.
          </p>
        </div>
        <form action={connectMercadoLivre}>
          <SubmitButton variant="secondary" pendingText="Abrindo…">
            {mlStatus?.connected ? 'Reconectar Mercado Livre' : 'Conectar Mercado Livre'}
          </SubmitButton>
        </form>
      </div>

      <form method="get" className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">
          <span className="block font-medium text-slate-700">Status</span>
          <select name="status" defaultValue={status} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2">
            <option value="pending">Aguardando revisão</option>
            <option value="approved">Aprovados</option>
            <option value="rejected">Rejeitados</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block font-medium text-slate-700">Marketplace</span>
          <select name="marketplace" defaultValue={params.marketplace ?? ''} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2">
            <option value="">Todos</option>
            {(marketplaces ?? []).map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block font-medium text-slate-700">Categoria sugerida</span>
          <select name="categoria" defaultValue={params.categoria ?? ''} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2">
            <option value="">Todas</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block font-medium text-slate-700">Ordenar</span>
          <select name="ordem" defaultValue={sort} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2">
            {Object.entries(SORTS).map(([value, config]) => (
              <option key={value} value={value}>{config.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="block font-medium text-slate-700">Buscar no título</span>
          <input name="q" defaultValue={params.q ?? ''} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="block font-medium text-slate-700">Pontuação mínima</span>
          <input name="score" type="number" min={0} max={100} defaultValue={params.score ?? ''} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label>
            <span className="block font-medium text-slate-700">Preço mín.</span>
            <input name="min" type="number" min={0} defaultValue={params.min ?? ''} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2" />
          </label>
          <label>
            <span className="block font-medium text-slate-700">Preço máx.</span>
            <input name="max" type="number" min={0} defaultValue={params.max ?? ''} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2" />
          </label>
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
          <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Filtrar</button>
          <Link href="/admin/radar" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700">Limpar</Link>
        </div>
      </form>

      <p className="text-sm text-slate-600">{count ?? 0} candidatos</p>

      <ul className="space-y-4">
        {(candidates ?? []).map((candidate) => {
          const discount =
            candidate.original_price && candidate.original_price > candidate.price
              ? Math.round(((candidate.original_price - candidate.price) / candidate.original_price) * 100)
              : null
          return (
            <li key={candidate.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="grid gap-4 md:grid-cols-[7rem_1fr]">
                <div className="flex h-28 items-center justify-center rounded bg-white">
                  {candidate.image_url ? (
                    <Image src={candidate.image_url} alt="" width={112} height={112} className="max-h-28 w-auto object-contain" />
                  ) : (
                    <span className="text-xs text-slate-400">Sem imagem</span>
                  )}
                </div>
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="font-medium text-slate-950">{candidate.title}</h2>
                    <span className="rounded bg-slate-900 px-2 py-0.5 text-xs font-bold text-white" title={breakdownText(candidate.score_breakdown)}>
                      {Math.round(candidate.score)} pts
                    </span>
                  </div>
                  <p className="text-sm text-slate-700">
                    <strong className="text-base text-slate-950">{formatCurrency(candidate.price)}</strong>
                    {discount ? (
                      <span className="ml-2 text-slate-500">
                        <span className="line-through">{formatCurrency(candidate.original_price as number)}</span>{' '}
                        <span className="font-semibold text-red-600">-{discount}%</span>
                      </span>
                    ) : null}
                    {candidate.free_shipping ? <span className="ml-2 text-brand-700">Frete grátis</span> : null}
                  </p>
                  <p className="text-xs text-slate-500">
                    {marketplaceName.get(candidate.marketplace_id)} · busca “{candidate.search_term}” · visto {candidate.times_seen}x ·{' '}
                    {candidate.rating !== null ? `nota ${candidate.rating} (${candidate.reviews_count ?? 0}) · ` : ''}
                    {candidate.sold_quantity ? `${candidate.sold_quantity} vendidos · ` : ''}
                    {breakdownText(candidate.score_breakdown)}
                  </p>
                  <a
                    href={candidate.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
                  >
                    Abrir página original para gerar seu link <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>

                  {candidate.status === 'pending' ? (
                    <div className="grid gap-3 pt-2 lg:grid-cols-[1fr_auto]">
                      <form action={publishCandidate} className="grid gap-2 sm:grid-cols-2">
                        <input type="hidden" name="candidate_id" value={candidate.id} />
                        <input type="hidden" name="return_to" value={returnTo} />
                        <input
                          name="affiliate_url"
                          type="url"
                          required
                          placeholder="Cole aqui o SEU link de afiliado (https://…)"
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
                        />
                        <select
                          name="category_id"
                          required
                          defaultValue={candidate.suggested_category_id ?? ''}
                          className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
                        >
                          <option value="">Categoria…</option>
                          {(categories ?? []).map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <input
                          name="name"
                          defaultValue={candidate.title}
                          maxLength={200}
                          aria-label="Nome exibido no site"
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                        <SubmitButton className="sm:col-span-2" pendingText="Publicando…">
                          Aprovar e publicar
                        </SubmitButton>
                      </form>
                      <form action={rejectCandidate} className="flex flex-col gap-2 lg:w-56">
                        <input type="hidden" name="candidate_id" value={candidate.id} />
                        <input type="hidden" name="return_to" value={returnTo} />
                        <input name="reason" placeholder="Motivo (opcional)" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
                        <SubmitButton variant="secondary" pendingText="Rejeitando…">
                          Rejeitar
                        </SubmitButton>
                      </form>
                    </div>
                  ) : null}

                  {candidate.status === 'approved' && candidate.product_id ? (
                    <p className="text-sm text-slate-700">
                      Publicado {candidate.publish_mode === 'auto' ? 'automaticamente' : 'manualmente'} ·{' '}
                      <Link href={`/admin/produtos/${candidate.product_id}`} className="font-medium text-brand-700 hover:underline">
                        editar produto
                      </Link>
                    </p>
                  ) : null}

                  {candidate.status === 'rejected' ? (
                    <form action={restoreCandidate} className="flex items-center gap-3 text-sm text-slate-600">
                      <input type="hidden" name="candidate_id" value={candidate.id} />
                      <input type="hidden" name="return_to" value={returnTo} />
                      <span>Rejeitado{candidate.rejection_reason ? `: ${candidate.rejection_reason}` : ''}</span>
                      <SubmitButton variant="secondary" pendingText="…">Voltar para a fila</SubmitButton>
                    </form>
                  ) : null}

                  {candidate.suggested_category_id ? (
                    <p className="text-xs text-slate-400">Categoria sugerida: {categoryName.get(candidate.suggested_category_id)}</p>
                  ) : null}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {!candidates?.length ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
          Nenhum candidato com esses filtros.
        </p>
      ) : null}

      {totalPages > 1 ? (
        <nav aria-label="Paginação" className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={pageLink(page - 1)} className="text-brand-700 hover:underline">← Anterior</Link> : <span />}
          <span className="text-slate-500">Página {page} de {totalPages}</span>
          {page < totalPages ? <Link href={pageLink(page + 1)} className="text-brand-700 hover:underline">Próxima →</Link> : <span />}
        </nav>
      ) : null}
    </div>
  )
}
