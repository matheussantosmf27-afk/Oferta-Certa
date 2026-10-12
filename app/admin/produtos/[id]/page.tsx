import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { Flash, PageTitle } from '@/components/admin/flash'
import { ProductForm } from '@/components/admin/product-form'
import { SubmitButton } from '@/components/ui'
import { deleteProduct } from '@/app/admin/actions'
import { isUuid } from '@/services/catalog'
import { formatCurrency } from '@/lib/price'

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  const { id } = await params
  const flash = await searchParams
  if (!isUuid(id)) notFound()

  const supabase = await createServerClient()
  const [{ data: product }, { data: categories }, { data: marketplaces }, { data: history }, clicks] = await Promise.all([
    supabase.from('products').select('*').eq('id', id).maybeSingle(),
    supabase.from('categories').select('id, name').order('name'),
    supabase.from('marketplaces').select('id, name').order('name'),
    supabase.from('product_price_history').select('price, recorded_at').eq('product_id', id).order('recorded_at', { ascending: false }).limit(10),
    supabase.from('clicks').select('*', { count: 'exact', head: true }).eq('product_id', id),
  ])
  if (!product) notFound()

  return (
    <div className="space-y-5">
      <PageTitle title="Editar produto" description={`${clicks.count ?? 0} cliques registrados`}>
        {product.status === 'active' ? (
          <Link href={`/produto/${product.slug}`} target="_blank" className="text-sm font-medium text-brand-700 hover:underline">
            Ver no site
          </Link>
        ) : null}
      </PageTitle>
      <Flash ok={flash.ok} erro={flash.erro} />
      <ProductForm product={product} categories={categories ?? []} marketplaces={marketplaces ?? []} />

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Histórico de preço</h2>
        {history?.length ? (
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {history.map((row) => (
              <li key={row.recorded_at}>
                {new Date(row.recorded_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} — {formatCurrency(row.price)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Sem registros ainda.</p>
        )}
      </section>

      <form action={deleteProduct} className="rounded-lg border border-red-200 bg-red-50 p-4">
        <input type="hidden" name="id" value={product.id} />
        <p className="text-sm text-red-800">Excluir remove o produto do site, os favoritos e o histórico de preço. Para só esconder, mude o status para Inativo.</p>
        <SubmitButton variant="danger" className="mt-3" pendingText="Excluindo…">
          Excluir produto
        </SubmitButton>
      </form>
    </div>
  )
}
