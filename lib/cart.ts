/**
 * Carrinho do Oferta Certa. A compra e o pagamento acontecem na loja de cada produto:
 * o carrinho só organiza o que o cliente quer comprar e o leva, item a item, à finalização.
 * Fica guardado neste navegador (localStorage).
 */

export interface CartItem {
  productId: string
  quantity: number
  /** Já levado à finalização na loja nesta visita. */
  sentToCheckout: boolean
  addedAt: string
}

export const CART_MAX_ITEMS = 50
export const CART_MAX_QUANTITY = 10

const KEY = 'oferta-certa-cart'
const EVENT = 'oferta-certa-cart-change'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const clampQuantity = (value: number) => Math.min(CART_MAX_QUANTITY, Math.max(1, Math.round(Number.isFinite(value) ? value : 1)))

/** Aceita só itens bem formados (o localStorage pode ter lixo ou versões antigas). */
export function parseCart(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const items: CartItem[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const item = entry as Record<string, unknown>
    if (typeof item.productId !== 'string' || !UUID.test(item.productId) || seen.has(item.productId)) continue
    seen.add(item.productId)
    items.push({
      productId: item.productId,
      quantity: clampQuantity(Number(item.quantity)),
      sentToCheckout: item.sentToCheckout === true,
      addedAt: typeof item.addedAt === 'string' ? item.addedAt : new Date(0).toISOString(),
    })
    if (items.length >= CART_MAX_ITEMS) break
  }
  return items
}

export function addToCart(items: CartItem[], productId: string, quantity = 1, now = new Date()): CartItem[] {
  if (!UUID.test(productId)) return items
  const existing = items.find((item) => item.productId === productId)
  if (existing) {
    return items.map((item) =>
      item.productId === productId ? { ...item, quantity: clampQuantity(item.quantity + quantity), sentToCheckout: false } : item
    )
  }
  if (items.length >= CART_MAX_ITEMS) return items
  return [...items, { productId, quantity: clampQuantity(quantity), sentToCheckout: false, addedAt: now.toISOString() }]
}

export function setCartQuantity(items: CartItem[], productId: string, quantity: number): CartItem[] {
  return items.map((item) => (item.productId === productId ? { ...item, quantity: clampQuantity(quantity) } : item))
}

export function removeFromCart(items: CartItem[], productId: string): CartItem[] {
  return items.filter((item) => item.productId !== productId)
}

export function markSentToCheckout(items: CartItem[], productId: string): CartItem[] {
  return items.map((item) => (item.productId === productId ? { ...item, sentToCheckout: true } : item))
}

/** Remove do carrinho produtos que saíram do site (inativos ou excluídos). */
export function keepAvailable(items: CartItem[], availableIds: Iterable<string>): CartItem[] {
  const available = new Set(availableIds)
  return items.filter((item) => available.has(item.productId))
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

/** Total estimado com os preços conferidos pelo site (o valor final é o da loja). */
export function cartTotal(items: CartItem[], prices: Map<string, number>): number {
  const cents = items.reduce((sum, item) => sum + Math.round((prices.get(item.productId) ?? 0) * 100) * item.quantity, 0)
  return cents / 100
}

/** Próximo item ainda não levado à finalização, na ordem em que foi adicionado. */
export function nextToCheckout(items: CartItem[]): CartItem | null {
  return items.find((item) => !item.sentToCheckout) ?? null
}

/* ----------------------------- Navegador ----------------------------- */

let cache: { raw: string | null; items: CartItem[] } = { raw: null, items: [] }

export function readCart(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw === cache.raw) return cache.items
    cache = { raw, items: parseCart(raw ? JSON.parse(raw) : []) }
    return cache.items
  } catch {
    return cache.items
  }
}

export function writeCart(items: CartItem[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    // armazenamento indisponível (modo privado etc.): mantém só em memória
    cache = { raw: cache.raw, items }
  }
  window.dispatchEvent(new Event(EVENT))
}

export function updateCart(change: (items: CartItem[]) => CartItem[]) {
  writeCart(change(readCart()))
}

/** Avisa sobre mudanças nesta aba e em outras abas abertas. */
export function subscribeCart(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) listener()
  }
  window.addEventListener(EVENT, listener)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, listener)
    window.removeEventListener('storage', onStorage)
  }
}

const EMPTY: CartItem[] = []
export const getServerCart = () => EMPTY
