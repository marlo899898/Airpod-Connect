import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { defineTypes, decodeDevice, enumerateBluetooth } = require('../electron/windows-bluetooth.cjs');
const koffi = require('koffi');
function raw(name = 'AirPods Pro', connected = 1, address = 0x112233445566) {
  return { address, connected, name: [...name].flatMap(c => Array.from({ length: c.length }, (_, i) => c.charCodeAt(i))).concat(0) };
}
function fakeApi(rows: ReturnType<typeof raw>[] = [raw()]) {
  let index = 0;
  const closed: string[] = [];
  const api = {
    sizes: { radio: 4, search: 40, device: 560 },
    firstRadio: (_params: unknown, radio: unknown[]) => { radio[0] = 'radio'; return 'radio-find'; },
    closeRadioFind: () => { closed.push('radio-find'); },
    closeHandle: () => { closed.push('radio'); },
    firstDevice: (params: any, info: any) => { expect(params.inquiry).toBe(0); expect(info.size).toBe(560); if (!rows.length) return null; Object.assign(info, rows[index++]); return 'device-find'; },
    nextDevice: (_handle: unknown, info: any) => { expect(info.size).toBe(560); if (index === rows.length) return 0; Object.assign(info, rows[index++]); return 1; },
    closeDeviceFind: () => { closed.push('device-find'); },
    lastError: () => 259,
  };
  return { api, closed };
}
describe('native Windows Bluetooth discovery', () => {
  it('matches the x64 Windows ABI including WCHAR and structure padding', () => {
    const t = defineTypes(koffi);
    expect(koffi.sizeof(t.RadioParams)).toBe(4);
    expect(koffi.sizeof(t.SearchParams)).toBe(40);
    expect(koffi.sizeof(t.DeviceInfo)).toBe(560);
    expect(koffi.offsetof(t.DeviceInfo, 'name')).toBe(64);
    expect(koffi.offsetof(t.SearchParams, 'radio')).toBe(32);
  });
  it('decodes UTF-16 names and stable Bluetooth addresses without treating paired as connected', () => {
    expect(decodeDevice(raw('Zoë’s AirPods', 0))).toEqual({ id: 'bluetooth:11:22:33:44:55:66', name: 'Zoë’s AirPods', connected: false });
  });
  it('queries paired devices without inquiry and closes every native handle', () => {
    const { api, closed } = fakeApi([raw(), raw('Other', 0, 0x223344556677)]);
    const result = enumerateBluetooth(api);
    expect(result.adapterAvailable).toBe(true);
    expect(result.devices.map((d: any) => d.connected)).toEqual([true, false]);
    expect(closed).toEqual(['radio', 'radio-find', 'device-find']);
  });
  it('reports a missing adapter independently from an empty paired-device list', () => {
    const { api } = fakeApi([]);
    expect(enumerateBluetooth(api)).toEqual({ devices: [], adapterAvailable: true });
    api.firstRadio = () => null as any;
    expect(enumerateBluetooth(api)).toEqual({ devices: [], adapterAvailable: false });
  });
  it('preserves meaningful Windows errors and closes the search on failure', () => {
    const { api, closed } = fakeApi();
    api.lastError = () => 5;
    expect(() => enumerateBluetooth(api)).toThrow('Windows denied Bluetooth access (error 5)');
    expect(closed).toContain('device-find');
  });
  it('deduplicates devices seen by multiple adapters, preferring connected state', () => {
    const { api } = fakeApi([raw('AirPods', 0), raw('AirPods', 1)]);
    const result = enumerateBluetooth(api);
    expect(result.devices).toHaveLength(1);
    expect(result.devices[0].connected).toBe(true);
  });
});
