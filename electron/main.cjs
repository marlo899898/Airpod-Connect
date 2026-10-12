const { app, BrowserWindow, ipcMain, shell, Notification, Tray, Menu, nativeImage, utilityProcess, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { updateConnections } = require('./device-monitor.cjs');
const { windowBounds, SIZES } = require('./window-layout.cjs');
let window, tray, timer, scanPromise, activeWorker, quitting = false;
let previous = null;
let currentView = 'setup';
let preferences = { autoOpen: true, notifications: true, launchAtLogin: false, preferredDevice: '' };
const configPath = () => path.join(app.getPath('userData'), 'preferences.json');
function showWindow() {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show(); window.focus();
}
function setView(view) {
  if (!['setup', 'compact'].includes(view)) throw new Error('Invalid window view');
  if (!window || window.isDestroyed() || currentView === view) return;
  currentView = view;
  const current = window.getBounds();
  const bounds = windowBounds(view, current, screen.getDisplayMatching(current).workArea);
  window.setMinimumSize(320, 210);
  window.setBounds(bounds);
  window.setResizable(view === 'setup');
}
function queryBluetooth() {
  return new Promise(resolve => {
    let settled = false;
    let worker;
    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (worker) { worker.kill(); if (activeWorker === worker) activeWorker = null; }
      resolve(result);
    };
    const timeout = setTimeout(() => finish({ devices: [], error: 'Windows Bluetooth did not respond within 10 seconds. Turn Bluetooth off and on, then retry.' }), 10000);
    try {
      worker = utilityProcess.fork(path.join(__dirname, 'bluetooth-worker.cjs'), [], { serviceName: 'AirPods Bluetooth', stdio: 'pipe' });
      activeWorker = worker;
      worker.stdout?.resume(); worker.stderr?.resume();
      worker.on('message', result => {
        if (!result || !Array.isArray(result.devices) || result.devices.some(d => typeof d.id !== 'string' || typeof d.name !== 'string' || typeof d.connected !== 'boolean')) {
          finish({ devices: [], error: 'The native Bluetooth service returned an invalid response. Restart the app.' });
        } else finish(result);
      });
      worker.on('exit', code => finish({ devices: [], error: `The native Bluetooth service exited before replying (code ${code}). Re-download the complete app and retry.` }));
    } catch (error) { finish({ devices: [], error: `Could not start the native Bluetooth service: ${error.message}` }); }
  });
}
function scan() {
  if (scanPromise) return scanPromise;
  if (process.platform !== 'win32') return Promise.resolve({ devices: [], platform: process.platform, scannedAt: Date.now(), error: 'Live Bluetooth detection requires Windows 10 or 11.' });
  scanPromise = queryBluetooth().then(result => {
    result.platform = process.platform;
    result.scannedAt = Date.now();
    const transition = updateConnections(previous, result, preferences.preferredDevice);
    if (transition.arrivals.length) {
      if (preferences.autoOpen) showWindow();
      if (preferences.notifications && Notification.isSupported()) new Notification({ title: 'AirPods connected', body: 'Your compact controls are ready.', silent: true }).show();
    }
    previous = transition.current;
    if (window && !window.isDestroyed()) window.webContents.send('bluetooth:devices', result);
    return result;
  }).finally(() => { scanPromise = null; });
  return scanPromise;
}
function createWindow() {
  window = new BrowserWindow({ ...SIZES.setup, minWidth: 320, minHeight: 210, frame: false, backgroundColor: '#11100e', icon: path.join(__dirname, '../dist/icon.png'), title: 'Airpod Connect', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  if (app.isPackaged) window.loadFile(path.join(__dirname, '../dist/index.html'));
  else window.loadURL('http://127.0.0.1:5173');
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.on('close', event => { if (!quitting && tray) { event.preventDefault(); window.hide(); } });
}
function showPreferences() {
  setView('setup');
  window?.webContents.send('window:preferences');
  showWindow();
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', showWindow);
  app.whenReady().then(() => {
    app.setAppUserModelId('com.airpodconnect.desktop');
    try { const stored = JSON.parse(fs.readFileSync(configPath(), 'utf8')); preferences = { ...preferences, ...stored }; } catch {}
    ipcMain.handle('bluetooth:scan', scan);
    ipcMain.handle('window:view', (_event, view) => setView(view));
    ipcMain.handle('windows:settings', (_event, target) => {
      if (!['bluetooth', 'sound'].includes(target) || process.platform !== 'win32') throw new Error('This shortcut is available in the Windows app.');
      return shell.openExternal(`ms-settings:${target}`);
    });
    ipcMain.handle('app:configure', (_event, input) => {
      if (!input || ['autoOpen', 'notifications', 'launchAtLogin'].some(k => typeof input[k] !== 'boolean') || typeof input.preferredDevice !== 'string') throw new Error('Invalid preferences');
      const next = { autoOpen: input.autoOpen, notifications: input.notifications, launchAtLogin: input.launchAtLogin, preferredDevice: input.preferredDevice.slice(0, 2048) };
      if (process.platform === 'win32' && app.isPackaged && !process.env.PORTABLE_EXECUTABLE_FILE) app.setLoginItemSettings({ openAtLogin: next.launchAtLogin });
      else next.launchAtLogin = false;
      fs.writeFileSync(configPath(), JSON.stringify(next), 'utf8'); preferences = next;
      return { launchAtLogin: next.launchAtLogin };
    });
    ipcMain.on('window:minimize', () => window?.minimize());
    ipcMain.on('window:close', () => window?.close());
    createWindow();
    const icon = nativeImage.createFromPath(path.join(__dirname, '../dist/icon.png'));
    if (!icon.isEmpty()) {
      tray = new Tray(icon);
      tray.setToolTip('Airpod Connect');
      tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Open Airpod Connect', click: showWindow },
        { label: 'Preferences & model', click: showPreferences },
        { label: 'Bluetooth settings', click: () => { if (process.platform === 'win32') shell.openExternal('ms-settings:bluetooth'); } },
        { type: 'separator' }, { label: 'Quit', click: () => { quitting = true; app.quit(); } },
      ]));
      tray.on('click', showWindow);
    }
    timer = setInterval(scan, 5000);
    scan();
  });
}
app.on('before-quit', () => { quitting = true; clearInterval(timer); activeWorker?.kill(); });
app.on('window-all-closed', () => { if (!tray) app.quit(); });
