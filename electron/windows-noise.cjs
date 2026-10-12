// Direct Windows device-interface I/O to an ALREADY INSTALLED MagicAAP driver.
// No driver installation, PowerShell, RFCOMM substitution, or security changes.
const path = require('node:path');
const INTERFACE = '9eec98bb-3c54-45d4-a843-7900c4635e08';
const cache = new WeakMap();
function defineTypes(koffi) {
  if (cache.has(koffi)) return cache.get(koffi);
  const Guid = koffi.struct('NoiseGuid', { a: 'uint32', b: 'uint16', c: 'uint16', d: koffi.array('uint8', 8) });
  const Interface = koffi.struct('NoiseInterface', { size: 'uint32', guid: Guid, flags: 'uint32', reserved: 'uintptr_t' });
  const Overlapped = koffi.struct('NoiseOverlapped', { internal: 'uintptr_t', internalHigh: 'uintptr_t', offset: 'uint32', offsetHigh: 'uint32', event: 'void *' });
  const types = { Guid, Interface, Overlapped }; cache.set(koffi, types); return types;
}
function matchesDevice(devicePath, deviceId) {
  if (typeof deviceId !== 'string' || !/^bluetooth:(?:[a-f\d]{2}:){5}[a-f\d]{2}$/i.test(deviceId)) return false;
  const address = deviceId.slice(10).replaceAll(':', '').toLowerCase();
  // Match the remote address field, not a substring or a different paired device.
  const match = devicePath.toLowerCase().match(/&([a-f\d]{12})_c[a-f\d]+#/);
  return match?.[1] === address && devicePath.toLowerCase().endsWith(`#{${INTERFACE}}`);
}
function createApi() {
  if (process.platform !== 'win32') throw new Error('Noise control requires Windows.');
  const koffi = require('koffi');
  const types = defineTypes(koffi);
  const system = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32');
  const setup = koffi.load(path.join(system, 'setupapi.dll'));
  const kernel = koffi.load(path.join(system, 'kernel32.dll'));
  return {
    koffi, types,
    invalid: h => h === null || koffi.address(h) === 0xffffffffffffffffn,
    getDevices: setup.func('void * __stdcall SetupDiGetClassDevsW(NoiseGuid *guid, str16 enumerator, void *parent, uint32 flags)'),
    enumInterface: setup.func('int32 __stdcall SetupDiEnumDeviceInterfaces(void *list, void *device, NoiseGuid *guid, uint32 index, _Inout_ NoiseInterface *info)'),
    getDetail: setup.func('int32 __stdcall SetupDiGetDeviceInterfaceDetailW(void *list, NoiseInterface *info, _Inout_ void *detail, uint32 size, _Out_ uint32 *required, void *device)'),
    destroy: setup.func('int32 __stdcall SetupDiDestroyDeviceInfoList(void *list)'),
    open: kernel.func('void * __stdcall CreateFileW(str16 name, uint32 access, uint32 share, void *security, uint32 creation, uint32 flags, void *template)'),
    close: kernel.func('int32 __stdcall CloseHandle(void *handle)'),
    read: kernel.func('int32 __stdcall ReadFile(void *handle, _Out_ void *buffer, uint32 count, _Out_ uint32 *bytes, void *overlapped)'),
    write: kernel.func('int32 __stdcall WriteFile(void *handle, const void *buffer, uint32 count, _Out_ uint32 *bytes, void *overlapped)'),
    result: kernel.func('int32 __stdcall GetOverlappedResult(void *handle, void *overlapped, _Out_ uint32 *bytes, int32 wait)'),
    cancel: kernel.func('int32 __stdcall CancelIoEx(void *handle, void *overlapped)'),
    lastError: kernel.func('uint32 __stdcall GetLastError()'),
  };
}
function enumerateInterfaces(api = createApi()) {
  const guid = { a: 0x9eec98bb, b: 0x3c54, c: 0x45d4, d: [0xa8, 0x43, 0x79, 0, 0xc4, 0x63, 0x5e, 8] };
  const list = api.getDevices(guid, null, null, 0x12); // PRESENT | DEVICEINTERFACE
  if (api.invalid(list)) throw new Error(`Could not enumerate AirPods controls (Windows ${api.lastError()}).`);
  const paths = [];
  try {
    for (let i = 0; ; i++) {
      const info = { size: api.koffi.sizeof(api.types.Interface) };
      if (!api.enumInterface(list, null, guid, i, info)) {
        const error = api.lastError();
        if (error !== 259) throw new Error(`Could not enumerate AirPods controls (Windows ${error}).`);
        break;
      }
      const required = [0];
      api.getDetail(list, info, null, 0, required, null);
      if (required[0] < 8 || required[0] > 65536) throw new Error('Invalid AirPods driver interface size.');
      const detail = Buffer.alloc(required[0]);
      detail.writeUInt32LE(8); // sizeof(SP_DEVICE_INTERFACE_DETAIL_DATA_W), x64. Path starts at byte 4.
      if (!api.getDetail(list, info, detail, detail.length, required, null)) throw new Error(`Could not read AirPods interface (Windows ${api.lastError()}).`);
      paths.push(detail.subarray(4).toString('utf16le').split('\0')[0]);
    }
    return paths;
  } finally { api.destroy(list); }
}
function openTransport(deviceId, api = createApi()) {
  const devicePath = enumerateInterfaces(api).find(p => matchesDevice(p, deviceId));
  if (!devicePath) {
    const error = new Error('MagicAAP driver unavailable for these AirPods.'); error.code = 'driver-missing'; throw error;
  }
  const handle = api.open(devicePath, 0xc0000000, 3, null, 3, 0x40000000, null);
  if (api.invalid(handle)) {
    const code = api.lastError();
    throw new Error(code === 5 || code === 32 ? 'AirPods controls are busy or access was denied. Close other AirPods control apps and retry.' : `Could not open AirPods controls (Windows ${code}).`);
  }
  return createTransport(api, handle);
}
function createTransport(api, handle) {
  let closed = false;
  const operations = new Set();
  // Buffers stay strongly referenced until cancellation/completion is confirmed.
  function transfer(kind, buffer, timeoutMs) {
    if (closed) return Promise.reject(new Error('AirPods control connection is closed.'));
    return new Promise((resolve, reject) => {
      const overlapped = Buffer.alloc(api.koffi.sizeof(api.types.Overlapped));
      const bytes = [0];
      const op = { buffer, overlapped, timer: null, cancelled: false, cancel() { if (!op.cancelled) { op.cancelled = true; api.cancel(handle, overlapped); } } };
      operations.add(op);
      const started = Date.now();
      function finish(error) {
        clearTimeout(op.timer); operations.delete(op);
        if (error) reject(error); else if (op.cancelled) reject(new Error('AirPods control request timed out or was disconnected.'));
        else if (kind === 'write' && bytes[0] !== buffer.length) reject(new Error('AirPods received an incomplete command.'));
        else resolve(kind === 'read' ? buffer.subarray(0, bytes[0]) : undefined);
      }
      function poll() {
        if (api.result(handle, overlapped, bytes, 0)) return finish();
        const code = api.lastError();
        if (code !== 996) return finish(new Error(`AirPods ${kind} failed (Windows ${code}).`));
        if (closed || (timeoutMs && Date.now() - started > timeoutMs)) op.cancel();
        op.timer = setTimeout(poll, 20);
      }
      if (api[kind](handle, buffer, buffer.length, bytes, overlapped)) return finish();
      const code = api.lastError();
      if (code !== 997) return finish(new Error(`AirPods ${kind} failed (Windows ${code}).`));
      op.timer = setTimeout(poll, 20);
    });
  }
  return {
    read: () => transfer('read', Buffer.alloc(4096), 0),
    write: packet => transfer('write', packet, 5000),
    async close() {
      closed = true;
      for (const op of operations) op.cancel();
      while (operations.size) await new Promise(resolve => setTimeout(resolve, 20));
      api.close(handle);
    },
  };
}
module.exports = { INTERFACE, defineTypes, matchesDevice, createApi, enumerateInterfaces, openTransport, createTransport };
