import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPublicSupabaseEnv } from './env'

describe('getPublicSupabaseEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('retorna URL e chave pública quando configuradas', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://exemplo.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'chave-publica')
    expect(getPublicSupabaseEnv()).toEqual({
      url: 'https://exemplo.supabase.co',
      publishableKey: 'chave-publica',
    })
  })

  it('falha com mensagem clara quando falta variável', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'chave-publica')
    expect(() => getPublicSupabaseEnv()).toThrow('NEXT_PUBLIC_SUPABASE_URL')
  })
})
