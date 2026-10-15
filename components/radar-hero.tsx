import Image from 'next/image'
import Link from 'next/link'
import type { Product } from '@/types'
import { formatCurrency } from '@/lib/price'

// Posição de cada sinal no radar (ângulo em graus a partir do topo, distância do centro em % do raio).
const BLIPS = [
  { angle: 38, distance: 0.62 },
  { angle: 128, distance: 0.42 },
  { angle: 205, distance: 0.74 },
  { angle: 262, distance: 0.5 },
  { angle: 322, distance: 0.8 },
]

function polar(angle: number, distance: number) {
  const radians = ((angle - 90) * Math.PI) / 180
  return { left: `${50 + Math.cos(radians) * distance * 50}%`, top: `${50 + Math.sin(radians) * distance * 50}%` }
}

const timeFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

/**
 * Abertura da home: o radar mostra as maiores quedas de preço reais como sinais,
 * e o painel ao lado lista as mesmas ofertas. Sem ofertas, mostra só a busca.
 */
export function RadarHero({ deals, totalOffers, checkedAt }: { deals: Product[]; totalOffers: number; checkedAt: string | null }) {
  const signals = deals.slice(0, BLIPS.length)
  const checked = checkedAt ? timeFormat.format(new Date(checkedAt)) : null

  return (
    <section className="console-grid relative overflow-hidden bg-night text-white">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14 lg:px-8 lg:pb-20 lg:pt-14">
        <div>
          <h1 className="font-display text-[1.9rem] font-bold leading-[1.1] tracking-tight sm:text-[2.6rem] xl:text-[3rem]">
            O radar que encontra o preço certo.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/75 sm:text-lg">
            Conferimos os preços das lojas várias vezes ao dia e só mostramos desconto quando a loja informa um preço anterior maior que o
            atual.
          </p>

          <form action="/buscar" method="get" role="search" className="mt-8 flex max-w-xl gap-2">
            <label htmlFor="busca-home" className="sr-only">
              Buscar ofertas
            </label>
            <input
              id="busca-home"
              name="q"
              type="search"
              placeholder="Air fryer, notebook, fone bluetooth…"
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white px-4 py-3.5 text-base text-night placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-scan/40"
            />
            <button type="submit" className="rounded-lg bg-brand-600 px-5 py-3.5 text-base font-semibold text-white hover:bg-brand-500">
              Buscar
            </button>
          </form>

          {totalOffers ? (
            <p className="mt-6 flex items-center gap-2.5 text-sm text-white/65">
              <span className="relative flex h-2.5 w-2.5" aria-hidden>
                <span className="motion-safe-only absolute inline-flex h-full w-full animate-ping rounded-full bg-scan opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-scan" />
              </span>
              {totalOffers} ofertas no radar agora{checked ? `, preços conferidos às ${checked}` : ''}.
            </p>
          ) : null}
        </div>

        {signals.length ? (
          <div className="grid min-w-0 items-center gap-6 sm:grid-cols-[13rem_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)]">
            <div className="relative mx-auto aspect-square w-full max-w-[12rem] sm:max-w-[15rem]" role="img" aria-label="Radar com as maiores quedas de preço de agora">
              <div className="absolute inset-0 rounded-full border border-scan/25 bg-[radial-gradient(circle,rgba(35,64,255,0.35),rgba(11,22,64,0)_70%)]" />
              <div className="absolute inset-[18%] rounded-full border border-scan/20" />
              <div className="absolute inset-[36%] rounded-full border border-scan/15" />
              <div className="absolute left-1/2 top-0 h-full w-px bg-scan/10" />
              <div className="absolute left-0 top-1/2 h-px w-full bg-scan/10" />
              <div
                className="motion-safe-only absolute inset-0 animate-sweep rounded-full bg-[conic-gradient(from_0deg,rgba(124,244,255,0.45),rgba(124,244,255,0)_70deg,transparent_360deg)]"
                aria-hidden
              />
              {signals.map((deal, index) => {
                const position = polar(BLIPS[index].angle, BLIPS[index].distance)
                return (
                  <Link
                    key={deal.id}
                    href={`/produto/${deal.slug}`}
                    style={position}
                    className="group absolute -translate-x-1/2 -translate-y-1/2"
                    aria-label={`${deal.name}: ${deal.discount_percentage}% de desconto`}
                  >
                    <span
                      className="motion-safe-only absolute inset-0 animate-blip rounded-full bg-signal"
                      style={{ animationDelay: `${index * 0.45}s` }}
                      aria-hidden
                    />
                    <span className="relative block h-3 w-3 rounded-full bg-signal ring-2 ring-night transition group-hover:scale-125" />
                  </Link>
                )
              })}
            </div>

            <ul className="min-w-0 divide-y divide-white/10 rounded-xl border border-white/10 bg-white/[0.04]">
              {signals.map((deal) => (
                <li key={deal.id}>
                  <Link href={`/produto/${deal.slug}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.06]">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white p-1">
                      {deal.image_url ? (
                        <Image src={deal.image_url} alt="" width={44} height={44} className="max-h-full w-auto object-contain" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-white/85">{deal.name}</span>
                      <span className="tabular block font-display text-sm font-medium text-white">{formatCurrency(deal.current_price)}</span>
                    </span>
                    <span className="tabular shrink-0 rounded-md bg-signal px-2 py-1 font-display text-xs font-bold text-white">
                      −{deal.discount_percentage}%
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  )
}
