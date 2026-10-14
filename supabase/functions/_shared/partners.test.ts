// @vitest-environment node
import { createHash, createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  aliexpressRequestUrl,
  aliexpressSignature,
  normalizeAliexpressProduct,
  normalizeShopeeOffer,
  originalFromDiscount,
  parseAliexpressProducts,
  parseShopeeResponse,
  shopeeAuthHeader,
  shopeeOfferQuery,
  shopeeSignature,
} from './partners'

describe('originalFromDiscount', () => {
  it('calcula o preço anterior a partir do % informado', () => {
    expect(originalFromDiscount(80, 20)).toBe(100)
  })
  it('ignora descontos ausentes, mínimos ou absurdos', () => {
    expect(originalFromDiscount(80, null)).toBeNull()
    expect(originalFromDiscount(80, 0)).toBeNull()
    expect(originalFromDiscount(80, 95)).toBeNull()
  })
})

describe('Shopee', () => {
  it('assina com SHA256(AppId + Timestamp + Payload + Secret)', async () => {
    const payload = '{"query":"{ x }"}'
    const expected = createHash('sha256').update(`123${1700000000}${payload}abc`).digest('hex')
    expect(await shopeeSignature('123', 1700000000, payload, 'abc')).toBe(expected)
    const header = await shopeeAuthHeader('123', 'abc', payload, 1700000000500)
    expect(header).toBe(`SHA256 Credential=123, Timestamp=1700000000, Signature=${expected}`)
  })

  it('monta a consulta com palavra-chave escapada e limite', () => {
    const body = JSON.parse(shopeeOfferQuery({ keyword: 'fone "bluetooth"', limit: 99 }))
    expect(body.query).toContain('keyword: "fone \\"bluetooth\\""')
    expect(body.query).toContain('limit: 50')
    expect(body.query).toContain('offerLink')
  })

  it('lança o erro da API e lê os nós', () => {
    expect(() => parseShopeeResponse({ errors: [{ message: 'Invalid Signature' }] })).toThrow(/Invalid Signature/)
    expect(parseShopeeResponse({ data: { productOfferV2: { nodes: [{ itemId: 1 }] } } })).toHaveLength(1)
  })

  const node = {
    itemId: 22334455,
    productName: 'Fone de Ouvido Bluetooth TWS',
    productLink: 'https://shopee.com.br/product/111/22334455',
    offerLink: 'https://s.shopee.com.br/AbCdEf',
    imageUrl: 'https://down-br.img.susercontent.com/file/abc',
    priceMin: '79.90',
    priceMax: '79.90',
    priceDiscountRate: 20,
    sales: 1520,
    ratingStar: '4.8',
  }

  it('normaliza uma oferta com link de afiliado', () => {
    const candidate = normalizeShopeeOffer(node)
    expect(candidate).toMatchObject({
      external_id: '22334455',
      affiliate_url: 'https://s.shopee.com.br/AbCdEf',
      price: 79.9,
      original_price: 99.88,
      sold_quantity: 1520,
      rating: 4.8,
      free_shipping: false,
    })
  })

  it('descarta ofertas sem link, de outro domínio ou com variações muito diferentes', () => {
    expect(normalizeShopeeOffer({ ...node, offerLink: '' })).toBeNull()
    expect(normalizeShopeeOffer({ ...node, offerLink: 'https://evil.example/x' })).toBeNull()
    expect(normalizeShopeeOffer({ ...node, priceMax: '200' })).toBeNull()
  })
})

describe('AliExpress', () => {
  const credentials = { appKey: '5000', secret: 'segredo', trackingId: 'ofertacerta' }

  it('assina com HMAC-SHA256 dos parâmetros ordenados', async () => {
    const params = { b: '2', a: '1', method: 'x' }
    const expected = createHmac('sha256', 'segredo').update('a1b2methodx').digest('hex').toUpperCase()
    expect(await aliexpressSignature(params, 'segredo')).toBe(expected)
  })

  it('monta a URL com BRL, português, Brasil e a etiqueta', async () => {
    const url = new URL(await aliexpressRequestUrl('aliexpress.affiliate.product.query', { keywords: 'fone' }, credentials, 1700000000000))
    expect(url.origin + url.pathname).toBe('https://api-sg.aliexpress.com/sync')
    expect(url.searchParams.get('target_currency')).toBe('BRL')
    expect(url.searchParams.get('ship_to_country')).toBe('BR')
    expect(url.searchParams.get('tracking_id')).toBe('ofertacerta')
    expect(url.searchParams.get('sign')).toMatch(/^[0-9A-F]{64}$/)
  })

  it('lê produtos, trata "nenhum produto" e erros', () => {
    const ok = { aliexpress_affiliate_product_query_response: { resp_result: { resp_code: 200, result: { products: { product: [{ product_id: 1 }] } } } } }
    expect(parseAliexpressProducts(ok)).toHaveLength(1)
    const empty = { aliexpress_affiliate_product_query_response: { resp_result: { resp_code: 405, resp_msg: 'No result' } } }
    expect(parseAliexpressProducts(empty)).toEqual([])
    expect(() => parseAliexpressProducts({ error_response: { msg: 'Invalid signature' } })).toThrow(/Invalid signature/)
  })

  const product = {
    product_id: 1005006000000001,
    product_title: 'Smartwatch Esportivo À Prova D\'Água',
    promotion_link: 'https://s.click.aliexpress.com/e/_abc',
    product_detail_url: 'https://pt.aliexpress.com/item/1005006000000001.html',
    product_main_image_url: 'https://ae01.alicdn.com/kf/abc.jpg',
    product_small_image_urls: { string: ['https://ae01.alicdn.com/kf/def.jpg'] },
    target_sale_price: '89.90',
    target_sale_price_currency: 'BRL',
    target_original_price: '179.80',
    lastest_volume: 3200,
  }

  it('normaliza um produto com link de afiliado', () => {
    expect(normalizeAliexpressProduct(product)).toMatchObject({
      external_id: '1005006000000001',
      affiliate_url: 'https://s.click.aliexpress.com/e/_abc',
      price: 89.9,
      original_price: 179.8,
      sold_quantity: 3200,
      gallery: ['https://ae01.alicdn.com/kf/abc.jpg', 'https://ae01.alicdn.com/kf/def.jpg'],
    })
  })

  it('descarta produtos sem link, em outra moeda ou sem preço anterior maior', () => {
    expect(normalizeAliexpressProduct({ ...product, promotion_link: '' })).toBeNull()
    expect(normalizeAliexpressProduct({ ...product, target_sale_price_currency: 'USD' })).toBeNull()
    expect(normalizeAliexpressProduct({ ...product, target_original_price: '50' })?.original_price).toBeNull()
  })
})
