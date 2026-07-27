import { NextResponse } from 'next/server'
import { getProductById } from '@/services/data'
import { registerClick } from '@/services/clicks'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const product = getProductById(id)
  if (!product) {
    return NextResponse.redirect(new URL('/', _request.url))
  }

  await registerClick(product.id, _request)

  return NextResponse.redirect(new URL(product.affiliate_url))
}
