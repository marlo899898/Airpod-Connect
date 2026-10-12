const assert = require('node:assert/strict');
const path = require('node:path');
const { _electron: electron } = require('playwright');
(async () => {
  const app = await electron.launch({ executablePath: path.resolve('release/win-unpacked/Airpod Connect.exe'), timeout: 60000 });
  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => Boolean(window.airpod));
    // Exercise the actual packaged utility process, Koffi addon and Win32 DLLs.
    const result = await page.evaluate(() => window.airpod.scan());
    assert.equal(result.error, undefined, `Packaged scanner failed: ${result.error}`);
    assert.equal(typeof result.adapterAvailable, 'boolean');
    const controlProbe = await app.evaluate(async ({ app, utilityProcess }) => {
      const path = require('node:path');
      return new Promise((resolve, reject) => {
        const worker = utilityProcess.fork(path.join(app.getAppPath(), 'electron/noise-worker.cjs'), ['bluetooth:00:00:00:00:00:00'], { stdio: 'pipe' });
        worker.stdout?.resume(); worker.stderr?.resume();
        const timer = setTimeout(() => { worker.kill(); reject(new Error('Packaged control probe timed out')); }, 15000);
        worker.once('message', state => { clearTimeout(timer); worker.kill(); resolve(state); });
        worker.once('exit', code => { clearTimeout(timer); reject(new Error(`Control probe exited: ${code}`)); });
      });
    });
    assert.equal(controlProbe.status, 'driver-missing', JSON.stringify(controlProbe));
    // Inject a UI event only after the real native scan succeeds; no hardware claim.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('bluetooth:devices', {
      devices: [{ id: 'ui-test', name: 'AirPods Pro 2', connected: true }], platform: 'win32', scannedAt: Date.now(),
    }));
    await page.getByRole('main', { name: 'AirPods compact controls' }).waitFor();
    await page.waitForFunction(() => innerWidth === 430 && innerHeight === 250);
    console.log('Packaged native Bluetooth query and compact window transition passed.');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
