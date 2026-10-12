import { createServerClient } from '@/lib/supabase/server'
import { Flash, PageTitle } from '@/components/admin/flash'
import { ProductForm } from '@/components/admin/product-form'

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const params = await searchParams
  const supabase = await createServerClient()
  const [{ data: categories }, { data: marketplaces }] = await Promise.all([
    supabase.from('categories').select('id, name').order('name'),
    supabase.from('marketplaces').select('id, name').order('name'),
  ])
  return (
    <div className="space-y-5">
      <PageTitle title="Novo produto" description="Para ofertas encontradas fora do Radar." />
      <Flash erro={params.erro} />
      <ProductForm categories={categories ?? []} marketplaces={marketplaces ?? []} />
    </div>
  )
}
