import {existsSync, readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {expect, test, type Page} from '@playwright/test';
import {ensureAmberVeilStock} from './demo-stock';

const credentialFile = resolve('demo-credentials.local.json');
test.skip(process.env.RUN_SUPABASE_E2E !== '1' || !existsSync(credentialFile), 'Requires local demo staff accounts');
const staff = existsSync(credentialFile) ? JSON.parse(readFileSync(credentialFile, 'utf8')) as Array<{role: string; email: string; password: string}> : [];

async function login(page: Page, role: string) {
  const member = staff.find((item) => item.role === role);
  if (!member) throw new Error(`Missing ${role} credentials`);
  await page.goto('/en/auth/login');
  await page.getByLabel('Email address').fill(member.email);
  await page.getByLabel('Password').fill(member.password);
  await page.getByRole('button', {name: 'Sign in'}).click();
  await expect(page).toHaveURL(/\/en\/account$/);
}

const origin = 'http://127.0.0.1:3000';

test('notification worker rejects requests without its server secret', async ({request}) => {
  const response = await request.get('/api/notifications/telegram');
  expect(response.status()).toBe(401);
});

test('manager can create a draft product, variant, and recorded stock adjustment', async ({page}) => {
  await login(page, 'manager');
  await page.goto('/en/admin');
  await expect(page.getByRole('heading', {name: 'Store admin'})).toBeVisible();

  const slug = `staff-demo-${Date.now()}`;
  const productResponse = await page.request.post('/api/admin/products', {headers: {origin}, data: {
    slug, brand: 'Maison Sillage', nameAr: 'عطر تجربة الإدارة', nameEn: 'Admin Demo Scent', status: 'draft',
  }});
  expect(productResponse.status(), await productResponse.text()).toBe(201);
  const product = await productResponse.json() as {id: string; version: number};
  const variantResponse = await page.request.post(`/api/admin/products/${product.id}/variants`, {headers: {origin}, data: {
    expectedProductVersion: product.version, sku: `STAFF-${Date.now()}`, sizeMl: 50,
    priceIqd: '50000', lowStockThreshold: 2, active: true,
  }});
  expect(variantResponse.status(), await variantResponse.text()).toBe(201);
  const variant = await variantResponse.json() as {id: string};
  const stockResponse = await page.request.post('/api/admin/inventory/adjustments', {headers: {origin}, data: {
    variantId: variant.id, delta: 5, reason: 'Demo stock count', eventKey: `e2e:${crypto.randomUUID()}`,
  }});
  expect(stockResponse.status(), await stockResponse.text()).toBe(200);
  expect((await stockResponse.json() as {stockAvailable: number}).stockAvailable).toBe(5);
  await page.goto('/en/admin/products');
  await expect(page.getByText('Admin Demo Scent').first()).toBeVisible();
});

test('inventory manager can complete and publish a product visible in both storefront languages', async ({page}) => {
  await login(page, 'inventory_manager');
  const slug = `published-demo-${Date.now()}`;
  const created = await page.request.post('/api/admin/products', {headers: {origin}, data: {
    slug, brand: 'Maison Sillage', nameAr: 'عطر اختبار النشر', nameEn: 'Published Demo Scent', status: 'draft',
  }});
  expect(created.status(), await created.text()).toBe(201);
  const product = await created.json() as {id: string; version: number};
  const variant = await page.request.post(`/api/admin/products/${product.id}/variants`, {headers: {origin}, data: {
    expectedProductVersion: product.version, sku: `PUB-${Date.now()}`, sizeMl: 50,
    priceIqd: '75000', lowStockThreshold: 2, active: true,
  }});
  expect(variant.status(), await variant.text()).toBe(201);
  const variantId = (await variant.json() as {id: string}).id;
  const stock = await page.request.post('/api/admin/inventory/adjustments', {headers: {origin}, data: {
    variantId, delta: 4, reason: 'Publish demo stock', eventKey: `publish:${crypto.randomUUID()}`,
  }});
  expect(stock.status(), await stock.text()).toBe(200);
  const uploaded = await page.request.post('/api/admin/products/images', {headers: {origin}, multipart: {
    image: {name: 'demo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64')},
  }});
  expect(uploaded.status(), await uploaded.text()).toBe(201);
  const imagePath = (await uploaded.json() as {path: string}).path;
  const attributes = Object.fromEntries(['woody','floral','fresh','sweet','warm','smoky','bold','calm','classic','modern','day','night'].map((key) => [key, 50]));
  const published = await page.request.post('/api/admin/products', {headers: {origin}, data: {
    productId: product.id, expectedVersion: product.version + 1, slug, brand: 'Maison Sillage',
    nameAr: 'عطر اختبار النشر', nameEn: 'Published Demo Scent',
    shortDescriptionAr: 'عطر هادئ للتجربة', shortDescriptionEn: 'A quiet demo scent',
    descriptionAr: 'عطر هادئ بنوتة الأرز.', descriptionEn: 'A quiet fragrance with a cedar note.',
    status: 'published', gender: 'unisex', family: 'woody', imagePath,
    imageAltAr: 'زجاجة عطر', imageAltEn: 'Perfume bottle', notes: [{layer:'top',slug:'cedar',nameAr:'أرز',nameEn:'Cedar'}],
    attributes,
  }});
  expect(published.status(), await published.text()).toBe(200);
  await page.goto(`/en/products/${slug}`);
  await expect(page.getByRole('heading', {name: 'Published Demo Scent'})).toBeVisible();
  await expect.poll(() => page.locator('.product-detail-image img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.getByText('Cedar', {exact: true})).toBeVisible();
  await page.goto(`/ar/products/${slug}`);
  await expect(page.getByRole('heading', {name: 'عطر اختبار النشر'})).toBeVisible();
});

test('only a manager can configure the private Telegram destination', async ({browser}) => {
  const manager = await browser.newPage();
  await login(manager, 'manager');
  await manager.goto('/en/admin/settings');
  const previous = {
    enabled: await manager.getByLabel('Notifications enabled').isChecked(),
    chatId: await manager.getByLabel('Telegram chat ID or channel').inputValue(),
    includeCustomerDetails: await manager.getByLabel('Include customer contact details in staff messages').isChecked(),
  };
  try {
    const saved = await manager.request.post('/api/admin/settings/telegram', {headers: {origin}, data: {
      enabled: true, chatId: '@maison_demo_private', includeCustomerDetails: false,
    }});
    expect(saved.status(), await saved.text()).toBe(200);
    await manager.goto('/en/admin/settings');
    await expect(manager.getByLabel('Telegram chat ID or channel')).toHaveValue('@maison_demo_private');
    await manager.goto('/ar/admin/orders');
    await expect(manager.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(manager.getByRole('heading', {name: 'الطلبات'})).toBeVisible();
  } finally {
    const restored = await manager.request.post('/api/admin/settings/telegram', {headers: {origin}, data: previous});
    expect(restored.status(), await restored.text()).toBe(200);
  }
  await manager.close();

  const orders = await browser.newPage();
  await login(orders, 'orders_manager');
  const denied = await orders.request.post('/api/admin/settings/telegram', {headers: {origin}, data: {
    enabled: false, chatId: '', includeCustomerDetails: false,
  }});
  expect(denied.status()).toBe(403);
  await orders.close();
});

test('orders and inventory staff are blocked outside their roles', async ({browser}) => {
  const orders = await browser.newPage();
  await login(orders, 'orders_manager');
  await orders.goto('/en/admin/orders');
  await expect(orders.getByRole('heading', {name: 'Orders'})).toBeVisible();
  const deniedProduct = await orders.request.post('/api/admin/products', {headers: {origin}, data: {slug: 'forbidden', brand: 'X', nameAr: 'س', nameEn: 'X'}});
  expect(deniedProduct.status()).toBe(403);
  await orders.close();

  const inventory = await browser.newPage();
  await login(inventory, 'inventory_manager');
  await inventory.goto('/en/admin/products');
  await expect(inventory.getByRole('heading', {name: 'Products and inventory'})).toBeVisible();
  const deniedOrder = await inventory.request.post(`/api/admin/orders/${crypto.randomUUID()}/transitions`, {headers: {origin}, data: {toStatus: 'confirmed', expectedVersion: 1}});
  expect(deniedOrder.status()).toBe(403);
  await inventory.close();
});

test('orders manager can confirm and cancel a real cash-on-delivery order', async ({page, browser}) => {
  await ensureAmberVeilStock(browser);
  await page.goto('/en/auth/register');
  await page.getByLabel('Full name').fill('Order Role Buyer');
  await page.getByLabel('Email address').fill(`order-role-${Date.now()}@example.test`);
  await page.getByLabel('Password').fill('SillageDemo#2026');
  await page.getByRole('button', {name: 'Create account'}).click();
  await expect(page).toHaveURL(/\/en\/account$/);
  await page.goto('/en/products/amber-veil');
  await page.getByRole('button', {name: 'Add to bag'}).click();
  await page.getByRole('link', {name: 'View bag'}).click();
  await page.getByRole('link', {name: 'Continue to checkout'}).click();
  await page.getByLabel('Recipient name').fill('Order Role Buyer');
  await page.getByLabel('Phone in international format').fill('+9647701234567');
  await page.getByLabel('City').fill('Baghdad');
  await page.getByLabel('District').fill('Mansour');
  await page.getByLabel('Street and building').fill('Street 14, Building 8');
  await page.getByLabel('Coupon code').fill('WELCOME10');
  await page.getByRole('button', {name: 'Update quote'}).click();
  await page.getByRole('button', {name: 'Place COD order'}).click();
  await expect(page).toHaveURL(/\/en\/orders\/[0-9a-f-]{36}$/);
  const orderId = page.url().split('/').at(-1)!;
  await page.goto('/en/account');
  await page.getByRole('button', {name: 'Sign out'}).click();

  await login(page, 'orders_manager');
  await page.goto(`/en/admin/orders/${orderId}`);
  await expect(page.getByText('Order Role Buyer').first()).toBeVisible();
  const confirmed = await page.request.post(`/api/admin/orders/${orderId}/transitions`, {headers: {origin}, data: {toStatus: 'confirmed', expectedVersion: 1}});
  expect(confirmed.status(), await confirmed.text()).toBe(200);
  const cancelled = await page.request.post(`/api/admin/orders/${orderId}/transitions`, {headers: {origin}, data: {toStatus: 'cancelled', expectedVersion: 2, reason: 'Buyer requested cancellation'}});
  expect(cancelled.status(), await cancelled.text()).toBe(200);
  const repeated = await page.request.post(`/api/admin/orders/${orderId}/transitions`, {headers: {origin}, data: {toStatus: 'cancelled', expectedVersion: 3, reason: 'Repeated cancellation'}});
  expect(repeated.status()).toBe(409);
  const releaseState = execFileSync('docker', ['exec', 'supabase_db_Maison-Sillage-Perfume-Store', 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-F', '|', '-c',
    `select (select count(*) from public.inventory_movements where order_id='${orderId}' and reason='cancel_release'), (select state from public.coupon_redemptions where order_id='${orderId}')`], {encoding: 'utf8'}).trim();
  expect(releaseState).toBe('1|released');
  await page.reload();
  await expect(page.getByText('Cancelled', {exact: true}).first()).toBeVisible();
});
