import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react'
import { getProductBySlug, getProductsByCategory } from '@/services/data'
import { ShareActions } from '@/components/share-actions'
import { FavoriteButton } from '@/components/favorite-button'
import { resolveProductUrl } from '@/services/url'
import { SectionHeading } from '@/components/section-heading'

export default async function ProductPage(props: { params: Promise<{ slug: string }> }) {
  const { params } = props
  const { slug } = await params
  const product = getProductBySlug(slug)
  if (!product) {
    notFound()
  }

  const related = getProductsByCategory(product.category_id).filter((item) => item.id !== product.id).slice(0, 3)
  const offerUrl = `/go/${product.id}`

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-700">{product.marketplaceName}</span>
                <span className="text-slate-400">•</span>
                <span>{product.categoryName}</span>
              </div>
              <h1 className="text-3xl font-semibold text-slate-950">{product.name}</h1>
              <p className="text-base leading-7 text-slate-600">{product.short_description}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl bg-slate-50 p-4 text-slate-700">
                  <p className="text-sm font-semibold">Frete</p>
                  <p className="mt-1">{product.free_shipping ? 'Grátis' : 'A calcular no marketplace'}</p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4 text-slate-700">
                  <p className="text-sm font-semibold">Atualizado</p>
                  <p className="mt-1">{new Date(product.last_price_update).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft">
              <Image
                src={product.image_url}
                alt={product.name}
                width={920}
                height={620}
                className="h-full w-full rounded-[1.5rem] object-cover"
              />
            </div>
            <div className="space-y-4 rounded-[2rem] border border-slate-200 bg-slate-50 p-6 shadow-card">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-brand-600" />
                  <p className="text-sm font-semibold text-slate-900">Oferta especial</p>
                </div>
                <div className="space-y-2">
                  <p className="text-4xl font-semibold text-slate-950">R$ {product.current_price.toFixed(2)}</p>
                  {product.old_price ? <p className="text-sm text-slate-500 line-through">R$ {product.old_price.toFixed(2)}</p> : null}
                  {product.discount_percentage ? <p className="text-sm font-semibold text-brand-700">{product.discount_percentage}% de desconto</p> : null}
                </div>
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">Parcelamento: {product.installments ?? 'Não disponível'}</p>
                  {product.coupon_id ? <p className="rounded-3xl bg-brand-100 px-4 py-2 text-sm font-semibold text-brand-700">Cupom disponível</p> : null}
                </div>
              </div>
              <div className="space-y-4">
                <Link href={offerUrl} className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700">
                  Ver oferta no marketplace
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <ShareActions url={resolveProductUrl(product.slug)} />
                <FavoriteButton productId={product.id} />
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft">
            <SectionHeading title="Descrição" description="Informações completas do produto." />
            <p className="mt-4 text-sm leading-7 text-slate-600">{product.description}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Marca</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">{product.brand}</p>
            </div>
            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Categoria</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">{product.categoryName}</p>
            </div>
            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Marketplace</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">{product.marketplaceName}</p>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <ShieldCheck className="h-5 w-5 text-brand-600" />
              <span>Preço e disponibilidade sujeitos a alterações no vendedor.</span>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft">
            <SectionHeading title="Também vale a pena conferir" description="Produtos similares para comparar." />
            <div className="mt-4 space-y-4">
              {related.map((item) => (
                <Link key={item.id} href={`/produto/${item.slug}`} className="block rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100">
                  <h3 className="font-semibold text-slate-950">{item.name}</h3>
                  <p className="mt-2 text-sm text-slate-600">R$ {item.current_price.toFixed(2)} · {item.marketplaceName}</p>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
