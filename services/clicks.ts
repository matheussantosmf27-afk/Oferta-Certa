import { createAdminClient } from '@/lib/supabase/admin'

function deviceType(userAgent: string | null): string | null {
  if (!userAgent) return null
  if (/bot|crawler|spider|preview/i.test(userAgent)) return 'bot'
  if (/mobile|android|iphone|ipod/i.test(userAgent)) return 'mobile'
  if (/ipad|tablet/i.test(userAgent)) return 'tablet'
  return 'desktop'
}

/**
 * Registra o clique NO SERVIDOR com a service role.
 * Se a chave não estiver configurada, apenas avisa: o redirecionamento nunca é bloqueado.
 */
export async function registerClick(params: { productId: string; marketplaceId: string; request: Request }) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[clicks] SUPABASE_SERVICE_ROLE_KEY ausente; clique não registrado')
    return
  }

  const url = new URL(params.request.url)
  const userAgent = params.request.headers.get('user-agent')
  const type = deviceType(userAgent)
  if (type === 'bot') return

  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('clicks').insert({
      product_id: params.productId,
      marketplace_id: params.marketplaceId,
      referrer: params.request.headers.get('referer')?.slice(0, 500) ?? null,
      source: url.searchParams.get('utm_source')?.slice(0, 100) ?? null,
      medium: url.searchParams.get('utm_medium')?.slice(0, 100) ?? null,
      campaign: url.searchParams.get('utm_campaign')?.slice(0, 100) ?? null,
      device_type: type,
    })
    if (error) console.error('[clicks] falha ao registrar', error)
  } catch (error) {
    console.error('[clicks] falha ao registrar', error)
  }
}
