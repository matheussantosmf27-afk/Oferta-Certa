'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProductCard } from '@/components/product-card'
import { EmptyState } from '@/components/empty-state'
import { createBrowserClient } from '@/lib/supabase/client'
import { readLocalFavorites, writeLocalFavorites } from '@/lib/favorites-local'
import type { Product } from '@/types'

/**
 * Sem `syncToAccount`: mostra os favoritos guardados no navegador.
 * Com `syncToAccount`: envia esses favoritos para a conta (uma vez) e recarrega a lista.
 */
export function LocalFavorites({ syncToAccount = false }: { syncToAccount?: boolean }) {
  const router = useRouter()
  const [products, setProducts] = useState<Product[] | null>(null)

  useEffect(() => {
    const ids = readLocalFavorites()

    if (syncToAccount) {
      if (!ids.length) return
      const supabase = createBrowserClient()
      supabase
        .from('favorites')
        .upsert(ids.map((product_id) => ({ product_id })), { onConflict: 'user_id,product_id', ignoreDuplicates: true })
        .then(({ error }) => {
          if (!error) {
            writeLocalFavorites([])
            router.refresh()
          }
        })
      return
    }

    if (!ids.length) {
      setProducts([])
      return
    }
    fetch(`/api/public/products?ids=${ids.join(',')}`)
      .then((response) => (response.ok ? response.json() : { products: [] }))
      .then((body: { products: Product[] }) => setProducts(body.products))
      .catch(() => setProducts([]))
  }, [syncToAccount, router])

  if (syncToAccount) return null
  if (products === null) return <p className="text-sm text-slate-500">Carregando favoritos…</p>
  if (!products.length) {
    return <EmptyState title="Nenhum favorito salvo" description="Toque em “Salvar nos favoritos” na página de uma oferta para guardá-la aqui." />
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
