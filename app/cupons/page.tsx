import type { Metadata } from 'next'
import { SectionHeading } from '@/components/section-heading'
import { EmptyState } from '@/components/empty-state'
import { getActiveCoupons } from '@/services/catalog'
import { formatCurrency } from '@/lib/price'

// Página pública em cache, renovada a cada 5 minutos (preços mudam a cada coleta).
export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const coupons = await getActiveCoupons()
  return {
    title: 'Cupons de desconto',
    description: 'Cupons ativos das lojas parceiras para economizar ainda mais nas ofertas.',
    alternates: { canonical: '/cupons' },
    // Página vazia não deve ser indexada (conteúdo raso prejudica o site no Google).
    robots: coupons.length ? undefined : { index: false, follow: true },
  }
}

export default async function CouponsPage() {
  const coupons = await getActiveCoupons()

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-8">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft sm:p-10">
        <SectionHeading as="h1" title="Cupons" description="Encontre cupons ativos e economize ainda mais." />
      </div>

      <div className="mt-8 space-y-4">
        {coupons.length ? (
          coupons.map((coupon) => (
            <article key={coupon.id} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.35em] text-brand-700">{coupon.marketplace}</p>
                  <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-night">{coupon.title}</h2>
                </div>
                <div className="rounded-full bg-brand-100 px-4 py-2 text-sm font-semibold text-brand-700">{coupon.code}</div>
              </div>
              <p className="mt-4 text-sm text-slate-600">{coupon.description}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="font-semibold">Desconto</p>
                  <p>{coupon.discount_type === 'percent' ? `${coupon.discount_value}%` : formatCurrency(coupon.discount_value)}</p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="font-semibold">Validade</p>
                  <p>{new Date(coupon.valid_until).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            </article>
          ))
        ) : (
          <EmptyState title="Sem cupons ativos" description="No momento não há cupons ativos para exibir." />
        )}
      </div>
    </div>
  )
}
