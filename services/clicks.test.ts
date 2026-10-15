import { describe, expect, it, vi } from 'vitest'
import { deviceType, registerClick } from './clicks'

describe('deviceType', () => {
  it('classifica aparelhos e identifica robôs', () => {
    expect(deviceType('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('mobile')
    expect(deviceType('Mozilla/5.0 (iPad; CPU OS 17_0)')).toBe('tablet')
    expect(deviceType('Mozilla/5.0 (Windows NT 10.0; Win64)')).toBe('desktop')
    expect(deviceType('Googlebot/2.1')).toBe('bot')
    expect(deviceType(null)).toBeNull()
  })
})

describe('registerClick', () => {
  it('sem a chave de serviço, só avisa e não quebra o redirecionamento', async () => {
    const previous = process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(
      registerClick({ productId: 'p', marketplaceId: 'm', request: new Request('https://site.test/go/p') })
    ).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
    if (previous) process.env.SUPABASE_SERVICE_ROLE_KEY = previous
  })
})
