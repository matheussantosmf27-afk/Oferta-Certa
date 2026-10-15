'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ExternalLink, ShieldCheck, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { formatCurrency } from '@/lib/price'
import {
  CART_MAX_QUANTITY,
  cartCount,
  cartTotal,
  keepAvailable,
  markSentToCheckout,
  nextToCheckout,
  removeFromCart,
  setCartQuantity,
  updateCart,
} from '@/lib/cart'
import { useCart } from '@/lib/use-cart'
import type { Product } from '@/types'

const checkoutHref = (productId: string) => `/go/${productId}?utm_source=site&utm_medium=carrinho`

export function CartView() {
  const cart = useCart()
  const [products, setProducts] = useState<Map<string, Product> | null>(null)
  const [failed, setFailed] = useState(false)
  const idsKey = cart.map((item) => item.productId).sort().join(',')

  useEffect(() => {
    if (!idsKey) {
      setProducts(new Map())
      return
    }
    let active = true
    setFailed(false)
    fetch(`/api/public/products?ids=${idsKey}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((body: { products: Product[] }) => {
        if (!active) return
        const found = new Map(body.products.map((product) => [product.id, product]))
        setProducts(found)
        // Ofertas que saíram do site não podem ser compradas: tira do carrinho.
        updateCart((items) => keepAvailable(items, found.keys()))
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [idsKey])

  const prices = useMemo(() => new Map([...(products ?? new Map()).values()].map((p: Product) => [p.id, p.current_price])), [products])
  const rows = cart.filter((item) => products?.has(item.productId))
  const next = nextToCheckout(rows)
  const done = rows.filter((item) => item.sentToCheckout).length

  if (failed) {
    return (
      <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
        Não foi possível carregar os produtos do carrinho. Seus itens continuam salvos; recarregue a página em instantes.
      </p>
    )
  }
  if (products === null) return <p className="text-sm text-slate-500">Carregando carrinho…</p>
  if (!rows.length) {
    return (
      <EmptyState
        title="Seu carrinho está vazio"
        description="Adicione ofertas ao carrinho para comparar e finalizar as compras nas lojas."
        action={
          <Link href="/ofertas" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Ver ofertas
          </Link>
        }
      />
    )
  }

  const goToCheckout = (productId: string) => updateCart((items) => markSentToCheckout(items, productId))

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <ul className="space-y-3">
        {rows.map((item) => {
          const product = products.get(item.productId) as Product
          return (
            <li key={item.productId} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:gap-4 sm:p-4">
              <Link href={`/produto/${product.slug}`} className="flex h-20 w-20 shrink-0 items-center justify-center sm:h-24 sm:w-24">
                {product.image_url ? (
                  <Image src={product.image_url} alt="" width={96} height={96} className="max-h-full w-auto object-contain" />
                ) : (
                  <span className="text-xs text-slate-400">Sem imagem</span>
                )}
              </Link>
              <div className="min-w-0 flex-1 space-y-2">
                <Link href={`/produto/${product.slug}`} className="line-clamp-2 text-sm font-medium text-slate-900 hover:text-brand-700">
                  {product.name}
                </Link>
                <p className="text-base font-bold text-slate-950">
                  {formatCurrency(product.current_price)}
                  {product.free_shipping ? <span className="ml-2 text-xs font-medium text-brand-700">Frete grátis</span> : null}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs text-slate-600">
                    <span className="sr-only">Quantidade</span>
                    <select
                      value={item.quantity}
                      onChange={(event) => updateCart((items) => setCartQuantity(items, item.productId, Number(event.target.value)))}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                    >
                      {Array.from({ length: CART_MAX_QUANTITY }, (_, index) => index + 1).map((value) => (
                        <option key={value} value={value}>
                          {value} {value === 1 ? 'unidade' : 'unidades'}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => updateCart((items) => removeFromCart(items, item.productId))}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remover
                  </button>
                </div>
                <a
                  href={checkoutHref(item.productId)}
                  target="_blank"
                  rel="nofollow sponsored noopener"
                  onClick={() => goToCheckout(item.productId)}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold sm:w-auto ${
                    item.sentToCheckout ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50' : 'bg-brand-600 text-white hover:bg-brand-700'
                  }`}
                >
                  {item.sentToCheckout ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-brand-600" aria-hidden /> Aberto no {product.marketplace_name} · abrir de novo
                    </>
                  ) : (
                    <>
                      Finalizar este item <ExternalLink className="h-4 w-4" aria-hidden />
                    </>
                  )}
                </a>
                {item.quantity > 1 ? (
                  <p className="text-xs text-slate-500">Escolha {item.quantity} unidades na página da loja antes de pagar.</p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>

      <aside className="h-fit space-y-4 rounded-lg border border-slate-200 bg-white p-5 lg:sticky lg:top-4">
        <h2 className="text-lg font-semibold text-slate-950">Resumo</h2>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-600">Itens</dt>
            <dd className="text-slate-900">{cartCount(rows)}</dd>
          </div>
          <div className="flex justify-between text-base">
            <dt className="font-medium text-slate-900">Total estimado</dt>
            <dd className="font-bold text-slate-950">{formatCurrency(cartTotal(rows, prices))}</dd>
          </div>
        </dl>
        <p className="text-xs text-slate-500">Preços conferidos pelo Oferta Certa. Frete, estoque e valor final são confirmados por cada loja.</p>

        {next ? (
          <a
            href={checkoutHref(next.productId)}
            target="_blank"
            rel="nofollow sponsored noopener"
            onClick={() => goToCheckout(next.productId)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {rows.length > 1 ? `Finalizar compra (${done + 1} de ${rows.length})` : 'Finalizar compra'}
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        ) : (
          <p className="rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-800">
            Todos os itens foram abertos nas lojas. Conclua o pagamento por lá.
          </p>
        )}

        <div className="flex gap-2 rounded-md bg-surface-100 p-3 text-xs leading-5 text-slate-600">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
          <p>
            O pagamento e a entrega são feitos pela loja de cada produto (Mercado Livre, Shopee, AliExpress ou Amazon), com a proteção de compra
            dela. Cada produto abre na página do vendedor para você concluir. O Oferta Certa não recebe seu pagamento nem dados de cartão.
          </p>
        </div>
      </aside>
    </div>
  )
}
