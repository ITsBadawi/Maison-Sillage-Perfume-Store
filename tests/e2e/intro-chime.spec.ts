import {expect, test} from '@playwright/test';

test('first visit offers an optional chime and remembers the choice', async ({page}) => {
  await page.goto('/en');
  await expect(page.getByRole('complementary', {name: 'Welcome chime'})).toBeVisible();
  await page.getByRole('button', {name: 'No, thanks'}).click();
  await page.reload();
  await expect(page.getByRole('complementary', {name: 'Welcome chime'})).toHaveCount(0);
});
