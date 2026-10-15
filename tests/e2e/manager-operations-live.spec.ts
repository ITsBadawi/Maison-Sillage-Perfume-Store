import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {expect,test,type Page} from '@playwright/test';

const credentialFile=resolve('demo-credentials.local.json');
test.skip(process.env.RUN_SUPABASE_E2E!=='1'||!existsSync(credentialFile),'Requires local demo staff accounts and a resettable local Supabase database');
const staff=existsSync(credentialFile)?JSON.parse(readFileSync(credentialFile,'utf8')) as Array<{role:string;email:string;password:string}>:[];
const origin='http://127.0.0.1:3000';
async function login(page:Page,role:string){const person=staff.find((x)=>x.role===role);if(!person)throw new Error(`Missing ${role} credentials`);await page.goto('/en/auth/login');await page.getByLabel('Email address').fill(person.email);await page.getByLabel('Password').fill(person.password);await page.getByRole('button',{name:'Sign in'}).click();await expect(page).toHaveURL(/\/en\/account$/);}

test('manager manages coupon, shipping, quiz version, and visible brand identity',async({page})=>{
  await login(page,'manager');
  await page.goto('/en/admin/brand');
  const oldNameAr=await page.locator('input[name="nameAr"]').inputValue();const oldNameEn=await page.locator('input[name="nameEn"]').inputValue();
  const oldLogoPath=await page.locator('input[name="logoPath"]').inputValue();const oldHeroPath=await page.locator('input[name="heroImagePath"]').inputValue();
  const oldAccentColor=await page.locator('input[name="accentColor"]').inputValue();const oldPhone=await page.locator('input[name="contactPhone"]').inputValue();
  const brandName=`Maison E2E ${Date.now()}`;
  const updated=await page.request.post('/api/admin/operations/brand',{headers:{origin},data:{nameAr:'ميزون تجربة',nameEn:brandName,logoPath:'',heroImagePath:'',accentColor:'#334455',contactPhone:''}});
  expect(updated.status(),await updated.text()).toBe(200);
  try {
    await page.goto('/en/shop');await expect(page.locator('.wordmark')).toHaveText(brandName);
    await page.goto('/ar/shop');await expect(page.locator('.wordmark')).toHaveText('ميزون تجربة');await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  } finally {
    const restored=await page.request.post('/api/admin/operations/brand',{headers:{origin},data:{nameAr:oldNameAr,nameEn:oldNameEn,logoPath:oldLogoPath,heroImagePath:oldHeroPath,accentColor:oldAccentColor,contactPhone:oldPhone}});
    expect(restored.status(),await restored.text()).toBe(200);
  }

  const code=`E2E${Date.now()}`;
  const coupon=await page.request.post('/api/admin/operations/coupons',{headers:{origin},data:{code,type:'percent',value:10,maxDiscountMinor:'',minSubtotalMinor:'0',startsAt:new Date(Date.now()-3600000).toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),totalLimit:'',perCustomerLimit:'1',active:true}});
  expect(coupon.status(),await coupon.text()).toBe(200);
  await page.goto('/en/admin/coupons');await expect(page.getByRole('heading',{name:'Coupons'})).toBeVisible();await expect(page.getByText(code)).toBeVisible();

  const slug=`e2e-${Date.now()}`;
  const zone=await page.request.post('/api/admin/operations/shipping',{headers:{origin},data:{slug,nameAr:'منطقة الاختبار',nameEn:'E2E Delivery Zone',feeMinor:'7250',active:true}});
  expect(zone.status(),await zone.text()).toBe(200);
  const zoneId=await zone.json() as string;
  const zoneList=await page.request.get('/api/checkout/zones');const zoneBody=await zoneList.json() as {data:Array<{id:string;fee_minor:number}>};
  expect(zoneBody.data.some((item)=>item.id===zoneId&&Number(item.fee_minor)===7250)).toBe(true);
  const disabled=await page.request.post('/api/admin/operations/shipping',{headers:{origin},data:{id:zoneId,slug,nameAr:'منطقة الاختبار',nameEn:'E2E Delivery Zone',feeMinor:'7250',active:false}});
  expect(disabled.status(),await disabled.text()).toBe(200);
  const inactive=await page.request.get('/api/checkout/zones');const inactiveBody=await inactive.json() as {data:Array<{id:string}>};
  expect(inactiveBody.data.some((item)=>item.id===zoneId)).toBe(false);

  const draftResponse=await page.request.post('/api/admin/operations/quiz',{headers:{origin},data:{action:'draft'}});
  expect(draftResponse.status(),await draftResponse.text()).toBe(200);const draftId=await draftResponse.json() as string;
  const publish=await page.request.post('/api/admin/operations/quiz',{headers:{origin},data:{action:'publish',versionId:draftId}});
  expect(publish.status(),await publish.text()).toBe(200);

});

test('orders and inventory roles cannot call manager-only operations',async({browser})=>{
  for(const role of ['orders_manager','inventory_manager']){
    const page=await browser.newPage();await login(page,role);
    for(const resource of ['coupons','shipping','staff','brand','quiz']){
      const response=await page.request.post(`/api/admin/operations/${resource}`,{headers:{origin},data:{action:'publish',versionId:crypto.randomUUID()}});
      expect(response.status(),`${role} could call ${resource}`).toBe(403);
    }
    await page.close();
  }
});

test('the last active manager cannot disable their own role',async({page})=>{
  await login(page,'manager');
  const manager=staff.find((item)=>item.role==='manager')!;
  const attempted=await page.request.post('/api/admin/operations/staff',{headers:{origin},data:{email:manager.email,role:'manager',active:false}});
  expect(attempted.status()).toBe(400);
  expect((await attempted.json() as {error:string}).error).toContain('LAST_MANAGER');
  await page.goto('/en/admin/staff');
  await expect(page.getByText(manager.email)).toBeVisible();
});
