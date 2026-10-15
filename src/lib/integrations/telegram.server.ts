import 'server-only';

export type TelegramMessage = {chatId: string; text: string};
export type TelegramSender = (message: TelegramMessage) => Promise<string>;

export class TelegramDeliveryError extends Error {
  constructor(readonly kind: 'transient' | 'permanent' | 'rate_limited', readonly retryAfterSeconds?: number) {
    super('TELEGRAM_DELIVERY_FAILED');
  }
}

export function createTelegramSender(token: string, fetcher: typeof fetch = fetch): TelegramSender {
  return async ({chatId, text}) => {
    const response = await fetcher(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({chat_id: chatId, text, disable_web_page_preview: true}),
      signal: AbortSignal.timeout(10_000),
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || !isTelegramSuccess(body)) {
      const code = telegramErrorCode(body);
      const retryAfter = telegramRetryAfter(body);
      if (response.status === 429 || code === 429) throw new TelegramDeliveryError('rate_limited', retryAfter);
      if (response.status === 400 || response.status === 401 || response.status === 403 || code === 400 || code === 401 || code === 403) {
        throw new TelegramDeliveryError('permanent');
      }
      throw new TelegramDeliveryError('transient');
    }
    return String(body.result.message_id);
  };
}

function telegramErrorCode(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const code = (value as {error_code?: unknown}).error_code;
  return typeof code === 'number' && Number.isInteger(code) ? code : null;
}

function telegramRetryAfter(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const parameters = (value as {parameters?: unknown}).parameters;
  if (!parameters || typeof parameters !== 'object') return undefined;
  const seconds = (parameters as {retry_after?: unknown}).retry_after;
  return typeof seconds === 'number' && Number.isInteger(seconds) && seconds >= 0 ? seconds : undefined;
}

function isTelegramSuccess(value: unknown): value is {ok: true; result: {message_id: string | number}} {
  if (!value || typeof value !== 'object') return false;
  const result = (value as {result?: unknown}).result;
  return (value as {ok?: unknown}).ok === true && !!result && typeof result === 'object' &&
    (typeof (result as {message_id?: unknown}).message_id === 'string' || typeof (result as {message_id?: unknown}).message_id === 'number');
}
