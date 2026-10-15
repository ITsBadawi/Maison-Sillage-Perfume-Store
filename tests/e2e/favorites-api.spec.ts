import {expect, test} from '@playwright/test';

test('favorite mutation requires a signed-in customer', async ({request}) => {
  const response = await request.put('/api/favorites/00000000-0000-4000-8000-000000000001', {
    headers: {'Origin': 'http://127.0.0.1:3000'},
  });
  expect(response.status()).toBe(401);
});
