import createMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import type { NextRequest } from 'next/server';
import { getPublicEnv } from './lib/env.client';
import {routing} from './i18n/routing';

export default async function proxy(request: NextRequest) {
  const env = getPublicEnv();
  let response = createMiddleware(routing)(request);

  // M0 remains runnable before Supabase is configured; when configured, refresh
  // the PKCE session cookies in the same response that carries locale routing.
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return response;
  }

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = createMiddleware(routing)(request);
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: '/((?!api|auth/callback|_next|_vercel|.*\\..*).*)',
};
