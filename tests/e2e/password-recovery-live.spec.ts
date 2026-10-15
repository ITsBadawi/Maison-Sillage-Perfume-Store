import {expect,test} from '@playwright/test';

test.skip(process.env.RUN_SUPABASE_E2E!=='1','Requires local Supabase and Mailpit');

test('customer can reset a password through the local email link',async({page,request})=>{
  test.setTimeout(90_000);
  const email=`recovery-${Date.now()}@example.test`;
  const oldPassword='SillageDemo#2026';
  const newPassword='SillageNew#2026';
  await page.goto('/en/auth/register');
  await page.getByLabel('Full name').fill('Recovery Buyer');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(oldPassword);
  await page.getByRole('button',{name:'Create account'}).click();
  await expect(page).toHaveURL(/\/en\/account$/);
  await page.getByRole('button',{name:'Sign out'}).click();

  await page.goto('/en/auth/forgot-password');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button',{name:'Send reset link'}).click();
  await expect(page.getByRole('status')).toContainText('reset link will arrive');
  let emailHtml='';
  await expect.poll(async()=>{
    const response=await request.get(`http://127.0.0.1:54324/view/latest.html?query=to:${encodeURIComponent(email)}`);
    if(response.ok()) emailHtml=await response.text();
    return response.status();
  },{timeout:20_000}).toBe(200);
  const link=emailHtml.match(/https?:\/\/[^"'<>\s]+\/auth\/v1\/verify[^"'<>\s]*/)?.[0]?.replaceAll('&amp;','&');
  expect(link).toBeTruthy();
  await page.goto(link!);
  await expect.poll(() => new URL(page.url()).pathname).toBe('/en/auth/reset-password');
  await page.getByLabel('New password').fill(newPassword);
  await page.getByRole('button',{name:'Reset password'}).click();
  await expect(page).toHaveURL(/\/en\/account$/);
  await page.getByRole('button',{name:'Sign out'}).click();
  await page.goto('/en/auth/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(newPassword);
  await page.getByRole('button',{name:'Sign in'}).click();
  await expect(page).toHaveURL(/\/en\/account$/);
});
