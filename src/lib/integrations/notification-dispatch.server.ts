import 'server-only';

import {createClient} from '@supabase/supabase-js';
import {getPublicEnv} from '@/lib/env.client';
import {getServerEnv} from '@/lib/env.server';
import {deliverPendingNotifications, type OutboxStore} from './notification-worker.server';
import {createTelegramSender} from './telegram.server';

export async function dispatchPendingNotifications() {
  const publicEnv = getPublicEnv();
  const env = getServerEnv();
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL || !env.TELEGRAM_BOT_TOKEN || !env.SUPABASE_SECRET_KEY) {
    throw new Error('NOTIFICATION_WORKER_UNAVAILABLE');
  }
  const supabase = createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {auth: {persistSession: false, autoRefreshToken: false}});
  const store: OutboxStore = {
    async claim() {
      const {data, error} = await supabase.rpc('claim_order_notifications');
      if (error || !Array.isArray(data)) throw new Error('OUTBOX_CLAIM_FAILED');
      return data;
    },
    async markSent(id, messageId) {
      const {error} = await supabase.rpc('complete_order_notification', {p_id: id, p_message_id: messageId});
      if (error) throw new Error('OUTBOX_COMPLETE_FAILED');
    },
    async markFailed(id, options) {
      const {error} = await supabase.rpc('fail_order_notification', {
        p_id: id, p_error_code: options.errorCode,
        p_retry_after_seconds: options.retryAfterSeconds ?? null, p_permanent: options.permanent,
      });
      if (error) throw new Error('OUTBOX_FAILURE_UPDATE_FAILED');
    },
  };
  return deliverPendingNotifications(store, createTelegramSender(env.TELEGRAM_BOT_TOKEN), publicEnv.NEXT_PUBLIC_APP_URL);
}
