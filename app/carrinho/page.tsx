import type { Metadata } from 'next'
import { CartView } from '@/components/cart/cart-view'

export const metadata: Metadata = {
  title: 'Carrinho',
  robots: { index: false, follow: false },
}

export default function CartPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Carrinho</h1>
        <p className="mt-1 text-sm text-slate-600">Junte as ofertas que você quer e finalize cada uma na loja de origem, com pagamento e entrega por lá.</p>
      </div>
      <CartView />
    </div>
  )
}
