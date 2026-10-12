// Read-only bindings to documented Win32 Bluetooth APIs. No shell or script policy.
const typeCache = new WeakMap();
function defineTypes(koffi) {
  if (typeCache.has(koffi)) return typeCache.get(koffi);
  const SystemTime = koffi.struct('AirpodSystemTime', {
    year: 'uint16_t', month: 'uint16_t', dayOfWeek: 'uint16_t', day: 'uint16_t',
    hour: 'uint16_t', minute: 'uint16_t', second: 'uint16_t', milliseconds: 'uint16_t',
  });
  const RadioParams = koffi.struct('AirpodRadioParams', { size: 'uint32_t' });
  const SearchParams = koffi.struct('AirpodSearchParams', {
    size: 'uint32_t', authenticated: 'int32_t', remembered: 'int32_t', unknown: 'int32_t',
    connected: 'int32_t', inquiry: 'int32_t', timeout: 'uint8_t', radio: 'void *',
  });
  const DeviceInfo = koffi.struct('AirpodDeviceInfo', {
    size: 'uint32_t', address: 'uint64_t', deviceClass: 'uint32_t', connected: 'int32_t',
    remembered: 'int32_t', authenticated: 'int32_t', lastSeen: SystemTime, lastUsed: SystemTime,
    name: koffi.array('uint16_t', 248),
  });
  const types = { RadioParams, SearchParams, DeviceInfo };
  typeCache.set(koffi, types);
  return types;
}
function createNativeApi() {
  if (process.platform !== 'win32') throw new Error('Live Bluetooth requires Windows 10 or 11.');
  const koffi = require('koffi');
  const types = defineTypes(koffi);
  // Fully qualified system paths avoid DLL search through the current directory.
  const path = require('node:path');
  const system32 = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32');
  const bluetooth = koffi.load(path.join(system32, 'bthprops.cpl'));
  const kernel = koffi.load(path.join(system32, 'kernel32.dll'));
  return {
    sizes: { radio: koffi.sizeof(types.RadioParams), search: koffi.sizeof(types.SearchParams), device: koffi.sizeof(types.DeviceInfo) },
    firstRadio: bluetooth.func('void * __stdcall BluetoothFindFirstRadio(AirpodRadioParams *params, _Out_ void **radio)'),
    closeRadioFind: bluetooth.func('int32_t __stdcall BluetoothFindRadioClose(void *find)'),
    closeHandle: kernel.func('int32_t __stdcall CloseHandle(void *handle)'),
    firstDevice: bluetooth.func('void * __stdcall BluetoothFindFirstDevice(AirpodSearchParams *params, _Inout_ AirpodDeviceInfo *info)'),
    nextDevice: bluetooth.func('int32_t __stdcall BluetoothFindNextDevice(void *find, _Inout_ AirpodDeviceInfo *info)'),
    closeDeviceFind: bluetooth.func('int32_t __stdcall BluetoothFindDeviceClose(void *find)'),
    lastError: kernel.func('uint32_t __stdcall GetLastError()'),
  };
}
function windowsError(operation, code) {
  if (code === 5) return new Error('Windows denied Bluetooth access (error 5). Check your organization’s device policy.');
  return new Error(`${operation} failed (Windows error ${code}). Turn Bluetooth off and on, then retry.`);
}
function decodeDevice(info) {
  const units = Array.from(info.name || []);
  const terminator = units.indexOf(0);
  const name = String.fromCharCode(...(terminator < 0 ? units : units.slice(0, terminator))).trim();
  const address = BigInt(info.address).toString(16).padStart(12, '0').toUpperCase().match(/.{2}/g).join(':');
  return { id: `bluetooth:${address}`, name: name || 'Unnamed Bluetooth device', connected: Boolean(info.connected) };
}
function enumerateBluetooth(api) {
  const radio = [null];
  const radioFind = api.firstRadio({ size: api.sizes.radio }, radio);
  if (!radioFind) {
    const code = api.lastError();
    if ([0, 259, 1168, 1062].includes(code)) return { devices: [], adapterAvailable: false };
    throw windowsError('Bluetooth adapter discovery', code);
  }
  try { if (radio[0]) api.closeHandle(radio[0]); }
  finally { api.closeRadioFind(radioFind); }
  const search = {
    size: api.sizes.search, authenticated: 1, remembered: 1, unknown: 0,
    connected: 1, inquiry: 0, timeout: 0, radio: null,
  };
  let info = { size: api.sizes.device };
  const find = api.firstDevice(search, info);
  if (!find) {
    const code = api.lastError();
    if ([0, 259, 1168].includes(code)) return { devices: [], adapterAvailable: true };
    throw windowsError('Bluetooth device discovery', code);
  }
  const devices = new Map();
  try {
    do {
      const device = decodeDevice(info);
      const previous = devices.get(device.id);
      if (!previous || device.connected) devices.set(device.id, device);
      info = { size: api.sizes.device };
    } while (api.nextDevice(find, info));
    const code = api.lastError();
    if (code !== 0 && code !== 259) throw windowsError('Bluetooth enumeration', code);
  } finally { api.closeDeviceFind(find); }
  return { devices: [...devices.values()], adapterAvailable: true };
}
function scanBluetooth() {
  try { return enumerateBluetooth(createNativeApi()); }
  catch (error) { return { devices: [], error: error instanceof Error ? error.message : 'Native Bluetooth discovery failed.' }; }
}
module.exports = { defineTypes, createNativeApi, decodeDevice, enumerateBluetooth, scanBluetooth };
