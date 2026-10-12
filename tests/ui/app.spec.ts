import { test, expect } from '@playwright/test';
test('preview is explicit, models tailor available noise modes, and selection works', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByText('This is an interactive preview', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Adaptive audio', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Adaptive audio', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Choose AirPods model' }).click();
  await page.getByLabel('Your AirPods model').selectOption('airpods-4');
  await page.getByRole('button', { name: 'All set' }).click();
  await expect(page.getByText('This model uses an open fit', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adaptive audio', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Choose AirPods model' }).click();
  await page.getByLabel('Your AirPods model').selectOption('max');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Noise cancellation', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adaptive audio', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('theme and preferences persist across reloads', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await page.getByRole('button', { name: 'A little daylight Light' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('switch', { name: 'Open on connection', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('switch', { name: 'Automatically open when connected' })).toHaveAttribute('aria-checked', 'false');
});
test('leaving preview does not show fake connected devices or batteries', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Use my AirPods' }).click();
  await expect(page.getByText('Your sound is out there.')).toBeVisible();
  await page.getByRole('button', { name: 'My AirPods', exact: true }).click();
  await expect(page.getByText('NOT CONNECTED', { exact: true })).toBeVisible();
  await expect(page.getByText('86%', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Battery levels unavailable.')).toBeVisible();
});
test('Windows bridge handles devices and opens honest noise instructions', async ({ page }) => {
  await page.addInitScript(() => {
    const settings: string[] = [];
    (window as any).__settings = settings;
    (window as any).airpod = {
      platform: 'win32',
      scan: async () => ({ devices: [{ id: 'native-1', name: 'AirPods Pro 2', connected: true }], platform: 'win32', scannedAt: Date.now() }),
      onDevices: () => () => {},
      configure: async () => ({ launchAtLogin: false }),
      settings: async (target: string) => { settings.push(target); },
      minimize: () => {}, close: () => {},
    };
  });
  await page.goto('/');
  await expect(page.getByText('CONNECTED', { exact: true })).toBeVisible();
  await expect(page.getByText('86%', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Adaptive audio instructions' }).click();
  await expect(page.getByRole('dialog')).toContainText('No command was sent to your AirPods');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open Windows Sound settings' }).click();
  expect(await page.evaluate(() => (window as any).__settings)).toEqual(['sound']);
});
test('small screens fit without horizontal overflow and product assets load', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sounds like your space.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const response = await page.request.get('/images/airpods-pro.png');
  expect(response.ok()).toBe(true);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
});
test('desktop visual capture', async ({ page }) => {
  await page.goto('/');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
});
