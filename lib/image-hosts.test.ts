import { describe, expect, it } from 'vitest'
import { isAllowedImageHost } from './image-hosts.mjs'

describe('isAllowedImageHost', () => {
  it('aceita CDNs dos marketplaces', () => {
    expect(isAllowedImageHost('http2.mlstatic.com')).toBe(true)
    expect(isAllowedImageHost('down-br.img.susercontent.com')).toBe(true)
    expect(isAllowedImageHost('ae01.alicdn.com')).toBe(true)
    expect(isAllowedImageHost('m.media-amazon.com')).toBe(true)
  })

  it('recusa outros domínios e imitações', () => {
    expect(isAllowedImageHost('exemplo.com')).toBe(false)
    expect(isAllowedImageHost('mlstatic.com.golpe.net')).toBe(false)
    expect(isAllowedImageHost('evilmlstatic.com')).toBe(false)
    expect(isAllowedImageHost('x.media-amazon.com')).toBe(false)
  })
})
