import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { createPublicClient } from '@/lib/supabase/public'
import { registerClick } from '@/services/clicks'
import { isUuid } from '@/services/catalog'
import { isAllowedAffiliateUrl } from '@/lib/redirect'

export const dynamic = 'force-dynamic'

/**
 * "Comprar": leva ao link de afiliado cadastrado do produto ativo. O destino precisa ser https e de um
 * domínio de afiliado da loja do produto; senão o visitante volta para o site (nunca para um destino estranho).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const home = new URL('/', request.url)

  if (!isUuid(id)) return NextResponse.redirect(home)

  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_product_redirect', { p_product_id: id }).maybeSingle()
  if (error || !data) {
    if (error) console.error('[go] falha ao resolver produto', error.message)
    return NextResponse.redirect(home)
  }

  const { data: marketplace } = await supabase.from('marketplaces').select('affiliate_hosts').eq('id', data.marketplace_id).maybeSingle()
  if (!isAllowedAffiliateUrl(data.affiliate_url, marketplace?.affiliate_hosts ?? [])) {
    console.error('[go] destino recusado para o produto', data.id)
    return NextResponse.redirect(home)
  }

  after(() => registerClick({ productId: data.id, marketplaceId: data.marketplace_id, request }))

  const response = NextResponse.redirect(data.affiliate_url, 302)
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer-when-downgrade')
  return response
}
