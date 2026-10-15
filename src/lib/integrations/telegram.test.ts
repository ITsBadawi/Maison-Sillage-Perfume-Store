import {describe, expect, it, vi} from 'vitest';
vi.mock('server-only', () => ({}));
import {createTelegramSender} from './telegram.server';
import {deliverPendingNotifications, renderOrderNotification, type ClaimedNotification, type OutboxStore} from './notification-worker.server';

const notification: ClaimedNotification = {
  outbox_id: 'outbox-1', chat_id: 'private-chat', include_customer_details: false,
  order: {id: 'order-uuid', public_number: 'MS-2026-001', created_at: '2026-10-02T10:00:00Z', total_minor: '125000000', currency_code: 'IQD', currency_exponent: 3, recipient_name: 'Name', phone: '07700000000', address_snapshot: {city: 'Baghdad'}, items: [{name_en_snapshot: '<Perfume>', name_ar_snapshot: 'عطر', quantity: 2, line_total_minor: '125000000'}]},
};

describe('Telegram notification delivery', () => {
  it('posts through the injected transport and returns Telegram message id', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ok: true, result: {message_id: 42}}), {status: 200}));
    const send = createTelegramSender('secret-token', fetcher);
    await expect(send({chatId: 'chat-1', text: 'hello'})).resolves.toBe('42');
    expect(fetcher).toHaveBeenCalledWith('https://api.telegram.org/botsecret-token/sendMessage', expect.objectContaining({method: 'POST'}));
  });

  it('classifies Telegram 429 responses and preserves retry_after', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ok: false, error_code: 429, parameters: {retry_after: 37}}), {status: 429}));
    await expect(createTelegramSender('secret-token', fetcher)({chatId: 'chat-1', text: 'hello'})).rejects.toMatchObject({kind: 'rate_limited', retryAfterSeconds: 37});
  });

  it('classifies invalid Telegram channel responses as permanent', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ok: false, error_code: 400, description: 'chat not found'}), {status: 400}));
    await expect(createTelegramSender('secret-token', fetcher)({chatId: 'bad-chat', text: 'hello'})).rejects.toMatchObject({kind: 'permanent'});
  });

  it('marks successful messages sent and records only generic delivery failures', async () => {
    const store: OutboxStore = {claim: vi.fn().mockResolvedValue([notification]), markSent: vi.fn(), markFailed: vi.fn()};
    const send = vi.fn().mockResolvedValue('123');
    await expect(deliverPendingNotifications(store, send, 'https://store.example')).resolves.toEqual({processed: 1, sent: 1, failed: 0});
    expect(store.markSent).toHaveBeenCalledWith('outbox-1', '123');
    expect(send.mock.calls[0]?.[0].text).toContain('<Perfume>');
    expect(send.mock.calls[0]?.[0].text).not.toContain('07700000000');
    expect(send.mock.calls[0]?.[0].text).toContain('125,000 IQD');
    expect(send.mock.calls[0]?.[0].text).toContain('City: Baghdad');
    expect(send.mock.calls[0]?.[0].text).toContain('https://store.example/ar/admin/orders/order-uuid');

    const failedStore: OutboxStore = {claim: vi.fn().mockResolvedValue([notification]), markSent: vi.fn(), markFailed: vi.fn()};
    await expect(deliverPendingNotifications(failedStore, vi.fn().mockRejectedValue(new Error('private upstream response')))).resolves.toEqual({processed: 1, sent: 0, failed: 1});
    expect(failedStore.markFailed).toHaveBeenCalledWith('outbox-1', {errorCode: 'telegram_delivery_failed', permanent: false});

    const blockedStore: OutboxStore = {claim: vi.fn().mockResolvedValue([notification]), markSent: vi.fn(), markFailed: vi.fn()};
    const {TelegramDeliveryError} = await import('./telegram.server');
    await deliverPendingNotifications(blockedStore, vi.fn().mockRejectedValue(new TelegramDeliveryError('permanent')));
    expect(blockedStore.markFailed).toHaveBeenCalledWith('outbox-1', {errorCode: 'telegram_permanent_error', retryAfterSeconds: undefined, permanent: true});

    const limitedStore: OutboxStore = {claim: vi.fn().mockResolvedValue([notification]), markSent: vi.fn(), markFailed: vi.fn()};
    await deliverPendingNotifications(limitedStore, vi.fn().mockRejectedValue(new TelegramDeliveryError('rate_limited', 37)));
    expect(limitedStore.markFailed).toHaveBeenCalledWith('outbox-1', {errorCode: 'telegram_rate_limited', retryAfterSeconds: 37, permanent: false});
  });

  it('keeps the plain text message within Telegram’s limit', () => {
    const oversized = {...notification, order: {...notification.order, items: Array.from({length: 20}, (_, index) => ({name_en_snapshot: `Perfume ${index} ${'x'.repeat(500)}`, name_ar_snapshot: 'عطر', quantity: 10, line_total_minor: '100000'}))}};
    const message = renderOrderNotification(oversized, 'https://store.example');
    expect(message.length).toBeLessThanOrEqual(4096);
    expect(message.endsWith('…')).toBe(true);
  });
});
