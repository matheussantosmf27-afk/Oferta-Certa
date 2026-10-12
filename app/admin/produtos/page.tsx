import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { Flash, PageTitle } from '@/components/admin/flash'
import { formatCurrency } from '@/lib/price'

const STATUS_LABEL: Record<string, string> = { draft: 'Rascunho', active: 'Publicado', inactive: 'Inativo', expired: 'Expirado' }

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string; q?: string; status?: string }>
}) {
  const params = await searchParams
  const supabase = await createServerClient()
  let query = supabase
    .from('products')
    .select('id, name, slug, status, current_price, old_price, featured, affiliate_url, last_price_update, categories(name), marketplaces(name)')
    .order('updated_at', { ascending: false })
    .limit(200)
  if (params.q) query = query.ilike('name', `%${params.q.replace(/[%_,()]/g, ' ').trim()}%`)
  if (params.status && STATUS_LABEL[params.status]) query = query.eq('status', params.status as 'draft' | 'active' | 'inactive' | 'expired')
  const { data: products, error } = await query

  return (
    <div className="space-y-5">
      <PageTitle title="Produtos">
        <Link href="/admin/produtos/novo" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Novo produto
        </Link>
      </PageTitle>
      <Flash ok={params.ok} erro={params.erro ?? error?.message} />

      <form method="get" className="flex flex-wrap gap-2">
        <input name="q" defaultValue={params.q ?? ''} placeholder="Pesquisar produto" className="min-w-[12rem] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <select name="status" defaultValue={params.status ?? ''} className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm">Filtrar</button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3">Produto</th>
              <th className="p-3">Categoria</th>
              <th className="p-3">Preço</th>
              <th className="p-3">Status</th>
              <th className="p-3">Link</th>
            </tr>
          </thead>
          <tbody>
            {(products ?? []).map((product) => (
              <tr key={product.id} className="border-t border-slate-100">
                <td className="p-3">
                  <Link href={`/admin/produtos/${product.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                    {product.name}
                  </Link>
                  <p className="text-xs text-slate-500">{product.marketplaces?.name}{product.featured ? ' · destaque' : ''}</p>
                </td>
                <td className="p-3 text-slate-700">{product.categories?.name}</td>
                <td className="p-3 text-slate-900">{formatCurrency(product.current_price)}</td>
                <td className="p-3">{STATUS_LABEL[product.status]}</td>
                <td className="p-3">{product.affiliate_url ? <span className="text-brand-700">ok</span> : <span className="text-red-600">sem link</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!products?.length ? <p className="p-6 text-center text-sm text-slate-500">Nenhum produto. Aprove candidatos no Radar ou crie um manualmente.</p> : null}
      </div>
    </div>
  )
}
