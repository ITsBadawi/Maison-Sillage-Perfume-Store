import {expect, test} from '@playwright/test';

test('customer orders and favorites require sign-in', async ({page}) => {
  await page.goto('/ar/account/orders');
  await expect(page).toHaveURL(/\/ar\/auth\/login\?returnTo=%2Far%2Faccount%2Forders$/);
  await page.goto('/en/account/favorites');
  await expect(page).toHaveURL(/\/en\/auth\/login\?returnTo=%2Fen%2Faccount%2Ffavorites$/);
});

test('new customer sees their own empty order and favorite lists', async ({page}) => {
  test.skip(process.env.RUN_SUPABASE_E2E !== '1', 'Requires local Supabase');
  const email = `account-${Date.now()}@example.test`;
  await page.goto('/en/auth/register');
  await page.getByLabel('Full name').fill('Demo Customer');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill('SillageDemo#2026');
  await page.getByRole('button', {name: 'Create account'}).click();
  await expect(page).toHaveURL('http://127.0.0.1:3000/en/account');
  await page.getByRole('link', {name: 'Previous orders'}).click();
  await expect(page.getByText('You have no orders yet.')).toBeVisible();
  await page.getByRole('link', {name: 'Saved fragrances'}).click();
  await expect(page.getByText('No saved fragrances yet.')).toBeVisible();
});

for (const locale of ['ar', 'en']) {
  test(`${locale} guest cart preserves its locale when returning from sign-in`, async ({page}) => {
    await page.addInitScript(() => localStorage.setItem('maison-sillage-cart', JSON.stringify([{variantId: '123e4567-e89b-42d3-a456-426614174000', quantity: 1}])));
    await page.route('**/api/cart', (route) => route.fulfill({status: 401, contentType: 'application/json', body: JSON.stringify({ok: false})}));
    await page.route('**/api/cart/resolve', (route) => route.fulfill({contentType: 'application/json', body: JSON.stringify({ok: true, data: {items: [{variantId: '123e4567-e89b-42d3-a456-426614174000', quantity: 1, unitPriceMinor: '1500000', sizeMl: 50, product: {nameAr: 'عطر', nameEn: 'Fragrance', brand: 'Maison'}}]}})}));
    await page.goto(`/${locale}/cart`);
    await page.getByRole('link', {name: locale === 'ar' ? 'متابعة إلى إتمام الطلب' : 'Continue to checkout'}).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/auth/login\\?returnTo=%2F${locale}%2Fcheckout$`));
  });
}

test('password recovery routes render in both locales', async ({page}) => {
  await page.goto('/ar/auth/forgot-password');
  await expect(page.getByLabel('البريد الإلكتروني')).toBeVisible();
  await expect(page.getByRole('button', {name: 'إرسال رابط الاستعادة'})).toBeVisible();
  await page.goto('/en/auth/reset-password');
  await expect(page.getByLabel('New password')).toBeVisible();
});
