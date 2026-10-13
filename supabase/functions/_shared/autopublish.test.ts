import { describe, expect, it } from 'vitest'
import {
  affiliateTagFrom,
  analyzeMercadoLivreAffiliateLink,
  autoPublishBlockers,
  buildMercadoLivreAffiliateUrl,
  isAutoPublishEligible,
  selectAutoPublishBatch,
  type AutoPublishCandidate,
  type AutoPublishSettings,
} from './autopublish'

const settings: AutoPublishSettings = {
  auto_publish_enabled: true,
  auto_publish_min_score: 40,
  auto_publish_max_per_run: 20,
  auto_publish_max_per_day: 100,
  auto_publish_max_discount: 60,
  auto_publish_block_foreign_titles: true,
  ml_matt_word: 'minha_etiqueta',
  ml_matt_tool: '12345678',
}

const RUN = 'run-1'

const candidate = (extra: Partial<AutoPublishCandidate> = {}): AutoPublishCandidate => ({
  id: 'c1',
  status: 'pending',
  is_demo: false,
  score: 55,
  score_breakdown: { desconto: 30 },
  image_url: 'https://http2.mlstatic.com/a.jpg',
  price: 199.9,
  original_price: 279.9,
  suggested_category_id: 'cat-1',
  last_run_id: RUN,
  product_id: null,
  permalink: 'https://www.mercadolivre.com.br/p/MLB54982411',
  ...extra,
})

describe('buildMercadoLivreAffiliateUrl', () => {
  const tag = { mattWord: 'minha_etiqueta', mattTool: '12345678' }

  it('acrescenta matt_word e matt_tool à página do produto', () => {
    expect(buildMercadoLivreAffiliateUrl('https://www.mercadolivre.com.br/p/MLB54982411', tag)).toBe(
      'https://www.mercadolivre.com.br/p/MLB54982411?matt_word=minha_etiqueta&matt_tool=12345678'
    )
  })

  it('substitui etiqueta anterior, mantém outros parâmetros e remove fragmento', () => {
    const url = buildMercadoLivreAffiliateUrl('https://www.mercadolivre.com.br/p/MLB1?pdp_filters=x&matt_word=outra#reviews', tag)
    expect(url).toBe('https://www.mercadolivre.com.br/p/MLB1?pdp_filters=x&matt_word=minha_etiqueta&matt_tool=12345678')
  })

  it('recusa domínios de fora, http e etiqueta inválida', () => {
    expect(buildMercadoLivreAffiliateUrl('https://golpe.example.com/p/MLB1', tag)).toBeNull()
    expect(buildMercadoLivreAffiliateUrl('http://www.mercadolivre.com.br/p/MLB1', tag)).toBeNull()
    expect(buildMercadoLivreAffiliateUrl('não é url', tag)).toBeNull()
    expect(buildMercadoLivreAffiliateUrl('https://www.mercadolivre.com.br/p/MLB1', { mattWord: 'a&b', mattTool: '1' })).toBeNull()
    expect(buildMercadoLivreAffiliateUrl('https://www.mercadolivre.com.br/p/MLB1', { mattWord: '', mattTool: '1' })).toBeNull()
  })

  it('nunca devolve o permalink original', () => {
    const permalink = 'https://www.mercadolivre.com.br/p/MLB54982411'
    expect(buildMercadoLivreAffiliateUrl(permalink, tag)).not.toBe(permalink)
  })
})

describe('analyzeMercadoLivreAffiliateLink', () => {
  it('aceita link completo e extrai a etiqueta', () => {
    const result = analyzeMercadoLivreAffiliateLink(
      'https://www.mercadolivre.com.br/p/MLB54982411?matt_word=minha_etiqueta&matt_tool=12345678'
    )
    expect(result).toEqual({
      kind: 'params',
      productUrl: 'https://www.mercadolivre.com.br/p/MLB54982411',
      tag: { mattWord: 'minha_etiqueta', mattTool: '12345678' },
      extraParams: [],
    })
  })

  it('aponta parâmetros extras (que podem variar a cada link)', () => {
    const result = analyzeMercadoLivreAffiliateLink('https://www.mercadolivre.com.br/p/MLB1?matt_word=a&matt_tool=1&forceInApp=true')
    expect(result.kind === 'params' && result.extraParams).toEqual(['forceInApp'])
  })

  it('recusa links encurtados e incompletos', () => {
    expect(analyzeMercadoLivreAffiliateLink('https://meli.la/1AbCdEf').kind).toBe('short')
    expect(analyzeMercadoLivreAffiliateLink('https://www.mercadolivre.com.br/sec/1abc').kind).toBe('short')
    expect(analyzeMercadoLivreAffiliateLink('https://www.mercadolivre.com.br/p/MLB1').kind).toBe('invalid')
    expect(analyzeMercadoLivreAffiliateLink('xyz').kind).toBe('invalid')
  })

  it('o construtor reproduz exatamente um link completo real', () => {
    const real = 'https://www.mercadolivre.com.br/p/MLB54982411?matt_word=minha_etiqueta&matt_tool=12345678'
    const analysis = analyzeMercadoLivreAffiliateLink(real)
    if (analysis.kind !== 'params') throw new Error('esperava link completo')
    expect(buildMercadoLivreAffiliateUrl(analysis.productUrl, analysis.tag)).toBe(real)
  })
})

describe('elegibilidade', () => {
  it('aceita candidato que cumpre todas as condições', () => {
    expect(autoPublishBlockers(candidate(), settings, RUN)).toEqual([])
    expect(isAutoPublishEligible(candidate(), settings, RUN)).toBe(true)
  })

  it('exige pontuação ESTRITAMENTE maior que o mínimo', () => {
    expect(autoPublishBlockers(candidate({ score: 40 }), settings, RUN)).toContain('pontuacao')
    expect(isAutoPublishEligible(candidate({ score: 40.1 }), settings, RUN)).toBe(true)
  })

  it.each([
    [{ status: 'approved' }, 'nao_pendente'],
    [{ status: 'rejected' }, 'nao_pendente'],
    [{ is_demo: true }, 'demo'],
    [{ product_id: 'p1' }, 'ja_publicado'],
    [{ score_breakdown: { _alertas: ['desconto_suspeito'] } }, 'desconto_suspeito'],
    [{ image_url: null }, 'sem_imagem'],
    [{ image_url: '  ' }, 'sem_imagem'],
    [{ price: 0 }, 'sem_preco'],
    [{ suggested_category_id: null }, 'sem_categoria'],
    [{ last_run_id: 'outra-execucao' }, 'vendedor_nao_confirmado'],
    [{ last_run_id: null }, 'vendedor_nao_confirmado'],
  ] as const)('recusa %o (%s)', (extra, reason) => {
    expect(autoPublishBlockers(candidate(extra as Partial<AutoPublishCandidate>), settings, RUN)).toContain(reason)
  })

  it('outros alertas não bloqueiam', () => {
    expect(isAutoPublishEligible(candidate({ score_breakdown: { _alertas: ['sem_preco_anterior'] } }), settings, RUN)).toBe(true)
  })

  it('desligado ou sem etiqueta: nada é elegível', () => {
    expect(autoPublishBlockers(candidate(), { ...settings, auto_publish_enabled: false }, RUN)).toContain('desligado')
    expect(autoPublishBlockers(candidate(), { ...settings, ml_matt_tool: null }, RUN)).toContain('sem_etiqueta')
    expect(affiliateTagFrom({ ml_matt_word: 'ok', ml_matt_tool: 'x y' })).toBeNull()
  })
})

describe('selectAutoPublishBatch', () => {
  const list = [
    candidate({ id: 'a', score: 45 }),
    candidate({ id: 'b', score: 90 }),
    candidate({ id: 'c', score: 30 }),
    candidate({ id: 'd', score: 60 }),
    candidate({ id: 'e', score: 70, is_demo: true }),
  ]

  it('ordena por pontuação e aplica o limite por execução', () => {
    const batch = selectAutoPublishBatch(list, { ...settings, auto_publish_max_per_run: 2 }, RUN, 0)
    expect(batch.map((c) => c.id)).toEqual(['b', 'd'])
  })

  it('respeita o que resta do limite diário', () => {
    expect(selectAutoPublishBatch(list, { ...settings, auto_publish_max_per_day: 10 }, RUN, 9).map((c) => c.id)).toEqual(['b'])
    expect(selectAutoPublishBatch(list, { ...settings, auto_publish_max_per_day: 10 }, RUN, 10)).toEqual([])
  })

  it('não publica nada com a automação desligada', () => {
    expect(selectAutoPublishBatch(list, { ...settings, auto_publish_enabled: false }, RUN, 0)).toEqual([])
  })
})

describe('salvaguardas de qualidade (13/10/2026)', () => {
  it('manda para a fila manual descontos acima do teto configurado', () => {
    expect(autoPublishBlockers(candidate({ price: 70.23, original_price: 215.46 }), settings, RUN)).toContain('desconto_alto')
    expect(autoPublishBlockers(candidate({ price: 39.5, original_price: 99.9 }), settings, RUN)).toContain('desconto_alto')
    expect(autoPublishBlockers(candidate({ price: 91.41, original_price: 199.9 }), settings, RUN)).not.toContain('desconto_alto')
    expect(autoPublishBlockers(candidate({ original_price: null }), settings, RUN)).not.toContain('desconto_alto')
  })

  it('respeita o teto configurado no painel', () => {
    const relaxed = { ...settings, auto_publish_max_discount: 70 }
    expect(isAutoPublishEligible(candidate({ price: 39.5, original_price: 99.9 }), relaxed, RUN)).toBe(true)
  })

  it('bloqueia título estrangeiro só quando a opção está ligada', () => {
    const foreign = candidate({ score_breakdown: { desconto: 30, _alertas: ['titulo_estrangeiro'] } })
    expect(autoPublishBlockers(foreign, settings, RUN)).toContain('titulo_estrangeiro')
    expect(autoPublishBlockers(foreign, { ...settings, auto_publish_block_foreign_titles: false }, RUN)).not.toContain('titulo_estrangeiro')
  })
})
