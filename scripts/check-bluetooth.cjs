// Executes real Win32 bindings on Windows; no adapter is a valid, explicit result.
const assert = require('node:assert/strict');
const { createNativeApi, enumerateBluetooth } = require('../electron/windows-bluetooth.cjs');
assert.equal(process.platform, 'win32', 'Run this smoke test on Windows.');
const api = createNativeApi();
assert.deepEqual(api.sizes, { radio: 4, search: 40, device: 560 });
const result = enumerateBluetooth(api);
assert.equal(typeof result.adapterAvailable, 'boolean');
assert.ok(Array.isArray(result.devices));
for (const device of result.devices) {
  assert.match(device.id, /^bluetooth:(?:[A-F0-9]{2}:){5}[A-F0-9]{2}$/);
  assert.equal(typeof device.connected, 'boolean');
}
console.log(`Native Win32 Bluetooth query passed. Adapter available: ${result.adapterAvailable}; devices: ${result.devices.length}.`);

const noise = require('../electron/windows-noise.cjs');
const driver = noise.createApi();
assert.equal(driver.koffi.sizeof(driver.types.Interface), 32);
assert.equal(driver.koffi.sizeof(driver.types.Overlapped), 32);
const interfaces = noise.enumerateInterfaces(driver);
assert.ok(Array.isArray(interfaces));
console.log(`Native SetupAPI control driver query passed. Interfaces: ${interfaces.length}.`);
