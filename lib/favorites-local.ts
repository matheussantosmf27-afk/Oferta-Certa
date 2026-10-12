const KEY = 'oferta-certa-favorites'

/** Favoritos de visitantes sem conta, guardados só neste navegador. */
export function readLocalFavorites(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function writeLocalFavorites(ids: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(Array.from(new Set(ids))))
  } catch {
    // armazenamento indisponível (modo privado etc.)
  }
}
