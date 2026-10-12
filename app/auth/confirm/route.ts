import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { safeNextPath } from '@/lib/auth'

/** Recebe os links de confirmação de e-mail e de recuperação de senha. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const next = safeNextPath(searchParams.get('next'))
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  const supabase = await createServerClient()
  let ok = false

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    ok = !error
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    ok = !error
  }

  const target = ok ? new URL(next, request.nextUrl.origin) : new URL('/login?erro=link-invalido', request.nextUrl.origin)
  return NextResponse.redirect(target)
}
