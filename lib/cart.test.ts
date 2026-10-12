import { beforeEach, describe, expect, it } from 'vitest'
import {
  CART_MAX_QUANTITY,
  addToCart,
  cartCount,
  cartTotal,
  keepAvailable,
  markSentToCheckout,
  nextToCheckout,
  parseCart,
  readCart,
  removeFromCart,
  setCartQuantity,
  updateCart,
} from './cart'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const now = new Date('2026-10-12T12:00:00Z')

describe('operações do carrinho', () => {
  it('adiciona e soma quantidade do mesmo produto, com teto', () => {
    let cart = addToCart([], A, 1, now)
    cart = addToCart(cart, A, 2, now)
    expect(cart).toEqual([{ productId: A, quantity: 3, sentToCheckout: false, addedAt: now.toISOString() }])
    expect(addToCart(cart, A, 99, now)[0].quantity).toBe(CART_MAX_QUANTITY)
  })

  it('ignora id inválido', () => {
    expect(addToCart([], 'nao-e-uuid')).toEqual([])
  })

  it('altera quantidade (mínimo 1), remove e conta', () => {
    let cart = addToCart(addToCart([], A, 1, now), B, 2, now)
    cart = setCartQuantity(cart, A, 0)
    expect(cart[0].quantity).toBe(1)
    expect(cartCount(cart)).toBe(3)
    expect(removeFromCart(cart, A).map((item) => item.productId)).toEqual([B])
  })

  it('calcula o total sem erro de arredondamento', () => {
    const cart = addToCart(addToCart([], A, 3, now), B, 1, now)
    expect(cartTotal(cart, new Map([[A, 0.1], [B, 19.99]]))).toBe(20.29)
  })

  it('segue a ordem de finalização e reabre item adicionado de novo', () => {
    let cart = addToCart(addToCart([], A, 1, now), B, 1, now)
    expect(nextToCheckout(cart)?.productId).toBe(A)
    cart = markSentToCheckout(cart, A)
    expect(nextToCheckout(cart)?.productId).toBe(B)
    cart = markSentToCheckout(cart, B)
    expect(nextToCheckout(cart)).toBeNull()
    expect(addToCart(cart, A, 1, now).find((item) => item.productId === A)?.sentToCheckout).toBe(false)
  })

  it('descarta produtos que saíram do site', () => {
    const cart = addToCart(addToCart([], A, 1, now), B, 1, now)
    expect(keepAvailable(cart, [B]).map((item) => item.productId)).toEqual([B])
  })
})

describe('leitura do armazenamento', () => {
  beforeEach(() => window.localStorage.clear())

  it('tolera lixo e duplicados', () => {
    expect(parseCart('x')).toEqual([])
    expect(parseCart([{ productId: A, quantity: '2' }, { productId: A, quantity: 5 }, { productId: 'x' }, null])).toEqual([
      { productId: A, quantity: 2, sentToCheckout: false, addedAt: new Date(0).toISOString() },
    ])
  })

  it('grava e lê do localStorage', () => {
    updateCart((items) => addToCart(items, A, 2, now))
    expect(readCart()).toEqual([{ productId: A, quantity: 2, sentToCheckout: false, addedAt: now.toISOString() }])
    window.localStorage.setItem('oferta-certa-cart', '{quebrado')
    expect(Array.isArray(readCart())).toBe(true)
  })
})
