import {NextResponse, type NextRequest} from 'next/server';
import {AdvisorError} from './service.server';
import {isSameOrigin} from '@/lib/security/same-origin';

export function sameOrigin(request: NextRequest) {
  return isSameOrigin(request);
}

export function advisorError(error: unknown, requestId: string) {
  const code = error instanceof AdvisorError ? error.code : error instanceof Error && error.name === 'ZodError' ? 'invalid' : 'database';
  const status = code === 'unavailable' ? 503 : code === 'not_found' ? 404 : code === 'expired' ? 410 : code === 'invalid' ? 400 : code === 'incomplete' ? 422 : code === 'no_matches' ? 422 : 500;
  return NextResponse.json({ok: false, error: {code, messageKey: `advisor.errors.${code}`}, requestId}, {status, headers: {'cache-control': 'no-store'}});
}

export function success(data: unknown, status = 200) {
  return NextResponse.json({ok: true, data}, {status, headers: {'cache-control': 'no-store'}});
}
