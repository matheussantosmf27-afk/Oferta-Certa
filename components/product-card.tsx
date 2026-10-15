import Image from 'next/image'
import Link from 'next/link'
import { Truck } from 'lucide-react'
import type { Product } from '@/types'
import { formatCurrency } from '@/lib/price'
import { AddToCartButton } from '@/components/cart/add-to-cart-button'

export function ProductCard({ product }: { product: Product }) {
  const discount = product.discount_percentage && product.discount_percentage > 0 ? product.discount_percentage : null

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-surface-300 bg-white transition hover:border-brand-500 hover:shadow-card">
      <Link href={`/produto/${product.slug}`} className="relative block bg-white p-4">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            width={400}
            height={300}
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
            className="mx-auto h-40 w-full object-contain"
          />
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-slate-400">Sem imagem</div>
        )}
        {discount ? (
          <span className="tabular absolute left-3 top-3 rounded-md bg-signal px-2 py-1 font-display text-xs font-bold leading-none text-white">−{discount}%</span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col border-t border-surface-200 p-3.5">
        <p className="text-xs font-medium text-slate-500">{product.marketplace_name}</p>
        <h3 className="mt-1 line-clamp-2 text-sm font-medium text-slate-900">
          <Link href={`/produto/${product.slug}`} className="hover:text-brand-700">
            {product.name}
          </Link>
        </h3>

        <div className="mt-auto pt-3">
          {product.old_price && discount ? (
            <p className="tabular text-xs text-slate-500 line-through">{formatCurrency(product.old_price)}</p>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <p className="tabular font-display text-base font-bold tracking-tight text-night sm:text-lg">{formatCurrency(product.current_price)}</p>
            <AddToCartButton productId={product.id} variant="compact" />
          </div>
          {product.free_shipping ? (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-700">
              <Truck className="h-3.5 w-3.5" aria-hidden /> Frete grátis
            </p>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
