import type { ScanResult } from './domain';
declare global {
  interface Window {
    airpod?: {
      setView(view: 'setup' | 'compact'): Promise<void>;
      onPreferences(callback: () => void): () => void;
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
