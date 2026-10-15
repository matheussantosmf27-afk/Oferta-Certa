import { AlertTriangle, BadgeCheck, Info, ShieldCheck, Store } from 'lucide-react'
import { formatCurrency } from '@/lib/price'
import { priceInsight, type PriceVerdict } from '@/lib/price-insight'
import type { ProductInsights } from '@/services/catalog'

const VERDICT_STYLE: Record<PriceVerdict, string> = {
  otimo: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  bom: 'bg-brand-50 text-brand-800 ring-brand-200',
  na_media: 'bg-surface-100 text-slate-800 ring-surface-300',
  acima: 'bg-amber-50 text-amber-900 ring-amber-200',
}

const POWER_SELLER: Record<string, string> = { platinum: 'MercadoLíder Platinum', gold: 'MercadoLíder Gold', silver: 'MercadoLíder' }
// Termômetro de reputação do Mercado Livre: vermelho (1) a verde (5).
const LEVEL_COLORS = ['bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-lime-500', 'bg-emerald-600']

const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

function headline(verdict: PriceVerdict, vsMedian: number, offers: number, isLowest: boolean): string {
  if (isLowest && verdict !== 'na_media' && verdict !== 'acima') return `Menor preço entre ${offers} vendedores, ${Math.abs(vsMedian)}% abaixo da média`
  if (verdict === 'otimo' || verdict === 'bom') return `${Math.abs(vsMedian)}% abaixo da média de ${offers} vendedores`
  if (verdict === 'na_media') return `Preço na média dos ${offers} vendedores`
  return `${vsMedian}% acima da média de ${offers} vendedores`
}

/**
 * Raio-X do preço: o preço mostrado contra o de todos os vendedores do mesmo produto,
 * a checagem do desconto e a reputação do vendedor. Tudo vem da API oficial da loja e das coletas do site.
 */
export function PriceXray({
  price,
  oldPrice,
  marketplaceName,
  insights,
  history,
}: {
  price: number
  oldPrice: number | null
  marketplaceName: string
  insights: ProductInsights | null
  history: { price: number; recorded_at: string }[]
}) {
  const market = insights?.market ?? null
  const seller = insights?.seller ?? null
  if (!market && !seller) return null
  const insight = priceInsight({ price, oldPrice, market, history })
  const showRange = market && market.offers >= 2 && market.max > market.min
  const position = (value: number) => (market ? Math.min(100, Math.max(0, ((value - market.min) / (market.max - market.min || 1)) * 100)) : 0)

  return (
    <section className="rounded-xl border border-surface-300 bg-white p-6" aria-labelledby="raio-x">
      <h2 id="raio-x" className="font-display text-lg font-bold tracking-tight text-night">
        Raio-X do preço
      </h2>

      {market && insight.verdict && insight.vsMedianPct !== null ? (
        <p className={`mt-4 inline-flex rounded-lg px-3 py-2 text-sm font-semibold ring-1 ${VERDICT_STYLE[insight.verdict]}`}>
          {headline(insight.verdict, insight.vsMedianPct, market.offers, insight.isLowest)}
        </p>
      ) : market ? (
        <p className="mt-4 text-sm text-slate-600">Só um vendedor oferece este produto agora no {marketplaceName}.</p>
      ) : null}

      {showRange && market ? (
        <div className="mt-5">
          <div className="relative h-2 rounded-full bg-gradient-to-r from-emerald-300 via-surface-300 to-amber-300" aria-hidden>
            <span className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-slate-500" style={{ left: `${position(market.median)}%` }} />
            <span
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-night shadow"
              style={{ left: `${position(price)}%` }}
            />
          </div>
          <dl className="tabular mt-3 grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="text-slate-500">Menor</dt>
              <dd className="font-semibold text-slate-900">{formatCurrency(market.min)}</dd>
            </div>
            <div className="text-center">
              <dt className="text-slate-500">Mediana</dt>
              <dd className="font-semibold text-slate-900">{formatCurrency(market.median)}</dd>
            </div>
            <div className="text-right">
              <dt className="text-slate-500">Maior</dt>
              <dd className="font-semibold text-slate-900">{formatCurrency(market.max)}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {insight.discountCheck !== 'sem_desconto' && oldPrice ? (
        <p className="mt-5 flex gap-2 text-sm leading-6 text-slate-700">
          {insight.discountCheck === 'confirmado' ? (
            <>
              <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
              <span>
                <strong className="font-semibold text-slate-900">Desconto confirmado.</strong> Nas nossas coletas, o preço já esteve perto de{' '}
                {formatCurrency(oldPrice)}.
              </span>
            </>
          ) : insight.discountCheck === 'acima_do_mercado' && market ? (
            <>
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
              <span>
                <strong className="font-semibold text-slate-900">Desconto pode estar inflado.</strong> O preço anterior informado (
                {formatCurrency(oldPrice)}) está acima do que qualquer vendedor cobra hoje (até {formatCurrency(market.max)}).
              </span>
            </>
          ) : (
            <>
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
              <span>Preço anterior informado pela loja. Vamos confirmá-lo com o nosso histórico nos próximos dias.</span>
            </>
          )}
        </p>
      ) : null}

      {seller || insights?.official_store || insights?.warranty ? (
        <div className="mt-5 border-t border-surface-200 pt-5">
          <h3 className="text-sm font-semibold text-slate-900">Quem vende pelo menor preço</h3>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-700">
            {seller?.name ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-900">
                <Store className="h-4 w-4 text-slate-500" aria-hidden />
                {seller.name}
              </span>
            ) : null}
            {seller?.level ? (
              <span className="inline-flex items-center gap-1" aria-label={`Reputação ${seller.level} de 5 no ${marketplaceName}`}>
                {LEVEL_COLORS.map((color, index) => (
                  <span key={color} className={`h-2 w-5 rounded-sm ${index + 1 === seller.level ? color : 'bg-surface-300'}`} aria-hidden />
                ))}
              </span>
            ) : null}
            {seller?.power_seller ? <span>{POWER_SELLER[seller.power_seller] ?? seller.power_seller}</span> : null}
            {seller?.sales ? <span className="tabular">{compact.format(seller.sales)} vendas</span> : null}
            {insights?.official_store ? (
              <span className="inline-flex items-center gap-1 text-brand-700">
                <ShieldCheck className="h-4 w-4" aria-hidden /> Loja oficial
              </span>
            ) : null}
          </div>
          {insights?.warranty ? <p className="mt-2 text-xs text-slate-500">{insights.warranty}</p> : null}
        </div>
      ) : null}

      <p className="mt-5 text-xs leading-5 text-slate-500">
        Dados públicos do {marketplaceName}, atualizados a cada coleta. As avaliações dos compradores ficam na página do produto na loja.
      </p>
    </section>
  )
}
