import { test, expect, type Page } from '@playwright/test';
async function mockWindows(page: Page, connected = true) {
  await page.addInitScript(({ connected }) => {
    let callback: ((result: any) => void) | undefined;
    let preferences: (() => void) | undefined;
    const views: string[] = [];
    (window as any).__views = views;
    (window as any).__devices = (devices: any[]) => callback?.({ devices, platform: 'win32', scannedAt: Date.now(), adapterAvailable: true });
    (window as any).__error = (error: string) => callback?.({ devices: [], error, platform: 'win32', scannedAt: Date.now() });
    (window as any).__preferences = () => preferences?.();
    (window as any).airpod = {
      platform: 'win32',
      scan: async () => ({ devices: [{ id: 'a', name: 'AirPods Pro 2', connected }], platform: 'win32', scannedAt: Date.now(), adapterAvailable: true }),
      onDevices: (fn: any) => { callback = fn; return () => { callback = undefined; }; },
      onPreferences: (fn: any) => { preferences = fn; return () => { preferences = undefined; }; },
      setView: async (view: string) => { views.push(view); },
      configure: async () => ({ launchAtLogin: false }),
      settings: async () => {}, minimize: () => {}, close: () => {},
    };
  }, { connected });
}
test('connection screen is simple and preview is opt-in', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Connect your AirPods.' })).toBeVisible();
  await expect(page.getByText('PREVIEW', { exact: true })).toHaveCount(0);
  await expect(page.locator('nav')).toHaveCount(0);
  await expect(page.getByText('Ready for the day')).toHaveCount(0);
  await page.getByRole('button', { name: 'Preview compact controls' }).click();
  await expect(page.getByRole('main', { name: 'AirPods compact controls' })).toBeVisible();
  await expect(page.getByText('PREVIEW', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Adaptive', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Adaptive', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
test('connected AirPods replace setup with compact controls on first scan', async ({ page }) => {
  await mockWindows(page);
  await page.goto('/');
  await expect(page.getByRole('main', { name: 'AirPods compact controls' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Connect your AirPods.' })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as any).__views.at(-1))).toBe('compact');
  await expect(page.getByRole('button', { name: 'Noise cancelling instructions' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Noise cancelling instructions' }).click();
  await expect(page.getByRole('status')).toContainText('Press and hold');
  await expect(page.getByRole('button', { name: 'Noise cancelling instructions' })).toHaveAttribute('aria-pressed', 'false');
});
test('disconnect restores setup and reconnection returns to compact', async ({ page }) => {
  await mockWindows(page);
  await page.goto('/');
  await expect(page.getByRole('main', { name: 'AirPods compact controls' })).toBeVisible();
  await page.evaluate(() => (window as any).__devices([{ id: 'a', name: 'AirPods Pro 2', connected: false }]));
  await expect(page.getByRole('heading', { name: 'Connect your AirPods.' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__views.at(-1))).toBe('setup');
  await page.evaluate(() => (window as any).__devices([{ id: 'a', name: 'AirPods Pro 2', connected: true }]));
  await expect(page.getByRole('main', { name: 'AirPods compact controls' })).toBeVisible();
});
test('tray preferences stay open through repeated scans and model choices tailor controls', async ({ page }) => {
  await mockWindows(page);
  await page.goto('/');
  await expect(page.getByRole('main', { name: 'AirPods compact controls' })).toBeVisible();
  await page.evaluate(() => (window as any).__preferences());
  await expect(page.getByRole('heading', { name: 'Keep it simple.' })).toBeVisible();
  await page.evaluate(() => (window as any).__devices([{ id: 'a', name: 'AirPods Pro 2', connected: true }]));
  await expect(page.getByRole('heading', { name: 'Keep it simple.' })).toBeVisible();
  await page.getByLabel('AirPods model').selectOption('max');
  await page.getByRole('button', { name: 'Back to controls' }).click();
  await expect(page.getByRole('button', { name: 'Adaptive instructions' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Noise cancelling instructions' })).toBeVisible();
});
test('appearance and connection preferences persist', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await page.getByRole('switch', { name: 'Open controls on connection' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Open controls on connection' })).toHaveAttribute('aria-checked', 'false');
});
test('native errors are displayed without an invented PowerShell policy diagnosis', async ({ page }) => {
  await mockWindows(page, false);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Connect your AirPods.' })).toBeVisible();
  await page.evaluate(() => (window as any).__error('Windows denied Bluetooth access (error 5).'));
  await expect(page.getByRole('alert')).toContainText('Windows denied Bluetooth access (error 5).');
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await expect(page.getByText(/PowerShell policy/)).toHaveCount(0);
});
test('compact panel fits the actual 430 by 250 window and loads local assets', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 430, height: 250 });
  await mockWindows(page);
  await page.goto('/');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('main', { name: 'AirPods compact controls' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await page.getByRole('button', { name: 'Adaptive instructions' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  expect((await page.request.get('/images/airpods-pro.png')).ok()).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/compact.png' });
});
test('simple setup capture', async ({ page }) => {
  await page.setViewportSize({ width: 680, height: 630 });
  await page.goto('/');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'test-results/setup.png' });
});
