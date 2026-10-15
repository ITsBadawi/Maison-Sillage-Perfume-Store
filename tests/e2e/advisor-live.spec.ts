import {expect, test} from '@playwright/test';

test.skip(process.env.RUN_SUPABASE_E2E !== '1', 'Requires the seeded local Supabase advisor');

test('guest advisor returns only stocked catalog products with meaningful IQD prices', async ({page}) => {
  await page.goto('/en/advisor');
  await expect(page.locator('.advisor-option').first()).toBeVisible();
  for (let index = 0; index < 6; index++) {
    await page.locator('.advisor-option').first().click();
    await expect(page.locator('.advisor-progress span')).toContainText(`${index + 2}`, {timeout: 15_000});
  }
  await page.getByRole('button', {name: 'No limit'}).click();
  await page.getByRole('button', {name: 'None'}).click();
  const products = page.locator('.advisor-product');
  await expect(products).toHaveCount(3);
  for (const product of await products.all()) {
    await expect(product.getByRole('link')).toHaveAttribute('href', /\/en\/products\//);
    const stockText = await product.locator('.advisor-stock').innerText();
    expect(stockText).toContain('IQD');
    const amount = stockText.match(/[\d,]+/)?.[0];
    expect(amount).toBeTruthy();
    expect(Number(amount!.replaceAll(',', ''))).toBeLessThan(500_000);
  }
});

test('advisor remains usable with reduced motion', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/ar/advisor');
  const question = page.locator('#advisor-question');
  await expect(question).toBeVisible();
  const firstTitle = await question.innerText();
  await page.locator('.advisor-option').first().click();
  await expect(question).not.toHaveText(firstTitle);
  await expect(page.locator('.advisor-option').first()).toBeVisible();
  const duration = await page.locator('.advisor-progress i').evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration));
  expect(duration).toBeLessThan(0.001);
});
