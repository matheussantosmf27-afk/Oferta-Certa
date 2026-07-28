import { getProductById } from './data'

import type { Database } from '@/types/supabase'

export async function registerClick(productId: string, request: Request) {
  const product = getProductById(productId)
  const url = new URL(request.url)
  const referrer = request.headers.get('referer') ?? null
  const campaign = url.searchParams.get('utm_campaign') ?? null
  const source = url.searchParams.get('utm_source') ?? null
  const medium = url.searchParams.get('utm_medium') ?? null
  const device = request.headers.get('user-agent') ?? null

  const payload: Database['public']['Tables']['clicks']['Insert'] = {
    product_id: product?.id ?? null,
    marketplace_id: product?.marketplace_id ?? null,
    referrer,
    source,
    medium,
    campaign,
    device_type: device,
    created_at: new Date().toISOString(),
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
    await fetch(`${supabaseUrl}/rest/v1/clicks`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    console.error('Failed to register click', error)
  }
}
