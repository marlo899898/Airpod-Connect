const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('airpod', {
  platform: process.platform,
  connectControls: deviceId => ipcRenderer.invoke('noise:connect', deviceId),
  disconnectControls: () => ipcRenderer.invoke('noise:disconnect'),
  setNoiseMode: (deviceId, mode) => ipcRenderer.invoke('noise:set', deviceId, mode),
  driverInfo: () => ipcRenderer.invoke('noise:driver-info'),
  onNoiseState: callback => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('noise:state', listener);
    return () => ipcRenderer.removeListener('noise:state', listener);
  },
  scan: () => ipcRenderer.invoke('bluetooth:scan'),
  onDevices: callback => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('bluetooth:devices', listener);
    return () => ipcRenderer.removeListener('bluetooth:devices', listener);
  },
  setView: view => ipcRenderer.invoke('window:view', view),
  onPreferences: callback => {
    const listener = () => callback();
    ipcRenderer.on('window:preferences', listener);
    return () => ipcRenderer.removeListener('window:preferences', listener);
  },
  settings: target => ipcRenderer.invoke('windows:settings', target),
  configure: prefs => ipcRenderer.invoke('app:configure', prefs),
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),
});
