import 'server-only';
import {TelegramDeliveryError, type TelegramSender} from './telegram.server';

export type ClaimedNotification = {
  outbox_id: string;
  chat_id: string;
  include_customer_details: boolean;
  order: {
    id: string; public_number: string; created_at: string; total_minor: string | number; currency_code: string; currency_exponent: number;
    recipient_name: string; phone: string; address_snapshot: unknown;
    items: Array<{name_en_snapshot: string; name_ar_snapshot: string; quantity: number; line_total_minor: string | number}>;
  };
};
export type OutboxStore = {
  claim(): Promise<ClaimedNotification[]>;
  markSent(id: string, messageId: string): Promise<void>;
  markFailed(id: string, options: {errorCode: 'telegram_delivery_failed' | 'telegram_rate_limited' | 'telegram_permanent_error'; retryAfterSeconds?: number; permanent: boolean}): Promise<void>;
};

export function renderOrderNotification(item: ClaimedNotification, appUrl?: string) {
  const order = item.order;
  const money = (minor: string | number) => {
    const value = BigInt(minor);
    const divisor = BigInt(10) ** BigInt(order.currency_exponent);
    const whole = value / divisor;
    const fraction = value % divisor;
    return `${whole.toLocaleString('en-US')}${fraction === BigInt(0) ? '' : `.${fraction.toString().padStart(order.currency_exponent, '0').replace(/0+$/, '')}`} ${order.currency_code}`;
  };
  const lines = order.items.map((line) => `• ${line.name_en_snapshot} × ${line.quantity} — ${money(line.line_total_minor)}`);
  const details = item.include_customer_details
    ? `\nCustomer: ${order.recipient_name}\nPhone: ${order.phone}\nAddress: ${JSON.stringify(order.address_snapshot)}`
    : '';
  const snapshot = order.address_snapshot && typeof order.address_snapshot === 'object' ? order.address_snapshot as Record<string, unknown> : {};
  const city = typeof snapshot.city === 'string' ? `\nCity: ${snapshot.city}` : '';
  const adminLink = appUrl ? `\nOpen order in admin: ${new URL(`/ar/admin/orders/${encodeURIComponent(order.id)}`, appUrl).toString()}` : '';
  const message = [`New order ${order.public_number}`, ...lines, `Total: ${money(order.total_minor)}`, `Payment: Cash on delivery${city}${details}${adminLink}`].join('\n');
  if (message.length <= 4096) return message;
  let truncated = message.slice(0, 4095);
  if (/^[\uD800-\uDBFF]$/.test(truncated.at(-1) ?? '')) truncated = truncated.slice(0, -1);
  return `${truncated}…`;
}

export async function deliverPendingNotifications(store: OutboxStore, send: TelegramSender, appUrl?: string) {
  const notifications = await store.claim();
  let sent = 0;
  let failed = 0;
  for (const item of notifications) {
    try {
      const messageId = await send({chatId: item.chat_id, text: renderOrderNotification(item, appUrl)});
      await store.markSent(item.outbox_id, messageId);
      sent++;
    } catch (error) {
      failed++;
      const options = error instanceof TelegramDeliveryError
        ? {
          errorCode: error.kind === 'permanent' ? 'telegram_permanent_error' as const : error.kind === 'rate_limited' ? 'telegram_rate_limited' as const : 'telegram_delivery_failed' as const,
          retryAfterSeconds: error.retryAfterSeconds,
          permanent: error.kind === 'permanent',
        }
        : {errorCode: 'telegram_delivery_failed' as const, permanent: false};
      try { await store.markFailed(item.outbox_id, options); } catch { /* The lease expires and permits a later retry. */ }
    }
  }
  return {processed: notifications.length, sent, failed};
}
