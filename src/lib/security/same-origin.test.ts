import {describe, expect, it} from 'vitest';
import {isSameOrigin} from './same-origin';

function request(origin: string | null, host = '127.0.0.1:3000', protocol = 'http') {
  const headers = new Headers({host, 'x-forwarded-proto': protocol});
  if (origin) headers.set('origin', origin);
  return new Request('http://localhost:3000/api/cart/items', {headers});
}

describe('same-origin mutation guard', () => {
  it('accepts the browser origin when the framework URL uses an internal host', () => {
    expect(isSameOrigin(request('http://127.0.0.1:3000'))).toBe(true);
  });
  it('rejects a different host, scheme, or missing origin', () => {
    expect(isSameOrigin(request('http://evil.example'))).toBe(false);
    expect(isSameOrigin(request('https://127.0.0.1:3000'))).toBe(false);
    expect(isSameOrigin(request(null))).toBe(false);
  });
});
