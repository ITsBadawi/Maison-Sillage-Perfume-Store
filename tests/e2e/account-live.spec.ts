import {expect, test} from '@playwright/test';

test.skip(process.env.RUN_SUPABASE_E2E !== '1', 'Requires local Supabase');

test('saved delivery addresses remain private to their owner', async ({page}) => {
  const firstEmail = `address-one-${Date.now()}@example.test`;
  const secondEmail = `address-two-${Date.now()}@example.test`;
  const password = 'SillageDemo#2026';
  const origin = 'http://127.0.0.1:3000';
  const address = {recipient_name: 'First Buyer', phone: '+9647701234567', city: 'Baghdad', district: 'Mansour', street: 'Street 12, House 4', landmark: ''};

  async function register(email: string) {
    await page.goto('/en/auth/register');
    await page.getByLabel('Full name').fill('Demo Buyer');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', {name: 'Create account'}).click();
    await expect(page).toHaveURL(/\/en\/account$/);
  }

  await register(firstEmail);
  const created = await page.request.post('/api/account/addresses', {headers: {origin}, data: address});
  expect(created.status(), await created.text()).toBe(201);
  const firstId = (await created.json() as {data: {id: string}}).data.id;
  await page.reload();
  await expect(page.getByText('Street 12, House 4')).toBeVisible();
  await page.getByRole('button', {name: 'Sign out'}).click();

  await register(secondEmail);
  const secondList = await page.request.get('/api/account/addresses');
  expect((await secondList.json() as {data: unknown[]}).data).toEqual([]);
  const attemptedUpdate = await page.request.put(`/api/account/addresses/${firstId}`, {headers: {origin}, data: {...address, street: 'Changed by another user'}});
  expect(attemptedUpdate.status()).toBe(200);
  await page.getByRole('button', {name: 'Sign out'}).click();

  await page.goto('/en/auth/login');
  await page.getByLabel('Email address').fill(firstEmail);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', {name: 'Sign in'}).click();
  await expect(page).toHaveURL(/\/en\/account$/);
  const firstList = await page.request.get('/api/account/addresses');
  expect(firstList.status(), await firstList.text()).toBe(200);
  const saved = (await firstList.json() as {data: Array<{id: string; street: string}>}).data;
  expect(saved).toContainEqual(expect.objectContaining({id: firstId, street: 'Street 12, House 4'}));
});

test('customer can save and remove a fragrance across reloads', async ({page}) => {
  await page.goto('/en/auth/register');
  await page.getByLabel('Full name').fill('Favorites Buyer');
  await page.getByLabel('Email address').fill(`favorites-${Date.now()}@example.test`);
  await page.getByLabel('Password').fill('SillageDemo#2026');
  await page.getByRole('button', {name: 'Create account'}).click();
  await expect(page).toHaveURL(/\/en\/account$/);

  await page.goto('/en/products/amber-veil');
  await page.getByRole('button', {name: 'Save fragrance'}).click();
  await expect(page.getByRole('button', {name: 'Remove from saved'})).toBeVisible();
  await page.goto('/en/account/favorites');
  await expect(page.getByRole('link', {name: 'Amber Veil'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', {name: 'Amber Veil'})).toBeVisible();
  await page.getByRole('button', {name: 'Remove from saved'}).click();
  await expect(page.getByRole('button', {name: 'Remove from saved'})).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('No saved fragrances yet.')).toBeVisible();
});
