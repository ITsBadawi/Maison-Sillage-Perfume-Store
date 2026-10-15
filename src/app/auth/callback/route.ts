import {NextResponse, type NextRequest} from 'next/server';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {safeReturnTo} from '@/lib/auth/return-to';
import {getPublicEnv} from '@/lib/env.client';

export async function GET(request: NextRequest) {
  const rawNext = request.nextUrl.searchParams.get('next');
  const locale = rawNext?.startsWith('/en/') ? 'en' : 'ar';
  const next = safeReturnTo(rawNext, locale);
  const code = request.nextUrl.searchParams.get('code');
  const client = await createSupabaseServerClient();
  if (code && client) {
    const {error} = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, callbackOrigin(request)));
  }
  return NextResponse.redirect(new URL(`/${locale}/auth/login?error=confirmation`, callbackOrigin(request)));
}

function callbackOrigin(request: NextRequest): string {
  const configured = new URL(getPublicEnv().NEXT_PUBLIC_APP_URL);
  // In local Next.js development, request.url may say localhost even when the
  // browser visited 127.0.0.1. Keep the origin that owns the PKCE cookies.
  return request.headers.get('host') === configured.host ? configured.origin : request.nextUrl.origin;
}
