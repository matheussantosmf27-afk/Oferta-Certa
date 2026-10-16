import { formatCurrency, summarizePriceHistory, type PricePoint } from '@/lib/price'

const WIDTH = 320
const HEIGHT = 72
const date = (value: string) => new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

/**
 * Histórico de preço observado pelo Oferta Certa (não é o "preço anterior" informado pela loja).
 * Com poucos dados, não tira conclusões: mostra só o que foi registrado e avisa a limitação.
 */
export function PriceHistory({ history }: { history: PricePoint[] }) {
  const summary = summarizePriceHistory(history)
  if (!summary) return null
  const { points, min, max, fewData, spanDays } = summary
  const single = points.length === 1
  const range = max - min || 1
  const step = points.length > 1 ? WIDTH / (points.length - 1) : 0
  const coords = points.map((point, index) => {
    const x = points.length > 1 ? index * step : WIDTH / 2
    const y = HEIGHT - 6 - ((point.price - min) / range) * (HEIGHT - 12)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  return (
    <section className="rounded-xl border border-surface-300 bg-white p-6" aria-labelledby="historico-preco">
      <h2 id="historico-preco" className="font-display text-lg font-bold tracking-tight text-night">
        Histórico de preço
      </h2>
      <p className="mt-1 text-xs text-slate-500">Preços que o Oferta Certa registrou ao conferir a loja.</p>

      {points.length > 1 ? (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mt-4 h-20 w-full" role="img" aria-label="Gráfico da variação de preço registrada">
          <polyline points={coords.join(' ')} fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-600" />
        </svg>
      ) : null}

      {single ? (
        <dl className="mt-4 text-sm">
          <dt className="text-slate-500">Único preço registrado</dt>
          <dd className="tabular font-semibold text-slate-950">
            {formatCurrency(points[0].price)} em {date(points[0].recorded_at)}
          </dd>
        </dl>
      ) : (
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">{fewData ? 'Menor entre os registros' : 'Menor preço registrado'}</dt>
            <dd className="tabular font-semibold text-slate-950">{formatCurrency(min)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{fewData ? 'Maior entre os registros' : 'Maior preço registrado'}</dt>
            <dd className="tabular font-semibold text-slate-950">{formatCurrency(max)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Acompanhando desde</dt>
            <dd className="tabular font-semibold text-slate-950">{date(points[0].recorded_at)}</dd>
          </div>
        </dl>
      )}

      {fewData ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          {single
            ? 'Só temos um registro deste produto até agora, então ainda não dá para dizer se o preço subiu ou caiu.'
            : `Ainda temos poucos dados (${points.length} registros em ${spanDays} ${spanDays === 1 ? 'dia' : 'dias'}). Não use estes valores como menor ou maior preço do produto.`}
        </p>
      ) : null}
    </section>
  )
}
