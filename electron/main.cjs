const { app, BrowserWindow, ipcMain, shell, Notification, Tray, Menu, nativeImage } = require('electron');
const { execFile } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { updateConnections } = require('./device-monitor.cjs');
let window, tray, timer, scanPromise, quitting = false;
let previous = null;
let preferences = { autoOpen: true, notifications: true, launchAtLogin: false, preferredDevice: '' };
const configPath = () => path.join(app.getPath('userData'), 'preferences.json');
function showWindow() { if (window) { window.show(); if (window.isMinimized()) window.restore(); window.focus(); } }
function scan() {
  if (scanPromise) return scanPromise;
  if (process.platform !== 'win32') return Promise.resolve({ devices: [], platform: process.platform, scannedAt: Date.now(), error: 'Live Bluetooth detection requires Windows 10 or 11.' });
  const script = app.isPackaged ? path.join(process.resourcesPath, 'bluetooth.ps1') : path.join(__dirname, '../scripts/bluetooth.ps1');
  const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  scanPromise = new Promise(resolve => {
    execFile(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned', '-File', script], { windowsHide: true, timeout: 25000, maxBuffer: 1024 * 1024, encoding: 'utf8' }, (error, stdout) => {
      let result;
      try {
        result = JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
        if (!Array.isArray(result.devices)) throw new Error('Invalid device response');
      } catch { result = { devices: [], error: error?.killed ? 'Bluetooth scan timed out. Check that Bluetooth is on, then refresh.' : 'Could not query Windows Bluetooth. Check PowerShell policy and Bluetooth availability.' }; }
      result.platform = process.platform;
      result.scannedAt = Date.now();
      const transition = updateConnections(previous, result, preferences.preferredDevice);
      for (const device of transition.arrivals) {
        if (preferences.autoOpen) showWindow();
        if (preferences.notifications && Notification.isSupported()) new Notification({ title: 'Your sound is here.', body: `${device.name} connected. Open Airpod Connect to see your device.`, silent: true }).show();
      }
      previous = transition.current;
      if (window && !window.isDestroyed()) window.webContents.send('bluetooth:devices', result);
      resolve(result);
    });
  }).finally(() => { scanPromise = null; });
  return scanPromise;
}
function createWindow() {
  window = new BrowserWindow({ width: 1280, height: 880, minWidth: 850, minHeight: 650, frame: false, backgroundColor: '#11100e', icon: path.join(__dirname, '../dist/icon.png'), title: 'Airpod Connect', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  if (app.isPackaged) window.loadFile(path.join(__dirname, '../dist/index.html'));
  else window.loadURL('http://127.0.0.1:5173');
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.on('close', event => { if (!quitting && tray) { event.preventDefault(); window.hide(); } });
}
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance', showWindow);
  app.whenReady().then(() => {
    app.setAppUserModelId('com.airpodconnect.desktop');
    try { const stored = JSON.parse(fs.readFileSync(configPath(), 'utf8')); preferences = { ...preferences, ...stored }; } catch {}
    createWindow();
    // Small PNG is shared with the application favicon. A tray keeps detection alive after closing.
    const icon = nativeImage.createFromPath(path.join(__dirname, '../dist/icon.png'));
    if (!icon.isEmpty()) {
      tray = new Tray(icon);
      tray.setToolTip('Airpod Connect');
      tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Open Airpod Connect', click: showWindow }, { label: 'Bluetooth settings', click: () => { if (process.platform === 'win32') shell.openExternal('ms-settings:bluetooth'); } }, { type: 'separator' }, { label: 'Quit', click: () => { quitting = true; app.quit(); } }]));
      tray.on('click', showWindow);
    }
    ipcMain.handle('bluetooth:scan', scan);
    ipcMain.handle('windows:settings', (_event, target) => {
      if (!['bluetooth', 'sound'].includes(target) || process.platform !== 'win32') throw new Error('This shortcut is available in the Windows app.');
      return shell.openExternal(`ms-settings:${target}`);
    });
    ipcMain.handle('app:configure', (_event, input) => {
      if (!input || ['autoOpen', 'notifications', 'launchAtLogin'].some(k => typeof input[k] !== 'boolean') || typeof input.preferredDevice !== 'string') throw new Error('Invalid preferences');
      const next = { autoOpen: input.autoOpen, notifications: input.notifications, launchAtLogin: input.launchAtLogin, preferredDevice: input.preferredDevice.slice(0, 2048) };
      if (process.platform === 'win32' && app.isPackaged && !process.env.PORTABLE_EXECUTABLE_FILE) app.setLoginItemSettings({ openAtLogin: next.launchAtLogin });
      else next.launchAtLogin = false;
      fs.writeFileSync(configPath(), JSON.stringify(next), 'utf8');
      preferences = next;
      return { launchAtLogin: next.launchAtLogin };
    });
    ipcMain.on('window:minimize', () => window?.minimize());
    ipcMain.on('window:close', () => window?.close());
    timer = setInterval(scan, 8000);
    scan();
  });
}
app.on('before-quit', () => { quitting = true; clearInterval(timer); });
app.on('window-all-closed', () => { if (!tray) app.quit(); });
