import {expect, test} from '@playwright/test';

test.skip(process.env.RUN_CONFIRMATION_E2E !== '1', 'Requires local Supabase with email confirmations enabled and Mailpit');

test('new customer confirms their email and reaches the account', async ({page, request}) => {
  test.setTimeout(90_000);
  const email = `confirm-${Date.now()}@example.test`;
  await page.goto('/en/auth/register');
  await page.getByLabel('Full name').fill('Confirmation Buyer');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill('SillageDemo#2026');
  await page.getByRole('button', {name: 'Create account'}).click();
  await expect(page.getByRole('status')).toContainText('email');

  let emailHtml = '';
  await expect.poll(async () => {
    const response = await request.get(`http://127.0.0.1:54324/view/latest.html?query=to:${encodeURIComponent(email)}`);
    if (response.ok()) emailHtml = await response.text();
    return response.status();
  }, {timeout: 20_000}).toBe(200);
  const link = emailHtml.match(/https?:\/\/[^"'<>\s]+\/auth\/v1\/verify[^"'<>\s]*/)?.[0]?.replaceAll('&amp;', '&');
  expect(link).toBeTruthy();
  await page.goto(link!);
  await expect.poll(() => new URL(page.url()).pathname).toBe('/en/account');
  await expect(page.getByText(email)).toBeVisible();
});

test('guest bag reaches the account after email confirmation', async ({page, request}) => {
  test.setTimeout(90_000);
  const email = `confirm-bag-${Date.now()}@example.test`;
  await page.goto('/en/products/amber-veil');
  await page.getByRole('button', {name: 'Add to bag'}).click();
  await expect(page.getByRole('status')).toContainText('Added to your bag');
  await page.goto('/en/auth/register?returnTo=%2Fen%2Fcart');
  await page.getByLabel('Full name').fill('Confirmation Buyer');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill('SillageDemo#2026');
  await page.getByRole('button', {name: 'Create account'}).click();
  await expect(page.getByRole('status')).toContainText('email');

  let emailHtml = '';
  await expect.poll(async () => {
    const response = await request.get(`http://127.0.0.1:54324/view/latest.html?query=to:${encodeURIComponent(email)}`);
    if (response.ok()) emailHtml = await response.text();
    return response.status();
  }, {timeout: 20_000}).toBe(200);
  const link = emailHtml.match(/https?:\/\/[^"'<>\s]+\/auth\/v1\/verify[^"'<>\s]*/)?.[0]?.replaceAll('&amp;', '&');
  expect(link).toBeTruthy();
  await page.goto(link!);
  await expect.poll(() => new URL(page.url()).pathname).toBe('/en/cart');
  await expect(page.getByRole('heading', {name: 'Amber Veil'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', {name: 'Amber Veil'})).toBeVisible();
  const saved = await page.request.get('/api/cart');
  expect(saved.status()).toBe(200);
  expect((await saved.json() as {data:{items:unknown[]}}).data.items).toHaveLength(1);
});
