'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Check, ShoppingCart } from 'lucide-react'
import { addToCart, updateCart } from '@/lib/cart'
import { useCart } from '@/lib/use-cart'

/** `full`: botão largo da página do produto. `compact`: ícone nos cards. */
export function AddToCartButton({ productId, variant = 'full' }: { productId: string; variant?: 'full' | 'compact' }) {
  const cart = useCart()
  const [justAdded, setJustAdded] = useState(false)
  const inCart = cart.some((item) => item.productId === productId)

  const add = () => {
    updateCart((items) => addToCart(items, productId))
    setJustAdded(true)
    window.setTimeout(() => setJustAdded(false), 2000)
  }

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={add}
        aria-label={inCart ? 'Adicionar mais uma unidade ao carrinho' : 'Adicionar ao carrinho'}
        title="Adicionar ao carrinho"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-brand-200 bg-brand-50 text-brand-700 transition hover:bg-brand-100"
      >
        {justAdded ? <Check className="h-4 w-4" aria-hidden /> : <ShoppingCart className="h-4 w-4" aria-hidden />}
      </button>
    )
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={add}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-brand-600 bg-white px-5 py-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
      >
        {justAdded ? <Check className="h-4 w-4" aria-hidden /> : <ShoppingCart className="h-4 w-4" aria-hidden />}
        {justAdded ? 'Adicionado ao carrinho' : 'Adicionar ao carrinho'}
      </button>
      {inCart ? (
        <p className="text-center text-xs text-slate-600" aria-live="polite">
          No seu carrinho ·{' '}
          <Link href="/carrinho" className="font-medium text-brand-700 hover:underline">
            ver carrinho
          </Link>
        </p>
      ) : null}
    </div>
  )
}
