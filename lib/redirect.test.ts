import { describe, expect, it } from 'vitest'
import { isAllowedAffiliateUrl } from './redirect'

const ml = ['mercadolivre.com.br', 'meli.la']

describe('isAllowedAffiliateUrl', () => {
  it('aceita links https da loja e de seus subdomínios', () => {
    expect(isAllowedAffiliateUrl('https://www.mercadolivre.com.br/p/MLB1?matt_word=x&matt_tool=1', ml)).toBe(true)
    expect(isAllowedAffiliateUrl('https://meli.la/2cdnYeM', ml)).toBe(true)
  })

  it('recusa http, outros domínios e domínios parecidos', () => {
    expect(isAllowedAffiliateUrl('http://www.mercadolivre.com.br/p/MLB1', ml)).toBe(false)
    expect(isAllowedAffiliateUrl('https://evil.example/?u=mercadolivre.com.br', ml)).toBe(false)
    expect(isAllowedAffiliateUrl('https://mercadolivre.com.br.evil.example/p', ml)).toBe(false)
    expect(isAllowedAffiliateUrl('https://fakemercadolivre.com.br/p', ml)).toBe(false)
  })

  it('recusa URLs inválidas, vazias, com credenciais ou sem lista de domínios', () => {
    expect(isAllowedAffiliateUrl('javascript:alert(1)', ml)).toBe(false)
    expect(isAllowedAffiliateUrl('', ml)).toBe(false)
    expect(isAllowedAffiliateUrl(null, ml)).toBe(false)
    expect(isAllowedAffiliateUrl('https://user:pass@www.mercadolivre.com.br/p', ml)).toBe(false)
    expect(isAllowedAffiliateUrl('https://www.mercadolivre.com.br/p', [])).toBe(false)
  })
})
