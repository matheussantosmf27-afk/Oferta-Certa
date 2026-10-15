import type { Metadata } from 'next'
import { ProductGrid } from '@/components/product-card'
import { EmptyState } from '@/components/empty-state'
import { listProducts } from '@/services/catalog'

export const metadata: Metadata = {
  title: 'Ofertas do dia',
  description: 'Os maiores descontos do momento, só quando o preço anterior foi confirmado pelo nosso histórico ou pelo preço dos outros vendedores.',
  alternates: { canonical: '/ofertas' },
}

export default async function DealsPage() {
  const products = await listProducts({ sort: 'maior-desconto', withDiscountOnly: true, limit: 60 })
  return (
    <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <h1 className="font-display text-2xl font-bold tracking-tight text-night">Ofertas do dia</h1>
      <p className="mt-1 text-sm text-slate-600">Ordenadas pelo maior desconto. Só entram descontos confirmados pelo nosso histórico ou compatíveis com o preço dos outros vendedores.</p>
      <div className="mt-6">
        {products.length ? (
          <ProductGrid products={products} />
        ) : (
          <EmptyState title="Sem descontos publicados agora" description="Assim que conferirmos novas ofertas com desconto, elas aparecem aqui." />
        )}
      </div>
    </div>
  )
}
