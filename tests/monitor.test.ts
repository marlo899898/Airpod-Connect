import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
const { updateConnections } = createRequire(import.meta.url)('../electron/device-monitor.cjs');
const device = { id: 'a', name: 'AirPods Pro', connected: true };
describe('native connection monitor', () => {
  it('establishes a baseline without notifying on initial startup', () => {
    const next = updateConnections(null, { devices: [device] });
    expect([...next.current]).toEqual(['a']);
    expect(next.arrivals).toEqual([]);
  });
  it('notifies exactly once per new connection', () => {
    const arrival = updateConnections(new Set(), { devices: [device] });
    expect(arrival.arrivals).toEqual([device]);
    expect(updateConnections(arrival.current, { devices: [device] }).arrivals).toEqual([]);
    const disconnected = updateConnections(arrival.current, { devices: [{ ...device, connected: false }] });
    expect(updateConnections(disconnected.current, { devices: [device] }).arrivals).toEqual([device]);
  });
  it('does not emit a false reconnection after a failed scan', () => {
    const failed = updateConnections(new Set(['a']), { devices: [], error: 'Timeout' });
    expect(updateConnections(failed.current, { devices: [device] }).arrivals).toEqual([]);
  });
  it('monitors a manually selected renamed device', () => {
    const renamed = { ...device, name: 'My music' };
    expect(updateConnections(new Set(), { devices: [renamed] }).arrivals).toEqual([]);
    expect(updateConnections(new Set(), { devices: [renamed] }, 'a').arrivals).toEqual([renamed]);
  });
});
