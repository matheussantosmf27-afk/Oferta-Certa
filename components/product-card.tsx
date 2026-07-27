import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Product } from '@/types'

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const discount = product.discount_percentage ? `${product.discount_percentage}%` : null

  return (
    <article className="group overflow-hidden rounded-md bg-white shadow-sm transition hover:shadow-md">
      <div className="relative bg-white">
        <Image
          src={product.image_url}
          alt={product.name}
          width={800}
          height={560}
          className="h-44 w-full object-contain bg-white p-4"
          priority={false}
        />

        {discount ? (
          <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-sm bg-red-600 px-2 py-1 text-xs font-semibold text-white">
            <span>{discount}</span>
            <span className="sr-only">de desconto</span>
          </div>
        ) : null}
      </div>

      <div className="px-3 py-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">{product.marketplaceName}</p>
          {product.free_shipping ? <span className="text-xs text-green-700">Frete grátis</span> : null}
        </div>

        <h3 className="mt-2 text-sm font-medium text-slate-900 line-clamp-2">{product.name}</h3>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-lg font-extrabold text-slate-900">R$ {product.current_price.toFixed(2)}</p>
            {product.old_price ? <p className="text-sm text-slate-500 line-through">R$ {product.old_price.toFixed(2)}</p> : null}
            {product.installments ? <p className="text-xs text-slate-600">{product.installments} • {product.installment_value ? `R$ ${product.installment_value.toFixed(2)}` : ''}</p> : null}
          </div>

          <Link href={`/produto/${product.slug}`} className="ml-auto inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white">
            Ver oferta <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  )
}
