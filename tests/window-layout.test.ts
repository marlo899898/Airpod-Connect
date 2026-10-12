import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
const { windowBounds } = createRequire(import.meta.url)('../electron/window-layout.cjs');
it('replaces the large window with a compact panel centered in the same area', () => {
  expect(windowBounds('compact', { x: 100, y: 100, width: 680, height: 630 }, { x: 0, y: 0, width: 1920, height: 1080 })).toEqual({ x: 225, y: 100, width: 430, height: 250 });
});
it('keeps the controls visible on scaled and secondary monitors', () => {
  expect(windowBounds('compact', { x: -200, y: 600, width: 680, height: 630 }, { x: -1280, y: 0, width: 1280, height: 720 })).toEqual({ x: -430, y: 470, width: 430, height: 250 });
});
it('restores the setup window and rejects unrecognized modes', () => {
  expect(windowBounds('setup', { x: 225, y: 100, width: 430, height: 250 }, { x: 0, y: 0, width: 1920, height: 1080 })).toEqual({ x: 100, y: 100, width: 680, height: 630 });
  expect(() => windowBounds('wrong', {}, {})).toThrow('Invalid window view');
});
