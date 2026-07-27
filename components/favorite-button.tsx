'use client'

import { Heart, HeartOff } from 'lucide-react'
import { useEffect, useState } from 'react'

interface FavoriteButtonProps {
  productId: string
}

export function FavoriteButton({ productId }: FavoriteButtonProps) {
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem('oferta-certa-favorites')
    if (stored) {
      const list = JSON.parse(stored) as string[]
      setSaved(list.includes(productId))
    }
  }, [productId])

  const toggleFavorite = () => {
    const stored = window.localStorage.getItem('oferta-certa-favorites')
    const list = stored ? (JSON.parse(stored) as string[]) : []
    const updated = saved ? list.filter((id) => id !== productId) : [...list, productId]
    window.localStorage.setItem('oferta-certa-favorites', JSON.stringify(updated))
    setSaved(!saved)
  }

  return (
    <button
      type="button"
      onClick={toggleFavorite}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      aria-label={saved ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
    >
      {saved ? <Heart className="h-4 w-4 text-rose-500" /> : <HeartOff className="h-4 w-4 text-slate-500" />}
      {saved ? 'Salvo' : 'Favoritar'}
    </button>
  )
}
