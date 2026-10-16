import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Check, ExternalLink, Info, ShieldCheck, Star, Truck } from 'lucide-react'
import { getPriceHistory, getProductBySlug, getProductDetails, getProductInsights, listProducts, resolveVariantSlug } from '@/services/catalog'
import { ProductGallery } from '@/components/product-gallery'
import { FavoriteButton } from '@/components/favorite-button'
import { ShareActions } from '@/components/share-actions'
import { ProductGrid } from '@/components/product-card'
import { PriceHistory } from '@/components/price-history'
import { PriceXray } from '@/components/price-xray'
import { AddToCartButton } from '@/components/cart/add-to-cart-button'
import { displayDiscount, formatCurrency } from '@/lib/price'
import { getSiteUrl } from '@/lib/site'
import { storeNotice } from '@/lib/stores'
import { findSpecConflicts, normalizeDescription } from '@/lib/description'

// Página pública em cache, renovada a cada 5 minutos (preços mudam a cada coleta).
export const revalidate = 300

// Gera cada página na primeira visita e mantém em cache.
export async function generateStaticParams() {
  return []
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) return { title: 'Oferta não encontrada' }
  const lead = `${product.name} por ${formatCurrency(product.current_price)} em ${product.marketplace_name}.`
  const summary = normalizeDescription(product.description).paragraphs[0] ?? product.short_description
  const description = summary ? `${lead} ${summary}`.slice(0, 300) : lead
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
  if (!product) {
    // Variante escondida (outra cor/tamanho do mesmo produto está na vitrine): leva até ela.
    const visible = await resolveVariantSlug(slug)
    if (visible) redirect(`/produto/${visible}`)
    notFound()
  }

  const [related, history, details, insights] = await Promise.all([
    listProducts({ categorySlug: product.category_slug, excludeId: product.id, limit: 4 }),
    getPriceHistory(product.id),
    getProductDetails(product.id),
    getProductInsights(product.id),
  ])
  const description = normalizeDescription(product.description)
  const conflicts = findSpecConflicts(product.description, details.specs)
  const images = [...new Set([product.image_url, ...(product.gallery ?? [])].filter(Boolean))].slice(0, 8)
  const discount = displayDiscount(product)
  const productUrl = `${getSiteUrl()}/produto/${product.slug}`
  const updated = new Date(product.last_price_update)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: images.length ? images : undefined,
    description: description.paragraphs.join(' ').slice(0, 500) || undefined,
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

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-xl border border-surface-300 bg-white p-6">
          <ProductGallery images={images} alt={product.name} />
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-surface-300 bg-white p-6">
            <p className="text-sm font-medium text-slate-500">{product.marketplace_name}</p>
            <h1 className="mt-1 text-xl font-semibold leading-snug text-night sm:text-2xl">{product.name}</h1>
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
                  <span className="tabular ml-2 rounded-md bg-signal px-2 py-1 font-display text-xs font-bold text-white">−{discount}%</span>
                </p>
              ) : null}
              <p className="tabular mt-1 font-display text-3xl font-bold tracking-tight text-night sm:text-4xl">{formatCurrency(product.current_price)}</p>
              {product.installments ? <p className="mt-1 text-sm text-slate-600">{product.installments}</p> : null}
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-700">
                <Truck className="h-4 w-4 text-brand-700" aria-hidden />
                {product.free_shipping ? 'Frete grátis informado pela loja' : 'Frete calculado na loja'}
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <a
                href={`/go/${product.id}?utm_source=site&utm_medium=comprar-agora`}
                rel="nofollow sponsored noopener"
                target="_blank"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-brand-700"
              >
                Comprar agora
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
              <AddToCartButton productId={product.id} />
              <p className="flex items-start gap-1.5 text-xs leading-5 text-slate-600">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
                Pagamento e entrega pelo {product.marketplace_name}, com a proteção de compra deles. Você finaliza a compra na página do
                vendedor.
              </p>
              {storeNotice(product.marketplace_slug) ? (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">{storeNotice(product.marketplace_slug)}</p>
              ) : null}
              <FavoriteButton productId={product.id} />
              <ShareActions url={productUrl} />
            </div>
          </div>

          <div className="flex gap-2 rounded-xl border border-surface-300 bg-white p-4 text-xs leading-5 text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <p>
              Preço conferido em {updated.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} às{' '}
              {updated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}. Valores e
              estoque podem mudar na loja. Podemos receber comissão por compras feitas por este link.
            </p>
          </div>
        </div>
      </div>

      <div className={`mt-8 grid grid-cols-[minmax(0,1fr)] items-start gap-6 ${history.length && insights ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : ''}`}>
        <PriceXray price={product.current_price} marketplaceName={product.marketplace_name} insights={insights} />
        <PriceHistory history={history} />
      </div>

      {description.paragraphs.length || details.features.length ? (
        <section className="mt-8 rounded-xl border border-surface-300 bg-white p-6">
          <h2 className="font-display text-lg font-bold tracking-tight text-night">Sobre o produto</h2>
          {description.paragraphs.length ? (
            <div className="mt-3 max-w-3xl space-y-3 text-[0.95rem] leading-7 text-slate-700">
              {description.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          ) : null}
          {description.truncated ? (
            <p className="mt-2 text-xs text-slate-500">Mostramos um resumo da descrição. O texto completo está na página do produto na loja.</p>
          ) : null}
          {conflicts.length ? (
            <div className="mt-4 flex max-w-3xl gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm leading-6 text-amber-900">
              <Info className="mt-1 h-4 w-4 shrink-0" aria-hidden />
              <p>
                A descrição do vendedor e a ficha técnica não batem em:{' '}
                {conflicts.map((conflict, index) => (
                  <span key={conflict.label}>
                    {index ? '; ' : ''}
                    <strong className="font-semibold">{conflict.label.toLowerCase()}</strong> ({conflict.inDescription} na descrição,{' '}
                    {conflict.inSpecs} na ficha)
                  </span>
                ))}
                . Confirme na página da loja antes de comprar.
              </p>
            </div>
          ) : null}
          {details.features.length ? (
            <ul className="mt-4 space-y-2">
              {details.features.map((feature) => (
                <li key={feature} className="flex gap-2 text-sm leading-6 text-slate-700">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-4 text-xs text-slate-500">Informações do catálogo do {product.marketplace_name}. Confira os detalhes na página do vendedor.</p>
        </section>
      ) : null}

      {details.specs.length ? (
        <section className="mt-6 rounded-xl border border-surface-300 bg-white p-6">
          <h2 className="font-display text-lg font-bold tracking-tight text-night">Ficha técnica</h2>
          <dl className="mt-3 divide-y divide-slate-100 text-sm">
            {details.specs.map((spec) => (
              <div key={spec.name} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-2">
                <dt className="text-slate-500">{spec.name}</dt>
                <dd className="text-slate-900">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {related.length ? (
        <section className="mt-10 space-y-4">
          <h2 className="font-display text-xl font-bold tracking-tight text-night">Mais ofertas de {product.category_name}</h2>
          <ProductGrid products={related} />
        </section>
      ) : null}
    </div>
  )
}
