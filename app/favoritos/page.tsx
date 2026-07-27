'use client'

import { EmptyState } from '@/components/empty-state'
import { ProductCard } from '@/components/product-card'
import { useEffect, useState } from 'react'
import type { Product } from '@/types'

function getSavedProducts(): string[] {
  if (typeof window === 'undefined') return []
  const stored = window.localStorage.getItem('oferta-certa-favorites')
  return stored ? (JSON.parse(stored) as string[]) : []
}

export default function FavoritesPage() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    setFavoriteIds(getSavedProducts())
  }, [])

  useEffect(() => {
    if (!favoriteIds.length) return
    import('@/services/data').then((module) => {
      const favorites = module.getAllProducts().filter((product) => favoriteIds.includes(product.id))
      setProducts(favorites)
    })
  }, [favoriteIds])

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-8">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft sm:p-10">
        <h1 className="text-3xl font-semibold text-slate-950">Favoritos</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Salve ofertas para conferir depois sem precisar fazer login.</p>
      </div>

      <section className="mt-8">
        {products.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <EmptyState title="Nenhum favorito salvo" description="Adicione produtos aos favoritos para vê-los aqui." />
        )}
      </section>
    </div>
  )
}
