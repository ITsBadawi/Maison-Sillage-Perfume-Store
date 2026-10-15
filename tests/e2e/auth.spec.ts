import {expect, test} from '@playwright/test';

test('Arabic customer can reach sign-in and registration forms', async ({page}) => {
  await page.goto('/ar/auth/login');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', {level: 1})).toBeVisible();
  await expect(page.getByLabel('البريد الإلكتروني')).toBeVisible();
  await expect(page.getByLabel('كلمة المرور')).toBeVisible();
  await page.getByRole('link', {name: 'إنشاء حساب'}).click();
  await expect(page).toHaveURL(/\/ar\/auth\/register$/);
  await expect(page.getByLabel('الاسم الكامل')).toBeVisible();
});

test('English account route requires sign-in', async ({page}) => {
  await page.goto('/en/account');
  await expect(page).toHaveURL(/\/en\/auth\/login\?returnTo=%2Fen%2Faccount$/);
  await expect(page.getByRole('heading', {name: 'Sign in'})).toBeVisible();
});
