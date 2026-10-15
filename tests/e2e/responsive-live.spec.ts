import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {expect,test} from '@playwright/test';

const credentialFile=resolve('demo-credentials.local.json');
test.skip(process.env.RUN_SUPABASE_E2E!=='1'||!existsSync(credentialFile),'Requires local catalog and demo staff');
const staff=existsSync(credentialFile)?JSON.parse(readFileSync(credentialFile,'utf8')) as Array<{role:string;email:string;password:string}>:[];

test('store and manager pages fit phone, tablet, and desktop in both languages',async({page})=>{
  test.setTimeout(90_000);
  const manager=staff.find((item)=>item.role==='manager')!;
  await page.goto('/en/auth/login');
  await page.getByLabel('Email address').fill(manager.email);
  await page.getByLabel('Password').fill(manager.password);
  await page.getByRole('button',{name:'Sign in'}).click();
  await expect(page).toHaveURL(/\/en\/account$/);
  for(const width of [360,768,1440]){
    await page.setViewportSize({width,height:900});
    for(const locale of ['ar','en']){
      for(const route of ['/shop','/products/amber-veil','/advisor','/admin','/admin/products']){
        await page.goto(`/${locale}${route}`);
        await expect(page.locator('html')).toHaveAttribute('dir',locale==='ar'?'rtl':'ltr');
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
        expect(overflow,`${locale}${route} overflowed at ${width}px`).toBeLessThanOrEqual(1);
      }
    }
  }
});
