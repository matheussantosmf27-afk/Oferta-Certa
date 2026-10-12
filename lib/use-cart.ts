'use client'

import { useSyncExternalStore } from 'react'
import { getServerCart, readCart, subscribeCart, type CartItem } from '@/lib/cart'

/** Carrinho do navegador, sincronizado entre componentes e abas. */
export function useCart(): CartItem[] {
  return useSyncExternalStore(subscribeCart, readCart, getServerCart)
}
