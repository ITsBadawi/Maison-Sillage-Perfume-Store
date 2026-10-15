import 'server-only';
import {timingSafeEqual} from 'node:crypto';
import {getServerEnv} from '@/lib/env.server';
import {dispatchPendingNotifications} from '@/lib/integrations/notification-dispatch.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request: Request, secret: string) {
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}

async function run(request: Request) {
  const env = getServerEnv();
  if (!env.CRON_SECRET || !authorized(request, env.CRON_SECRET)) {
    return Response.json({error: 'unauthorized'}, {status: 401, headers: {'cache-control': 'no-store'}});
  }
  try {
    const result = await dispatchPendingNotifications();
    return Response.json(result, {headers: {'cache-control': 'no-store'}});
  } catch {
    return Response.json({error: 'notification_worker_failed'}, {status: 503, headers: {'cache-control': 'no-store'}});
  }
}

export const GET = run;
export const POST = run;
