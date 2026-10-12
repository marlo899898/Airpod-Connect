export type ModelId = 'unknown' | 'airpods-2' | 'airpods-3' | 'airpods-4' | 'airpods-4-anc' | 'pro' | 'pro-1' | 'pro-2' | 'pro-3' | 'max';
export type NoiseMode = 'off' | 'cancellation' | 'transparency' | 'adaptive';
export interface AirPodsModel { id: ModelId; name: string; shortName: string; modes: NoiseMode[]; image: string; description: string; }
const basic: NoiseMode[] = [];
const anc: NoiseMode[] = ['cancellation', 'transparency', 'off'];
const adaptive: NoiseMode[] = ['cancellation', 'transparency', 'adaptive', 'off'];
export const MODELS: Record<ModelId, AirPodsModel> = {
  unknown: { id: 'unknown', name: 'AirPods', shortName: 'AirPods', modes: basic, image: 'airpods-pro', description: 'Choose your model to see its features.' },
  'airpods-2': { id: 'airpods-2', name: 'AirPods (1st / 2nd generation)', shortName: 'AirPods', modes: basic, image: 'airpods', description: 'The original. Effortlessly yours.' },
  'airpods-3': { id: 'airpods-3', name: 'AirPods (3rd generation)', shortName: 'AirPods 3', modes: basic, image: 'airpods-3', description: 'A little more sound. A lot more feeling.' },
  'airpods-4': { id: 'airpods-4', name: 'AirPods 4', shortName: 'AirPods 4', modes: basic, image: 'airpods-4', description: 'An open fit. A world of sound.' },
  'airpods-4-anc': { id: 'airpods-4-anc', name: 'AirPods 4 with ANC', shortName: 'AirPods 4', modes: adaptive, image: 'airpods-4-anc', description: 'Your world, with a little less noise.' },
  pro: { id: 'pro', name: 'AirPods Pro (generation unknown)', shortName: 'AirPods Pro', modes: anc, image: 'airpods-pro-1', description: 'Your sound. Your space.' },
  'pro-1': { id: 'pro-1', name: 'AirPods Pro (1st generation)', shortName: 'AirPods Pro', modes: anc, image: 'airpods-pro-1', description: 'Your sound. Your space.' },
  'pro-2': { id: 'pro-2', name: 'AirPods Pro (2nd generation)', shortName: 'AirPods Pro', modes: adaptive, image: 'airpods-pro', description: 'A little quiet. A lot of possibility.' },
  'pro-3': { id: 'pro-3', name: 'AirPods Pro (3rd generation)', shortName: 'AirPods Pro', modes: adaptive, image: 'airpods-pro-3', description: 'A little quiet. A lot of possibility.' },
  max: { id: 'max', name: 'AirPods Max', shortName: 'AirPods Max', modes: anc, image: 'airpods-max', description: 'A whole new dimension of sound.' },
};
export function inferModel(name: string): ModelId {
  const value = name.toLowerCase();
  if (!/air\s*pods/.test(value)) return 'unknown';
  if (/max/.test(value)) return 'max';
  if (/pro/.test(value)) {
    if (/pro\s*(?:\(|-)?\s*(?:3|third)/.test(value)) return 'pro-3';
    if (/pro\s*(?:\(|-)?\s*(?:2|second)/.test(value)) return 'pro-2';
    if (/pro\s*(?:\(|-)?\s*(?:1|first)/.test(value)) return 'pro-1';
    return 'pro';
  }
  if (/air\s*pods\s*(?:\(|-)?\s*4/.test(value)) return /anc|noise/.test(value) ? 'airpods-4-anc' : 'airpods-4';
  if (/air\s*pods\s*(?:\(|-)?\s*3/.test(value)) return 'airpods-3';
  if (/air\s*pods\s*(?:\(|-)?\s*[12]/.test(value)) return 'airpods-2';
  return 'unknown';
}
export interface BluetoothDevice { id: string; name: string; connected: boolean; }
export interface ScanResult { devices: BluetoothDevice[]; error?: string; platform: string; scannedAt: number; }
export function selectDevice(devices: BluetoothDevice[], preferredId?: string): BluetoothDevice | undefined {
  return devices.find(d => d.id === preferredId && d.connected)
    ?? devices.find(d => /air\s*pods/i.test(d.name) && d.connected)
    ?? devices.find(d => d.id === preferredId)
    ?? devices.find(d => /air\s*pods/i.test(d.name));
}
export interface Preferences { theme: 'dark' | 'light' | 'system'; autoOpen: boolean; notifications: boolean; launchAtLogin: boolean; preferredDevice: string; modelOverrides: Record<string, ModelId>; }
export const defaults: Preferences = { theme: 'dark', autoOpen: true, notifications: true, launchAtLogin: false, preferredDevice: '', modelOverrides: {} };
export function readPreferences(raw: string | null): Preferences {
  try {
    const p = JSON.parse(raw || '{}');
    if (!p || typeof p !== 'object') return { ...defaults };
    return {
      theme: ['dark','light','system'].includes(p.theme) ? p.theme : 'dark',
      autoOpen: typeof p.autoOpen === 'boolean' ? p.autoOpen : true,
      notifications: typeof p.notifications === 'boolean' ? p.notifications : true,
      launchAtLogin: typeof p.launchAtLogin === 'boolean' ? p.launchAtLogin : false,
      preferredDevice: typeof p.preferredDevice === 'string' ? p.preferredDevice : '',
      modelOverrides: p.modelOverrides && typeof p.modelOverrides === 'object' ? Object.fromEntries(Object.entries(p.modelOverrides).filter(([,v]) => typeof v === 'string' && Object.hasOwn(MODELS, v))) as Record<string, ModelId> : {},
    };
  } catch { return { ...defaults }; }
}
