import { NextResponse } from 'next/server'
import { getProductsByIds } from '@/services/catalog'

/** Produtos públicos por id (usado pelos favoritos de visitantes sem conta). */
export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get('ids') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 100)

  const products = await getProductsByIds(ids)
  return NextResponse.json({ products }, { headers: { 'Cache-Control': 'public, s-maxage=60' } })
}
