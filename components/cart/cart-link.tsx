'use client'

import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { cartCount } from '@/lib/cart'
import { useCart } from '@/lib/use-cart'

export function CartLink({ withLabel = false }: { withLabel?: boolean }) {
  const count = cartCount(useCart())
  return (
    <Link
      href="/carrinho"
      aria-label={count ? `Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho'}
      className="relative inline-flex items-center gap-1.5 rounded-md p-2 text-sm font-medium text-slate-700 hover:text-slate-950"
    >
      <ShoppingCart className="h-5 w-5" aria-hidden />
      {withLabel ? <span>Carrinho</span> : null}
      {count ? (
        <span className="absolute -right-1 -top-1 min-w-[1.25rem] rounded-full bg-brand-600 px-1 text-center text-xs font-bold leading-5 text-white">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  )
}
