import {placeOrderSchema} from '@/features/checkout/schemas';
import {listOrders, placeOrder, CheckoutError} from '@/features/checkout/service.server';
import {getClientIpDigest, jsonError, jsonSuccess, readJson} from '@/features/checkout/http.server';
import {after} from 'next/server';
import {dispatchPendingNotifications} from '@/lib/integrations/notification-dispatch.server';
import {getServerEnv} from '@/lib/env.server';

export async function GET() {
  try { return jsonSuccess(await listOrders()); } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    const parsed = placeOrderSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new CheckoutError('INVALID_BODY');
    const key = request.headers.get('idempotency-key');
    if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) throw new CheckoutError('INVALID_IDEMPOTENCY');
    const result = await placeOrder(parsed.data, key, getClientIpDigest(request));
    if (!result.replayed && getServerEnv().TELEGRAM_BOT_TOKEN) {
      after(async () => { try { await dispatchPendingNotifications(); } catch { /* The outbox stays pending for the scheduled worker. */ } });
    }
    return jsonSuccess(result, result.replayed ? 200 : 201);
  } catch (error) { return jsonError(error); }
}
