import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
const require = createRequire(import.meta.url);
const { command, parseMode, NoiseSession } = require('../electron/noise-protocol.cjs');
const { matchesDevice, defineTypes, enumerateInterfaces, createTransport } = require('../electron/windows-noise.cjs');
const { NoiseService } = require('../electron/noise-service.cjs');
const koffi = require('koffi');
const id = 'bluetooth:11:22:33:44:55:66';
const devicePath = '\\\\?\\bthenum#{74ec2172-0bad-4d01-8f77-997b2be0722a}_vid&0001004c_pid&200e#8&abc&0&112233445566_c00000000#{9eec98bb-3c54-45d4-a843-7900c4635e08}';
afterEach(() => vi.useRealTimers());
describe('real noise-control protocol', () => {
  it.each([['off', 1], ['cancellation', 2], ['transparency', 3], ['adaptive', 4]])('encodes %s exactly', (mode, value) => {
    expect(command(mode)).toEqual(Buffer.from([4, 0, 4, 0, 9, 0, 13, value, 0, 0, 0]));
    expect(parseMode(command(mode))).toBe(mode);
  });
  it('rejects unsupported commands, truncated packets and unrelated settings', () => {
    expect(() => command('__proto__')).toThrow('Invalid noise mode');
    expect(parseMode(command('off').subarray(0, 8))).toBeNull();
    const other = command('off'); other[6] = 0x28;
    expect(parseMode(other)).toBeNull();
    other[6] = 13; other[7] = 99;
    expect(parseMode(other)).toBeNull();
  });
  it('waits for matching hardware notification and follows changes from the stem', async () => {
    const write = vi.fn(async () => {}); const publish = vi.fn();
    const session = new NoiseSession({ write }, publish);
    session.receive(command('off'));
    const promise = session.setMode('cancellation');
    await Promise.resolve();
    expect(write).toHaveBeenCalledWith(command('cancellation'));
    expect(session.mode).toBe('off');
    session.receive(command('transparency'));
    expect(session.pending).not.toBeNull();
    session.receive(command('cancellation'));
    await expect(promise).resolves.toBe('cancellation');
    session.receive(command('adaptive'));
    expect(publish).toHaveBeenLastCalledWith({ status: 'ready', mode: 'adaptive', error: null });
    session.close();
  });
  it('does not claim success when the device is silent, and allows a retry', async () => {
    vi.useFakeTimers();
    const session = new NoiseSession({ write: async () => {} }, () => {}, 100);
    session.receive(command('off'));
    const result = expect(session.setMode('cancellation')).rejects.toThrow('did not confirm');
    await vi.advanceTimersByTimeAsync(101); await result;
    expect(session.mode).toBe('off'); expect(session.pending).toBeNull(); session.close();
  });
  it('rejects concurrent changes, native write failures and disconnect during a command', async () => {
    const session = new NoiseSession({ write: vi.fn(async () => {}) }, () => {});
    session.receive(command('off'));
    const result = expect(session.setMode('adaptive')).rejects.toThrow('disconnected');
    await expect(session.setMode('transparency')).rejects.toThrow('Wait');
    session.close(); await result;
    const failed = new NoiseSession({ write: async () => { throw new Error('Windows 5'); } }, () => {});
    failed.receive(command('off'));
    await expect(failed.setMode('adaptive')).rejects.toThrow('Windows 5');
    expect(failed.mode).toBe('off'); failed.close();
  });
});
describe('Windows driver transport', () => {
  it('uses correct Windows x64 structure layouts', () => {
    const t = defineTypes(koffi);
    expect(koffi.sizeof(t.Guid)).toBe(16);
    expect(koffi.sizeof(t.Interface)).toBe(32);
    expect(koffi.offsetof(t.Interface, 'reserved')).toBe(24);
    expect(koffi.sizeof(t.Overlapped)).toBe(32);
    expect(koffi.offsetof(t.Overlapped, 'event')).toBe(24);
  });
  it('only opens the selected address on the MagicAAP interface, including leading zeros', () => {
    expect(matchesDevice(devicePath, id)).toBe(true);
    expect(matchesDevice(devicePath, 'bluetooth:22:33:44:55:66:77')).toBe(false);
    expect(matchesDevice(devicePath, '445566')).toBe(false);
    expect(matchesDevice(devicePath.replace('9eec98bb', '74ec2172'), id)).toBe(false);
    expect(matchesDevice(devicePath.replace('112233445566', '002233445566'), 'bluetooth:00:22:33:44:55:66')).toBe(true);
  });
  it('decodes the UTF-16 interface at byte 4 and releases the device list on failures', () => {
    const destroy = vi.fn();
    const api = { koffi, types: defineTypes(koffi), invalid: () => false, getDevices: () => 123, destroy,
      enumInterface: (_a: any, _b: any, _c: any, index: number) => index === 0, lastError: () => 259,
      getDetail: (_a: any, _b: any, detail: Buffer | null, _c: any, size: number[]) => {
        const path = Buffer.from(devicePath + '\0', 'utf16le'); size[0] = path.length + 4;
        if (detail) { expect(detail.readUInt32LE(0)).toBe(8); path.copy(detail, 4); }
        return detail ? 1 : 0;
      } };
    expect(enumerateInterfaces(api)).toEqual([devicePath]);
    expect(destroy).toHaveBeenCalledWith(123);
    api.getDetail = () => { throw new Error('native error'); };
    expect(() => enumerateInterfaces(api)).toThrow('native error');
    expect(destroy).toHaveBeenCalledTimes(2);
  });
  it('keeps asynchronous read buffers alive through cancellation and closes afterwards', async () => {
    vi.useFakeTimers(); let cancelled = false; let retained: Buffer | undefined;
    const close = vi.fn();
    const api = { koffi, types: defineTypes(koffi), close,
      read: (_h: any, b: Buffer) => { retained = b; return 0; },
      result: () => 0, lastError: vi.fn().mockReturnValueOnce(997).mockImplementation(() => cancelled ? 995 : 996),
      cancel: () => { cancelled = true; },
    };
    const transport = createTransport(api, 123);
    const read = expect(transport.read()).rejects.toThrow('Windows 995');
    const closing = transport.close();
    expect(close).not.toHaveBeenCalled(); expect(retained?.length).toBe(4096);
    await vi.advanceTimersByTimeAsync(50); await read; await closing;
    expect(close).toHaveBeenCalledWith(123);
  });
  it('checks completed write byte counts instead of treating a partial write as success', async () => {
    const api = { koffi, types: defineTypes(koffi), write: (_h: any, _b: any, _n: any, bytes: number[]) => { bytes[0] = 2; return 1; }, close: vi.fn() };
    const transport = createTransport(api, 123);
    await expect(transport.write(command('adaptive'))).rejects.toThrow('incomplete');
    await transport.close();
  });
});
class Worker extends EventEmitter {
  postMessage = vi.fn(); kill = vi.fn();
}
describe('control process supervisor', () => {
  it('ignores retired workers and rejects a pending command when changing devices', async () => {
    vi.useFakeTimers();
    const workers: Worker[] = [];
    const service = new NoiseService(() => { const w = new Worker(); workers.push(w); return w; }, () => {});
    service.connect(id);
    workers[0].emit('message', { type: 'state', status: 'ready', mode: 'off' });
    const result = expect(service.setMode(id, 'adaptive')).rejects.toThrow('disconnected');
    service.connect('bluetooth:22:33:44:55:66:77');
    await result;
    workers[0].emit('message', { type: 'state', status: 'ready', mode: 'adaptive' });
    expect(service.state.mode).toBeNull();
    workers[0].emit('exit');
    expect(service.state.status).toBe('connecting'); service.disconnect();
  });
  it('handles missing driver, rejects invalid modes and unconnected device commands', async () => {
    vi.useFakeTimers(); const worker = new Worker();
    const service = new NoiseService(() => worker, () => {});
    expect(() => service.connect('fake')).toThrow('Invalid');
    service.connect(id);
    worker.emit('message', { type: 'state', status: 'driver-missing', error: 'Unavailable' });
    expect(service.state.status).toBe('driver-missing'); expect(service.worker).toBeNull();
    await expect(service.setMode(id, 'off')).rejects.toThrow('not connected');
    await expect(service.setMode(id, '__proto__')).rejects.toThrow('Invalid');
    service.disconnect();
  });
});
