import type { Metadata } from 'next'
import Link from 'next/link'
import { ProductGrid } from '@/components/product-card'
import { EmptyState } from '@/components/empty-state'
import { LocalFavorites } from '@/components/local-favorites'
import { getCurrentUser } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { getProductsByIds } from '@/services/catalog'

export const metadata: Metadata = { title: 'Favoritos', robots: { index: false } }

export default async function FavoritesPage() {
  const user = await getCurrentUser()

  if (!user) {
    return (
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-slate-950">Favoritos</h1>
        <p className="mt-1 text-sm text-slate-600">
          Seus favoritos estão salvos só neste navegador.{' '}
          <Link href="/login?next=/favoritos" className="font-medium text-brand-700 hover:underline">
            Entre na sua conta
          </Link>{' '}
          para guardá-los com segurança e acessar de qualquer aparelho.
        </p>
        <div className="mt-6">
          <LocalFavorites />
        </div>
      </div>
    )
  }

  const supabase = await createServerClient()
  const { data: rows } = await supabase.from('favorites').select('product_id').order('created_at', { ascending: false })
  const products = await getProductsByIds((rows ?? []).map((row) => row.product_id))

  return (
    <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-slate-950">Meus favoritos</h1>
      <LocalFavorites syncToAccount />
      <div className="mt-6">
        {products.length ? (
          <ProductGrid products={products} />
        ) : (
          <EmptyState title="Nenhum favorito salvo" description="Toque em “Salvar nos favoritos” na página de uma oferta para guardá-la aqui." />
        )}
      </div>
    </div>
  )
}
