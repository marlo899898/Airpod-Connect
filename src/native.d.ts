import type { ScanResult, NoiseMode } from './domain';
export interface NoiseState { deviceId: string | null; status: 'disconnected' | 'connecting' | 'ready' | 'driver-missing' | 'error'; mode: NoiseMode | null; error: string | null }
declare global {
  interface Window {
    airpod?: {
      setView(view: 'setup' | 'compact'): Promise<void>;
      onPreferences(callback: () => void): () => void;
      connectControls(deviceId: string): Promise<NoiseState>;
      disconnectControls(): Promise<NoiseState>;
      setNoiseMode(deviceId: string, mode: NoiseMode): Promise<NoiseMode>;
      driverInfo(): Promise<void>;
      onNoiseState(callback: (state: NoiseState) => void): () => void;
      scan(): Promise<ScanResult>;
      onDevices(callback: (result: ScanResult) => void): () => void;
      settings(target: 'bluetooth' | 'sound'): Promise<void>;
      configure(preferences: { autoOpen: boolean; notifications: boolean; launchAtLogin: boolean; preferredDevice: string }): Promise<{ launchAtLogin: boolean }>;
      minimize(): void;
      close(): void;
      platform: string;
    };
  }
}
export {};
