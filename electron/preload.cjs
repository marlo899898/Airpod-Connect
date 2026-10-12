const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('airpod', {
  platform: process.platform,
  scan: () => ipcRenderer.invoke('bluetooth:scan'),
  onDevices: callback => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('bluetooth:devices', listener);
    return () => ipcRenderer.removeListener('bluetooth:devices', listener);
  },
  settings: target => ipcRenderer.invoke('windows:settings', target),
  configure: prefs => ipcRenderer.invoke('app:configure', prefs),
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),
});
