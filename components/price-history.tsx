import { formatCurrency, summarizePriceHistory, type PricePoint } from '@/lib/price'

const WIDTH = 320
const HEIGHT = 72

/** Histórico de preço registrado pelo Oferta Certa, com aviso quando ainda há poucos dados. */
export function PriceHistory({ history }: { history: PricePoint[] }) {
  const summary = summarizePriceHistory(history)
  if (!summary) return null
  const { points, min, max, fewData, days } = summary
  const range = max - min || 1
  const step = points.length > 1 ? WIDTH / (points.length - 1) : 0
  const coords = points.map((point, index) => {
    const x = points.length > 1 ? index * step : WIDTH / 2
    const y = HEIGHT - 6 - ((point.price - min) / range) * (HEIGHT - 12)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const date = (value: string) => new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  return (
    <section className="rounded-xl border border-surface-300 bg-white p-6" aria-labelledby="historico-preco">
      <h2 id="historico-preco" className="font-display text-lg font-bold tracking-tight text-night">Histórico de preço</h2>
      {points.length > 1 ? (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mt-4 h-20 w-full" role="img" aria-label="Gráfico da variação de preço">
          <polyline points={coords.join(' ')} fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-600" />
        </svg>
      ) : null}
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-slate-500">Menor preço registrado</dt>
          <dd className="tabular font-semibold text-slate-950">{formatCurrency(min)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Maior preço registrado</dt>
          <dd className="tabular font-semibold text-slate-950">{formatCurrency(max)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Acompanhando desde</dt>
          <dd className="tabular font-semibold text-slate-950">{date(points[0].recorded_at)}</dd>
        </div>
      </dl>
      {fewData ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Ainda temos poucos dados ({points.length} {points.length === 1 ? 'registro' : 'registros'} em {days}{' '}
          {days === 1 ? 'dia' : 'dias'}). O histórico fica mais confiável com o tempo.
        </p>
      ) : null}
    </section>
  )
}
