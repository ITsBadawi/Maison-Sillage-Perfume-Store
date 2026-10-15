import {expect, test} from '@playwright/test';

test.skip(process.env.RUN_SUPABASE_E2E !== '1', 'Run against a configured local Supabase stack');

test('customer can register, sign out, and sign in again', async ({page}) => {
  const email = `mvp-${Date.now()}@example.test`;
  const password = 'SillageDemo#2026';
  await page.goto('/en/auth/register');
  await page.getByLabel('Full name').fill('Demo Customer');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', {name: 'Create account'}).click();
  await expect(page).toHaveURL('http://127.0.0.1:3000/en/account');
  await expect(page.getByText(email)).toBeVisible();

  await page.getByRole('button', {name: 'Sign out'}).click();
  await expect(page).toHaveURL(/\/en$/);
  await page.goto('/en/auth/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', {name: 'Sign in'}).click();
  await expect(page).toHaveURL('http://127.0.0.1:3000/en/account');
  await expect(page.getByText(email)).toBeVisible();
});

test('guest bag survives immediate registration and merges into the account', async ({page}) => {
  await page.goto('/en/products/amber-veil');
  await page.getByRole('button', {name: 'Add to bag'}).click();
  await expect(page.getByRole('status')).toContainText('Added to your bag');
  await page.goto('/en/auth/register?returnTo=%2Fen%2Fcart');
  await page.getByLabel('Full name').fill('Guest Buyer');
  await page.getByLabel('Email address').fill(`guest-${Date.now()}@example.test`);
  await page.getByLabel('Password').fill('SillageDemo#2026');
  await page.getByRole('button', {name: 'Create account'}).click();
  await expect(page).toHaveURL(/\/en\/cart$/);
  await expect(page.getByRole('heading', {name: 'Amber Veil'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', {name: 'Amber Veil'})).toBeVisible();
});
