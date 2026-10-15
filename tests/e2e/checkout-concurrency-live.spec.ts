import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {expect, test, type Browser, type Page} from '@playwright/test';

const credentialsPath = resolve('demo-credentials.local.json');
test.skip(process.env.RUN_SUPABASE_E2E !== '1' || !existsSync(credentialsPath), 'Requires local Supabase and demo staff');
const staff = existsSync(credentialsPath) ? JSON.parse(readFileSync(credentialsPath, 'utf8')) as Array<{role:string;email:string;password:string}> : [];
const origin = 'http://127.0.0.1:3000';
const address = {recipientName:'Concurrency Buyer',phone:'+9647701234567',city:'Baghdad',district:'Mansour',street:'Street 22, Building 3',landmark:''};

async function register(browser: Browser, suffix: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/en/auth/register');
  await page.getByLabel('Full name').fill('Concurrency Buyer');
  await page.getByLabel('Email address').fill(`concurrent-${suffix}-${Date.now()}@example.test`);
  await page.getByLabel('Password').fill('SillageDemo#2026');
  await page.getByRole('button', {name:'Create account'}).click();
  await expect(page).toHaveURL(/\/en\/account$/);
  return {context,page};
}

async function createLastUnitProduct(page: Page) {
  const slug = `last-unit-${Date.now()}`;
  const created = await page.request.post('/api/admin/products', {headers:{origin}, data:{slug,brand:'Maison Sillage',nameAr:'آخر قطعة',nameEn:'Last Unit Test',status:'draft'}});
  expect(created.status(), await created.text()).toBe(201);
  const product = await created.json() as {id:string;version:number};
  const variant = await page.request.post(`/api/admin/products/${product.id}/variants`, {headers:{origin}, data:{expectedProductVersion:product.version,sku:`LAST-${Date.now()}`,sizeMl:50,priceIqd:'45000',lowStockThreshold:1,active:true}});
  expect(variant.status(), await variant.text()).toBe(201);
  const variantId = (await variant.json() as {id:string}).id;
  const stock = await page.request.post('/api/admin/inventory/adjustments', {headers:{origin}, data:{variantId,delta:1,reason:'Concurrency acceptance test',eventKey:`concurrency:${crypto.randomUUID()}`}});
  expect(stock.status(), await stock.text()).toBe(200);
  const uploaded = await page.request.post('/api/admin/products/images', {headers:{origin}, multipart:{image:{name:'test.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')}}});
  expect(uploaded.status(), await uploaded.text()).toBe(201);
  const imagePath = (await uploaded.json() as {path:string}).path;
  const attributes = Object.fromEntries(['woody','floral','fresh','sweet','warm','smoky','bold','calm','classic','modern','day','night'].map((key)=>[key,50]));
  const published = await page.request.post('/api/admin/products', {headers:{origin}, data:{productId:product.id,expectedVersion:product.version+1,slug,brand:'Maison Sillage',nameAr:'آخر قطعة',nameEn:'Last Unit Test',shortDescriptionAr:'عطر للاختبار',shortDescriptionEn:'A test fragrance',descriptionAr:'عطر مخزون محدود للاختبار.',descriptionEn:'A limited-stock test fragrance.',status:'published',gender:'unisex',family:'woody',imagePath,imageAltAr:'زجاجة',imageAltEn:'Bottle',notes:[{layer:'top',slug:'cedar',nameAr:'أرز',nameEn:'Cedar'}],attributes}});
  expect(published.status(), await published.text()).toBe(200);
  return variantId;
}

test('two customers cannot buy the same last unit and a retry does not reserve twice', async ({browser}) => {
  test.setTimeout(120_000);
  const managerContext = await browser.newContext();
  const manager = await managerContext.newPage();
  const credentials = staff.find((item)=>item.role==='manager')!;
  await manager.goto('/en/auth/login');
  await manager.getByLabel('Email address').fill(credentials.email);
  await manager.getByLabel('Password').fill(credentials.password);
  await manager.getByRole('button',{name:'Sign in'}).click();
  await expect(manager).toHaveURL(/\/en\/account$/);
  const variantId = await createLastUnitProduct(manager);
  await managerContext.close();

  const buyers = await Promise.all([register(browser,'one'),register(browser,'two')]);
  try {
    const requests = await Promise.all(buyers.map(async ({page}) => {
      const zones = await page.request.get('/api/checkout/zones');
      expect(zones.status(), await zones.text()).toBe(200);
      const shippingZoneId = (await zones.json() as {data:Array<{id:string}>}).data[0].id;
      const items = [{variantId,quantity:1}];
      const quoteResponse = await page.request.post('/api/checkout/quote',{headers:{origin},data:{items,shippingZoneId}});
      expect(quoteResponse.status(), await quoteResponse.text()).toBe(200);
      const quoteHash = (await quoteResponse.json() as {data:{quoteHash:string}}).data.quoteHash;
      return {page,body:{items,shippingZoneId,address,quoteHash},key:crypto.randomUUID()};
    }));
    const outcomes = await Promise.all(requests.map(({page,body,key})=>page.request.post('/api/orders',{headers:{origin,'idempotency-key':key},data:body})));
    const statuses = outcomes.map((response)=>response.status()).sort();
    expect(statuses).toEqual([201,409]);
    const winner = outcomes.findIndex((response)=>response.status()===201);
    const firstOrder = (await outcomes[winner].json() as {data:{orderId:string}}).data.orderId;
    const replay = await requests[winner].page.request.post('/api/orders',{headers:{origin,'idempotency-key':requests[winner].key},data:requests[winner].body});
    expect(replay.status(),await replay.text()).toBe(200);
    expect((await replay.json() as {data:{orderId:string;replayed:boolean}}).data).toMatchObject({orderId:firstOrder,replayed:true});
  } finally {
    await Promise.all(buyers.map(({context})=>context.close()));
  }
});
