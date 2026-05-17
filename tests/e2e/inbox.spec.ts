import { test, expect } from '@playwright/test';

test('TC-INBOX-002 adds Inbox item from Web UI', async ({ page }) => {
  const text = `想到一个新产品想法，后面再整理 ${Date.now()}`;
  await page.goto('/');
  await page.getByPlaceholder('Type a thought, task, reminder, or unfinished idea').fill(text);
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('button', { name: new RegExp(text) })).toBeVisible();
});
