import {expect, test} from '@playwright/test';

test.skip(process.env.RUN_SUPABASE_E2E !== '1', 'Requires the seeded local Supabase catalog');

test('bilingual catalog shows seeded products and a complete product detail', async ({page}) => {
  await page.goto('/en/shop');
  expect(await page.locator('.catalog-card').count()).toBeGreaterThanOrEqual(24);
  await page.getByRole('link', {name: 'Amber Veil', exact: true}).click();
  await expect(page).toHaveURL(/\/en\/products\/amber-veil$/);
  await expect(page.getByRole('heading', {name: 'Amber Veil', level: 1})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'The notes'})).toBeVisible();
  await page.goto('/ar/shop?q=عنبر');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.catalog-card').first()).toBeVisible();
});

test('shop filters family, occasion and price in both languages', async ({page}) => {
  await page.goto('/en/shop?family=amber%20floral&occasion=evening&maxPrice=90000');
  await expect(page.getByRole('link', {name: 'Amber Veil', exact: true})).toBeVisible();
  await page.goto('/ar/shop?maxPrice=1');
  await expect(page.getByRole('heading', {name: 'لم نعثر على عطور'})).toBeVisible();
});
