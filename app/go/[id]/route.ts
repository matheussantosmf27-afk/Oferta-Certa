import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { createPublicClient } from '@/lib/supabase/public'
import { registerClick } from '@/services/clicks'
import { isUuid } from '@/services/catalog'

export const dynamic = 'force-dynamic'

function isSafeHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const home = new URL('/', request.url)

  if (!isUuid(id)) return NextResponse.redirect(home)

  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_product_redirect', { p_product_id: id }).maybeSingle()

  if (error || !data || !isSafeHttpsUrl(data.affiliate_url)) {
    if (error) console.error('[go] falha ao resolver produto', error)
    return NextResponse.redirect(home)
  }

  after(() => registerClick({ productId: data.id, marketplaceId: data.marketplace_id, request }))

  const response = NextResponse.redirect(data.affiliate_url, 302)
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer-when-downgrade')
  return response
}
