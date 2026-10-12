import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { PageTitle } from '@/components/admin/flash'
import { formatCurrency } from '@/lib/price'

function Stat({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const body = (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  )
  return href ? <Link href={href} className="block hover:opacity-90">{body}</Link> : body
}

export default async function AdminDashboard() {
  const supabase = await createServerClient()
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()

  const count = (query: PromiseLike<{ count: number | null }>) => query.then((result) => result.count ?? 0)

  const [products, categories, marketplaces, foundToday, pending, approved, rejected, clicksWeek, topScore, pendingWithDiscount, runs] =
    await Promise.all([
      count(supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'active')),
      count(supabase.from('categories').select('*', { count: 'exact', head: true })),
      count(supabase.from('marketplaces').select('*', { count: 'exact', head: true })),
      count(supabase.from('candidate_products').select('*', { count: 'exact', head: true }).gte('first_seen_at', startOfDay.toISOString())),
      count(supabase.from('candidate_products').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
      count(supabase.from('candidate_products').select('*', { count: 'exact', head: true }).eq('status', 'approved')),
      count(supabase.from('candidate_products').select('*', { count: 'exact', head: true }).eq('status', 'rejected')),
      count(supabase.from('clicks').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo)),
      supabase.from('candidate_products').select('title, score').eq('status', 'pending').order('score', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('candidate_products').select('title, price, original_price').eq('status', 'pending').not('original_price', 'is', null).limit(500),
      supabase.from('radar_runs').select('*').order('started_at', { ascending: false }).limit(5),
    ])

  const biggestDiscount = (pendingWithDiscount.data ?? [])
    .map((row) => ({ ...row, pct: row.original_price && row.original_price > row.price ? Math.round(((row.original_price - row.price) / row.original_price) * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct)[0]

  return (
    <div className="space-y-6">
      <PageTitle title="Painel" description="Números reais do banco de dados." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Produtos publicados" value={products} href="/admin/produtos" />
        <Stat label="Categorias" value={categories} href="/admin/categorias" />
        <Stat label="Marketplaces" value={marketplaces} href="/admin/marketplaces" />
        <Stat label="Cliques (7 dias)" value={clicksWeek} />
        <Stat label="Encontrados hoje" value={foundToday} href="/admin/radar" />
        <Stat label="Aguardando revisão" value={pending} href="/admin/radar" />
        <Stat label="Aprovados" value={approved} href="/admin/radar?status=approved" />
        <Stat label="Rejeitados" value={rejected} href="/admin/radar?status=rejected" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Maior pontuação na fila</p>
          {topScore.data ? (
            <p className="mt-1 text-sm text-slate-900">
              <strong>{Math.round(topScore.data.score)}</strong> — {topScore.data.title}
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-500">Fila vazia.</p>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Maior desconto na fila</p>
          {biggestDiscount && biggestDiscount.pct > 0 ? (
            <p className="mt-1 text-sm text-slate-900">
              <strong>{biggestDiscount.pct}%</strong> — {biggestDiscount.title} ({formatCurrency(biggestDiscount.price)})
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-500">Nenhum candidato com preço anterior informado.</p>
          )}
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Últimas execuções do coletor</h2>
        {runs.data?.length ? (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-1 pr-3">Início</th>
                <th className="py-1 pr-3">Origem</th>
                <th className="py-1 pr-3">Status</th>
                <th className="py-1 pr-3">Lidos</th>
                <th className="py-1">Salvos</th>
              </tr>
            </thead>
            <tbody>
              {runs.data.map((run) => (
                <tr key={run.id} className="border-t border-slate-100">
                  <td className="py-1.5 pr-3">{new Date(run.started_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                  <td className="py-1.5 pr-3">{run.trigger}</td>
                  <td className="py-1.5 pr-3" title={run.message ?? undefined}>{run.status}</td>
                  <td className="py-1.5 pr-3">{run.fetched_count}</td>
                  <td className="py-1.5">{run.upserted_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-2 text-sm text-slate-500">O coletor ainda não rodou.</p>
        )}
      </section>
    </div>
  )
}
