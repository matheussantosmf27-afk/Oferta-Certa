import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink, Info, Star, Truck } from 'lucide-react'
import { getProductBySlug, listProducts } from '@/services/catalog'
import { FavoriteButton } from '@/components/favorite-button'
import { ShareActions } from '@/components/share-actions'
import { ProductGrid } from '@/components/product-card'
import { formatCurrency } from '@/lib/price'
import { getSiteUrl } from '@/lib/site'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) return { title: 'Oferta não encontrada' }
  const description = `${product.name} por ${formatCurrency(product.current_price)} em ${product.marketplace_name}.`
  return {
    title: product.name,
    description,
    alternates: { canonical: `/produto/${product.slug}` },
    openGraph: { title: product.name, description, images: product.image_url ? [product.image_url] : undefined },
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) notFound()

  const related = await listProducts({ categorySlug: product.category_slug, excludeId: product.id, limit: 4 })
  const discount = product.discount_percentage && product.discount_percentage > 0 ? product.discount_percentage : null
  const productUrl = `${getSiteUrl()}/produto/${product.slug}`
  const updated = new Date(product.last_price_update)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.image_url || undefined,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    offers: {
      '@type': 'Offer',
      price: product.current_price,
      priceCurrency: 'BRL',
      url: productUrl,
      seller: { '@type': 'Organization', name: product.marketplace_name },
    },
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <nav aria-label="Trilha" className="text-sm text-slate-500">
        <Link href={`/categoria/${product.category_slug}`} className="hover:text-slate-800">
          {product.category_name}
        </Link>
      </nav>

      <div className="mt-3 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              width={800}
              height={600}
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="mx-auto max-h-[420px] w-full object-contain"
            />
          ) : (
            <div className="flex h-72 items-center justify-center text-slate-400">Sem imagem</div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-500">{product.marketplace_name}</p>
            <h1 className="mt-1 text-xl font-semibold leading-snug text-slate-950 sm:text-2xl">{product.name}</h1>
            {product.brand ? <p className="mt-1 text-sm text-slate-600">Marca: {product.brand}</p> : null}

            {product.rating !== null && product.reviews_count ? (
              <p className="mt-2 inline-flex items-center gap-1 text-sm text-slate-700">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
                {product.rating.toFixed(1).replace('.', ',')} ({product.reviews_count} avaliações na loja)
              </p>
            ) : null}

            <div className="mt-5">
              {product.old_price && discount ? (
                <p className="text-sm text-slate-500">
                  <span className="line-through">{formatCurrency(product.old_price)}</span>
                  <span className="ml-2 rounded bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">-{discount}%</span>
                </p>
              ) : null}
              <p className="text-3xl font-bold text-slate-950">{formatCurrency(product.current_price)}</p>
              {product.installments ? <p className="mt-1 text-sm text-slate-600">{product.installments}</p> : null}
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-700">
                <Truck className="h-4 w-4 text-brand-700" aria-hidden />
                {product.free_shipping ? 'Frete grátis informado pela loja' : 'Frete calculado na loja'}
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <a
                href={`/go/${product.id}`}
                rel="nofollow sponsored noopener"
                target="_blank"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Ver oferta em {product.marketplace_name}
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
              <FavoriteButton productId={product.id} />
              <ShareActions url={productUrl} />
            </div>
          </div>

          <div className="flex gap-2 rounded-lg border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <p>
              Preço conferido em {updated.toLocaleDateString('pt-BR')} às{' '}
              {updated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}. Valores e
              estoque podem mudar na loja. Podemos receber comissão por compras feitas por este link.
            </p>
          </div>
        </div>
      </div>

      {product.description ? (
        <section className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">Descrição</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{product.description}</p>
        </section>
      ) : null}

      {related.length ? (
        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold text-slate-950">Mais ofertas de {product.category_name}</h2>
          <ProductGrid products={related} />
        </section>
      ) : null}
    </div>
  )
}
