'use client'

import { Heart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { readLocalFavorites, writeLocalFavorites } from '@/lib/favorites-local'

export function FavoriteButton({ productId }: { productId: string }) {
  const [saved, setSaved] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    const supabase = createBrowserClient()
    let active = true
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id ?? null
      if (!active) return
      setUserId(uid)
      if (uid) {
        const { data: row } = await supabase.from('favorites').select('product_id').eq('product_id', productId).maybeSingle()
        if (active) setSaved(Boolean(row))
      } else {
        setSaved(readLocalFavorites().includes(productId))
      }
      if (active) setBusy(false)
    })()
    return () => {
      active = false
    }
  }, [productId])

  const toggle = async () => {
    setBusy(true)
    const next = !saved
    if (userId) {
      const supabase = createBrowserClient()
      const { error } = next
        ? await supabase.from('favorites').insert({ product_id: productId })
        : await supabase.from('favorites').delete().eq('product_id', productId)
      if (!error) setSaved(next)
    } else {
      const list = readLocalFavorites()
      writeLocalFavorites(next ? [...list, productId] : list.filter((id) => id !== productId))
      setSaved(next)
    }
    setBusy(false)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
    >
      <Heart className={saved ? 'h-4 w-4 fill-rose-500 text-rose-500' : 'h-4 w-4 text-slate-500'} aria-hidden />
      {saved ? 'Salvo nos favoritos' : 'Salvar nos favoritos'}
    </button>
  )
}
