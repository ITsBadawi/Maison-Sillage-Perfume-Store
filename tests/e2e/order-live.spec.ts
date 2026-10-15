import {expect, test} from '@playwright/test';
import {existsSync} from 'node:fs';
import {ensureAmberVeilStock} from './demo-stock';

test.skip(process.env.RUN_SUPABASE_E2E !== '1' || !existsSync('demo-credentials.local.json'), 'Requires the seeded local Supabase stack and demo staff');

test('customer orders a stocked perfume with coupon and cash on delivery', async ({page, browser}) => {
  test.setTimeout(90_000);
  await ensureAmberVeilStock(browser);
  const email = `order-${Date.now()}@example.test`;
  await page.goto('/en/auth/register');
  await page.getByLabel('Full name').fill('Demo Buyer');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill('SillageDemo#2026');
  await page.getByRole('button', {name: 'Create account'}).click();
  await expect(page).toHaveURL('http://127.0.0.1:3000/en/account');

  await page.goto('/en/products/amber-veil');
  const addResponse = page.waitForResponse((response) => response.url().endsWith('/api/cart/items') && response.request().method() === 'PUT');
  await page.getByRole('button', {name: 'Add to bag'}).click();
  const addResult = await addResponse;
  expect(addResult.status()).toBe(200);
  await expect(page.getByRole('status')).toContainText('Added to your bag');
  const cartResponse = await page.request.get('/api/cart');
  expect(cartResponse.status(), await cartResponse.text()).toBe(200);
  await page.getByRole('link', {name: 'View bag'}).click();
  await expect(page.getByRole('heading', {name: 'Amber Veil'})).toBeVisible();
  await page.getByRole('link', {name: 'Continue to checkout'}).click();
  await expect(page.getByRole('heading', {name: 'Delivery details'})).toBeVisible();
  await page.getByLabel('Recipient name').fill('Demo Buyer');
  await page.getByLabel('Phone in international format').fill('+9647701234567');
  await page.getByLabel('City').fill('Baghdad');
  await page.getByLabel('District').fill('Mansour');
  await page.getByLabel('Street and building').fill('Street 14, Building 8');
  await page.getByLabel('Coupon code').fill('WELCOME10');
  await page.getByRole('button', {name: 'Update quote'}).click();
  await expect(page.getByRole('button', {name: 'Place COD order'})).toBeEnabled();
  await page.getByRole('button', {name: 'Place COD order'}).click();
  await expect(page).toHaveURL(/\/en\/orders\/[0-9a-f-]{36}$/);
  await expect(page.getByText('Cash on delivery')).toBeVisible();
  await page.goto('/en/account/orders');
  await expect(page.locator('.account-list li').first()).toBeVisible();
});
