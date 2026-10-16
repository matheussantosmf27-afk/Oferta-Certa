import { describe, expect, it } from 'vitest'
import {
  cutAtSentence,
  marketStats,
  sellerReputation,
  backoffDelay,
  belowMinPrice,
  bestSellerBonus,
  parseHighlights,
  mapWithConcurrency,
  mercadoLivreProductUrl,
  normalizeMercadoLivreCatalogProduct,
  scoreCandidate,
  shouldRetry,
  discountPercent,
  extractProductContent,
  isLikelyForeignTitle,
} from './radar'

const product = {
  id: 'MLB54982411',
  name: 'Celular Samsung Galaxy A17 256gb',
  pictures: [{ url: 'http://http2.mlstatic.com/D_NQ_NP_1-F.jpg' }],
  attributes: [{ id: 'BRAND', value_name: 'Samsung' }],
}

const offer = (price: number, extra: Record<string, unknown> = {}) => ({
  item_id: `MLB${price}`,
  price,
  currency_id: 'BRL',
  condition: 'new',
  original_price: null,
  shipping: { free_shipping: true },
  ...extra,
})

const offers = (...list: ReturnType<typeof offer>[]) => ({ paging: { total: list.length }, results: list })

describe('normalizeMercadoLivreCatalogProduct', () => {
  it('usa a oferta mais barata e a página oficial do produto', () => {
    const candidate = normalizeMercadoLivreCatalogProduct(product, offers(offer(1349), offer(1339.9), offer(1340)))
    expect(candidate).toMatchObject({
      external_id: 'MLB54982411',
      permalink: 'https://www.mercadolivre.com.br/p/MLB54982411',
      price: 1339.9,
      original_price: null,
      free_shipping: true,
      brand: 'Samsung',
      image_url: 'https://http2.mlstatic.com/D_NQ_NP_1-F.jpg',
      offers_count: 3,
      rating: null,
    })
  })

  it('só aceita preço anterior maior que o atual', () => {
    expect(normalizeMercadoLivreCatalogProduct(product, offers(offer(100, { original_price: 150 })))?.original_price).toBe(150)
    expect(normalizeMercadoLivreCatalogProduct(product, offers(offer(100, { original_price: 90 })))?.original_price).toBeNull()
  })

  it('descarta produto sem vendedor ou com dados inválidos', () => {
    expect(normalizeMercadoLivreCatalogProduct(product, { results: [] })).toBeNull()
    expect(normalizeMercadoLivreCatalogProduct(product, null)).toBeNull()
    expect(normalizeMercadoLivreCatalogProduct({ ...product, id: 'XYZ' }, offers(offer(10)))).toBeNull()
    expect(normalizeMercadoLivreCatalogProduct(product, offers(offer(0)))).toBeNull()
  })

  it('monta a URL oficial do catálogo', () => {
    expect(mercadoLivreProductUrl('MLB1')).toBe('https://www.mercadolivre.com.br/p/MLB1')
  })
})

describe('scoreCandidate', () => {
  const base = normalizeMercadoLivreCatalogProduct(product, offers(offer(100, { original_price: 150 })))!

  it('pontua desconto real, frete e condição nova', () => {
    const result = scoreCandidate(base)
    expect(result.breakdown.desconto).toBeCloseTo(26.7, 1)
    expect(result.breakdown.frete_gratis).toBe(10)
    expect(result.breakdown.condicao).toBe(5)
  })

  it('não dá pontos de desconto sem preço anterior', () => {
    const result = scoreCandidate({ ...base, original_price: null })
    expect(result.breakdown.desconto).toBe(0)
    expect(result.flags).toContain('sem_preco_anterior')
  })

  it('trata desconto acima de 70% como suspeito', () => {
    const result = scoreCandidate({ ...base, original_price: 1000 })
    expect(result.breakdown.desconto).toBe(0)
    expect(result.flags).toContain('desconto_suspeito')
  })

  it('valoriza produtos com vários vendedores, com teto', () => {
    expect(scoreCandidate({ ...base, offers_count: 1 }).breakdown.vendedores).toBeUndefined()
    expect(scoreCandidate({ ...base, offers_count: 300 }).breakdown.vendedores).toBe(10)
  })

  it('mantém a pontuação entre 0 e 100', () => {
    const used = scoreCandidate({ ...base, original_price: null, condition: 'used', free_shipping: false, offers_count: 1 })
    expect(used.score).toBe(0)
  })
})

describe('utilitários', () => {
  it('backoff exponencial com teto', () => {
    expect([0, 1, 2, 3, 4].map((n) => backoffDelay(n))).toEqual([1000, 2000, 4000, 8000, 8000])
  })

  it('repete só em 429 e 5xx', () => {
    expect(shouldRetry(429)).toBe(true)
    expect(shouldRetry(503)).toBe(true)
    expect(shouldRetry(403)).toBe(false)
  })

  it('limita a simultaneidade e preserva a ordem', async () => {
    let running = 0
    let peak = 0
    const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (n) => {
      running++
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, 5))
      running--
      return n * 2
    })
    expect(out).toEqual([2, 4, 6, 8, 10, 12])
    expect(peak).toBeLessThanOrEqual(2)
  })
})

describe('mais vendidos e preço mínimo', () => {
  const base = normalizeMercadoLivreCatalogProduct(product, offers(offer(100, { original_price: 150 })))!

  it('dá bônus por posição e registra no detalhamento', () => {
    expect([1, 3, 4, 10, 11, 50].map(bestSellerBonus)).toEqual([12, 12, 8, 8, 5, 5])
    expect(bestSellerBonus(null)).toBe(0)
    expect(bestSellerBonus(0)).toBe(0)
    const plain = scoreCandidate(base)
    const top = scoreCandidate(base, { bestSellerPosition: 2 })
    expect(top.breakdown.mais_vendido).toBe(12)
    expect(plain.breakdown.mais_vendido).toBeUndefined()
    expect(top.score).toBeCloseTo(plain.score + 12, 1)
  })

  it('lê só produtos de catálogo da lista de destaques', () => {
    const body = {
      content: [
        { id: 'MLB1', position: 1, type: 'PRODUCT' },
        { id: 'MLBU2', position: 2, type: 'USER_PRODUCT' },
        { id: 'MLB3', position: 3, type: 'ITEM' },
        { id: 'MLB4', position: 4, type: 'PRODUCT' },
      ],
    }
    expect(parseHighlights(body)).toEqual([
      { id: 'MLB1', position: 1 },
      { id: 'MLB4', position: 4 },
    ])
    expect(parseHighlights(null)).toEqual([])
  })

  it('filtra preço abaixo do mínimo do termo', () => {
    expect(belowMinPrice(60, 1200)).toBe(true)
    expect(belowMinPrice(1500, 1200)).toBe(false)
    expect(belowMinPrice(60, null)).toBe(false)
    expect(belowMinPrice(60, 0)).toBe(false)
  })
})

describe('isLikelyForeignTitle', () => {
  it('marca anúncios genéricos em inglês', () => {
    expect(isLikelyForeignTitle('Student Perfume Gifts, Young Ladies Perfume')).toBe(true)
    expect(isLikelyForeignTitle('Wireless Earbuds for Women and Men')).toBe(true)
  })

  it('não marca títulos em português nem nomes de marca/modelo', () => {
    expect(isLikelyForeignTitle('Perfume Deold, perfume feminino de coruja, perfume floral e frutado')).toBe(false)
    expect(isLikelyForeignTitle('Fone De Ouvido Bluetooth JBL Wave Buds 2 Fit Preto')).toBe(false)
    expect(isLikelyForeignTitle('Samsung Galaxy Buds Core')).toBe(false)
    expect(isLikelyForeignTitle('Amazon Echo Dot 5ª Geração Com Alexa')).toBe(false)
    expect(isLikelyForeignTitle('Power Bank 20.000mAh 22.5W Carga Rápida')).toBe(false)
  })
})

describe('discountPercent', () => {
  it('calcula com uma casa decimal e não inventa desconto', () => {
    expect(discountPercent(39.5, 99.9)).toBe(60.5)
    expect(discountPercent(100, null)).toBeNull()
    expect(discountPercent(100, 90)).toBeNull()
  })
})

describe('extractProductContent', () => {
  const product = {
    id: 'MLB54982411',
    name: 'Celular Samsung Galaxy A17',
    short_description: { type: 'plaintext', content: '  Celular com IA,\n 256GB e câmera de 50MP.  ' },
    main_features: [{ text: 'Tela de 6,7"' }, { text: '' }, { text: 'Bateria de 5000 mAh' }],
    attributes: [
      { id: 'BRAND', name: 'Marca', value_name: 'Samsung' },
      { id: 'GTIN', name: 'Código universal', value_name: '7890000000000' },
      { id: 'IS_KIT', name: 'É kit', value_name: 'Não' },
      { id: 'PACKAGE_WEIGHT', name: 'Peso da embalagem', value_name: '400 g' },
      { id: 'INTERNAL_MEMORY', name: 'Memória interna', value_name: '256 GB' },
      { id: 'INTERNAL_MEMORY_2', name: 'memória interna', value_name: '256 GB' },
      { id: 'COLOR', name: 'Cor', value_name: null },
    ],
    pictures: [
      { url: 'http://http2.mlstatic.com/a.jpg' },
      { url: 'https://http2.mlstatic.com/b.jpg' },
      { url: 'https://http2.mlstatic.com/b.jpg' },
    ],
  }

  it('limpa a descrição e pega os destaques', () => {
    const content = extractProductContent(product)
    expect(content.description).toBe('Celular com IA, 256GB e câmera de 50MP.')
    expect(content.features).toEqual(['Tela de 6,7"', 'Bateria de 5000 mAh'])
  })

  it('mostra só atributos úteis, sem repetir e sem valor vazio', () => {
    expect(extractProductContent(product).specs).toEqual([
      { name: 'Marca', value: 'Samsung' },
      { name: 'Memória interna', value: '256 GB' },
    ])
  })

  it('usa só fotos https, sem duplicar', () => {
    expect(extractProductContent(product).gallery).toEqual(['https://http2.mlstatic.com/a.jpg', 'https://http2.mlstatic.com/b.jpg'])
  })

  it('não inventa nada quando o catálogo não traz conteúdo', () => {
    expect(extractProductContent({ id: 'MLB1' })).toEqual({ description: null, features: [], specs: [], gallery: [] })
    expect(extractProductContent(null)).toEqual({ description: null, features: [], specs: [], gallery: [] })
  })

  it('o candidato normalizado leva o conteúdo junto', () => {
    const candidate = normalizeMercadoLivreCatalogProduct(product, { paging: { total: 1 }, results: [{ price: 1339.9, currency_id: 'BRL', condition: 'new', shipping: {} }] })
    expect(candidate?.description).toBe('Celular com IA, 256GB e câmera de 50MP.')
    expect(candidate?.gallery).toHaveLength(2)
  })
})

describe('marketStats', () => {
  const offers = {
    results: [
      { price: 120, currency_id: 'BRL', condition: 'new', seller_id: 2, warranty: 'Garantia de fábrica: 12 meses' },
      { price: 100, currency_id: 'BRL', condition: 'new', seller_id: 1, official_store_id: 55 },
      { price: 80, currency_id: 'BRL', condition: 'used', seller_id: 3 },
      { price: 140, currency_id: 'BRL', condition: 'new', seller_id: 4 },
      { price: 90, currency_id: 'USD', condition: 'new', seller_id: 5 },
    ],
  }

  it('resume só ofertas novas em reais, com a mais barata como referência', () => {
    expect(marketStats(offers)).toEqual({
      offers_count: 3,
      min: 100,
      median: 120,
      max: 140,
      best_seller_id: 1,
      official_store: true,
      warranty: null,
    })
  })

  it('usa a média dos dois do meio quando a quantidade é par', () => {
    expect(marketStats({ results: [{ price: 10 }, { price: 20 }] })?.median).toBe(15)
  })

  it('sem ofertas válidas devolve null', () => {
    expect(marketStats({ results: [] })).toBeNull()
    expect(marketStats(null)).toBeNull()
  })
})

describe('sellerReputation', () => {
  it('lê nível, MercadoLíder e vendas', () => {
    const user = { nickname: 'LOJA X', seller_reputation: { level_id: '5_green', power_seller_status: 'platinum', transactions: { total: 57490 } } }
    expect(sellerReputation(user)).toEqual({ name: 'LOJA X', level: 5, power_seller: 'platinum', sales: 57490 })
  })

  it('campos ausentes ficam nulos', () => {
    expect(sellerReputation({ nickname: 'Y', seller_reputation: { level_id: null, power_seller_status: 'outro' } })).toEqual({
      name: 'Y',
      level: null,
      power_seller: null,
      sales: null,
    })
  })
})

describe('cutAtSentence', () => {
  it('corta no fim da última frase e nunca no meio da palavra', () => {
    const text = 'Primeira frase completa. Segunda frase também completa. Terceira frase que vai ser cortada no meio'
    expect(cutAtSentence(text, 70)).toBe('Primeira frase completa. Segunda frase também completa.')
    expect(cutAtSentence('palavras sem ponto nenhum aqui dentro', 20)).toBe('palavras sem ponto…')
    expect(cutAtSentence('curto', 20)).toBe('curto')
  })
})

describe('scoreCandidate com preço dos outros vendedores', () => {
  const base = {
    external_id: 'MLB1', title: 'Fone sem fio', permalink: 'https://www.mercadolivre.com.br/p/MLB1', image_url: 'https://x/y.jpg',
    price: 193.03, original_price: 619, currency: 'BRL', free_shipping: true, rating: null, reviews_count: null, sold_quantity: null,
    offers_count: 4, condition: 'new', brand: null, description: null, features: [], specs: [], gallery: [],
  }

  it('zera o desconto quando o preço anterior passa do que qualquer vendedor cobra', () => {
    const result = scoreCandidate(base, { market: { offers_count: 4, max: 260 } })
    expect(result.breakdown.desconto).toBe(0)
    expect(result.flags).toContain('preco_anterior_acima_mercado')
  })

  it('mantém o desconto quando há vendedores cobrando perto do preço anterior', () => {
    const result = scoreCandidate({ ...base, original_price: 250 }, { market: { offers_count: 4, max: 260 } })
    expect(result.breakdown.desconto).toBeGreaterThan(0)
    expect(result.flags).not.toContain('preco_anterior_acima_mercado')
  })
})
