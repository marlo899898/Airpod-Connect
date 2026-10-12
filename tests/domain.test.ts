import { describe, expect, it } from 'vitest';
import { inferModel, MODELS, readPreferences, selectDevice } from '../src/domain';
describe('AirPods model capabilities', () => {
  it.each([
    ['Maya’s AirPods Pro', 'pro'], ['AirPods Pro 2', 'pro-2'], ['AirPods Pro (2nd generation)', 'pro-2'],
    ['AirPods Pro 3', 'pro-3'], ['AirPods Max', 'max'], ['AirPods 4 with ANC', 'airpods-4-anc'],
    ['AirPods 4', 'airpods-4'], ['AirPods (3rd generation)', 'airpods-3'], ['AirPods', 'unknown'], ['My headphones', 'unknown'],
  ])('infers %s conservatively', (name, expected) => expect(inferModel(name)).toBe(expected));
  it('does not invent adaptive support for an unknown Pro generation', () => {
    expect(MODELS[inferModel('AirPods Pro')].modes).not.toContain('adaptive');
    expect(MODELS['pro-2'].modes).toContain('adaptive');
    expect(MODELS['airpods-4-anc'].modes).toContain('adaptive');
    expect(MODELS.max.modes).not.toContain('adaptive');
  });
  it('has no noise control for open-fit models', () => {
    for (const model of ['unknown', 'airpods-2', 'airpods-3', 'airpods-4'] as const) expect(MODELS[model].modes).toEqual([]);
  });
});
describe('Bluetooth selection', () => {
  const paired = { id: 'a', name: 'AirPods Pro', connected: false };
  const connected = { id: 'b', name: 'AirPods 4', connected: true };
  const renamed = { id: 'c', name: 'My quiet place', connected: true };
  it('prefers a live connection over a remembered disconnected device', () => expect(selectDevice([paired, connected], 'a')).toEqual(connected));
  it('remembers a renamed device', () => expect(selectDevice([connected, renamed], 'c')).toEqual(renamed));
  it('does not select unrelated Bluetooth hardware automatically', () => expect(selectDevice([renamed])).toBeUndefined());
  it('preserves a paired AirPods entry when disconnected', () => expect(selectDevice([paired])).toEqual(paired));
});
describe('preference persistence', () => {
  it('recovers from malformed or null stored preferences', () => {
    expect(readPreferences('{').theme).toBe('dark');
    expect(readPreferences('null').autoOpen).toBe(true);
  });
  it('validates types and rejects unknown models', () => {
    const prefs = readPreferences(JSON.stringify({ theme: 'blue', autoOpen: 'false', modelOverrides: { a: 'invalid', b: 'pro-2', c: '__proto__' } }));
    expect(prefs.theme).toBe('dark');
    expect(prefs.autoOpen).toBe(true);
    expect(prefs.modelOverrides).toEqual({ b: 'pro-2' });
  });
});
