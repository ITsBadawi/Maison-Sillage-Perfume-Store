import 'server-only';
import {createHmac, randomUUID} from 'node:crypto';
import {CheckoutError} from './service.server';
import {getServerEnv} from '@/lib/env.server';
import {isSameOrigin} from '@/lib/security/same-origin';

const statuses: Record<string, number> = {
  AUTH_REQUIRED: 401, EMAIL_UNCONFIRMED: 403, ORDER_NOT_FOUND: 404,
  IDEMPOTENCY_CONFLICT: 409, STOCK_CHANGED: 409, PRICE_CHANGED: 409,
  QUOTE_EXPIRED: 409, QUOTE_INVALID: 422, COUPON_INVALID: 422,
  COUPON_LIMIT_REACHED: 422, INVALID_QUANTITY: 422, INVALID_ITEMS: 400,
  DUPLICATE_VARIANT: 400, PRODUCT_UNAVAILABLE: 422, SHIPPING_ZONE_INVALID: 422,
  RATE_LIMITED: 429,
  CSRF_REJECTED: 403,
};

export function jsonError(error: unknown) {
  const requestId = randomUUID();
  const code = error instanceof CheckoutError ? error.code : 'INTERNAL_ERROR';
  return Response.json({ok: false, error: {code, messageKey: `checkout.${code}`, ...(code === 'RATE_LIMITED' ? {retryAfterSeconds: 60} : {})}, requestId}, {status: statuses[code] ?? (code === 'CHECKOUT_UNAVAILABLE' ? 503 : 500)});
}

export function jsonSuccess(data: unknown, status = 200) {
  return Response.json({ok: true, data, requestId: randomUUID()}, {status, headers: {'Cache-Control': 'no-store'}});
}

export function sameOrigin(request: Request) {
  return isSameOrigin(request);
}

export function getClientIpDigest(request: Request) {
  const salt = getServerEnv().RATE_LIMIT_SALT;
  if (!salt) throw new CheckoutError('CHECKOUT_UNAVAILABLE');
  const ip = request.headers.get('x-real-ip')?.trim() || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  return createHmac('sha256', salt).update(ip).digest('hex');
}

export async function readJson(request: Request): Promise<unknown> {
  if (!sameOrigin(request)) throw new CheckoutError('CSRF_REJECTED');
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) throw new CheckoutError('INVALID_BODY');
  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > 16_384) throw new CheckoutError('INVALID_BODY');
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 16_384) throw new CheckoutError('INVALID_BODY');
  try { return JSON.parse(text) as unknown; } catch { throw new CheckoutError('INVALID_BODY'); }
}
