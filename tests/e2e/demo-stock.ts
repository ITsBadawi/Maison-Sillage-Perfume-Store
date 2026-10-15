import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {expect, type Browser} from '@playwright/test';

const origin = 'http://127.0.0.1:3000';

export async function ensureAmberVeilStock(browser: Browser) {
  const staff = JSON.parse(readFileSync(resolve('demo-credentials.local.json'), 'utf8')) as Array<{role:string;email:string;password:string}>;
  const manager = staff.find((member) => member.role === 'manager');
  if (!manager) throw new Error('Demo manager credentials are missing');
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/en/auth/login');
    await page.getByLabel('Email address').fill(manager.email);
    await page.getByLabel('Password').fill(manager.password);
    await page.getByRole('button', {name: 'Sign in'}).click();
    await expect(page).toHaveURL(/\/en\/account$/);
    await page.goto('/en/admin/products');
    const variant = page.locator('.admin-variant').filter({hasText: 'AMBER-VEIL-30'}).first();
    await expect(variant).toBeVisible();
    const current = Number((await variant.innerText()).match(/Stock:\s*(\d+)/)?.[1]);
    if (!Number.isFinite(current)) throw new Error('Could not read Amber Veil stock');
    if (current >= 5) return;
    const variantId = await variant.locator('input[name="variantId"]').first().inputValue();
    const response = await page.request.post('/api/admin/inventory/adjustments', {
      headers: {origin},
      data: {variantId, delta: 20 - current, reason: 'Restock repeatable local demo test', eventKey: `e2e:restock:${crypto.randomUUID()}`},
    });
    expect(response.status(), await response.text()).toBe(200);
  } finally {
    await context.close();
  }
}
