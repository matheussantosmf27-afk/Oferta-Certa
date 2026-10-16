import { describe, expect, it } from 'vitest'
import { pageWindow, parseSearchState, searchHref, totalPages } from './search-params'

describe('parseSearchState', () => {
  it('lê os parâmetros válidos', () => {
    expect(parseSearchState({ q: '  Galaxy   S25 ', categoria: 'celulares', marca: 'Samsung', ordem: 'menor-preco', pagina: '3' })).toEqual({
      q: 'Galaxy S25',
      categoria: 'celulares',
      marca: 'Samsung',
      ordem: 'menor-preco',
      pagina: 3,
    })
  })

  it('valores inválidos voltam ao padrão', () => {
    expect(parseSearchState({ categoria: "x'; drop", ordem: 'qualquer', pagina: '-2' })).toEqual({
      q: '',
      categoria: null,
      marca: null,
      ordem: 'relevancia',
      pagina: 1,
    })
    expect(parseSearchState({ pagina: '99999' }).pagina).toBe(100)
    expect(parseSearchState({ q: ['iphone', 'outro'] }).q).toBe('iphone')
    expect(parseSearchState({ q: 'a'.repeat(300) }).q).toHaveLength(100)
  })
})

describe('searchHref', () => {
  const state = parseSearchState({ q: 'notebook lenovo', categoria: 'informatica', ordem: 'menor-preco', pagina: '2' })

  it('preserva os filtros ao trocar de página', () => {
    expect(searchHref(state, { pagina: 3 })).toBe('/buscar?q=notebook+lenovo&categoria=informatica&ordem=menor-preco&pagina=3')
  })

  it('trocar filtro ou ordem volta para a página 1', () => {
    expect(searchHref(state, { marca: 'Lenovo' })).toBe('/buscar?q=notebook+lenovo&categoria=informatica&marca=Lenovo&ordem=menor-preco')
    expect(searchHref(state, { ordem: 'relevancia' })).toBe('/buscar?q=notebook+lenovo&categoria=informatica')
  })

  it('remove filtros e omite padrões', () => {
    expect(searchHref(state, { categoria: null, ordem: 'relevancia' })).toBe('/buscar?q=notebook+lenovo')
    expect(searchHref(parseSearchState({}))).toBe('/buscar')
  })
})

describe('paginação', () => {
  it('total de páginas', () => {
    expect(totalPages(0)).toBe(1)
    expect(totalPages(24)).toBe(1)
    expect(totalPages(25)).toBe(2)
    expect(totalPages(100_000)).toBe(100)
  })

  it('janela de páginas com reticências', () => {
    expect(pageWindow(1, 1)).toEqual([1])
    expect(pageWindow(1, 5)).toEqual([1, 2, null, 5])
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10])
    expect(pageWindow(10, 10)).toEqual([1, null, 9, 10])
  })
})
