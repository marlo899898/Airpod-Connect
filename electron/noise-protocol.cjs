// AAP wire format: public protocol findings, see docs/NOISE-CONTROL.md.
const VALUES = Object.freeze({ off: 1, cancellation: 2, transparency: 3, adaptive: 4 });
const HANDSHAKE = Buffer.from('00000400010002000000000000000000', 'hex');
const FEATURES = Buffer.from('040004004d00ff00000000000000', 'hex');
const NOTIFICATIONS = Buffer.from('040004000f00ffffffff', 'hex');
function command(mode) {
  if (!Object.hasOwn(VALUES, mode)) throw new Error('Invalid noise mode.');
  return Buffer.from([4, 0, 4, 0, 9, 0, 13, VALUES[mode], 0, 0, 0]);
}
function parseMode(packet) {
  // L2CAP preserves message boundaries. Do not search arbitrary payloads for a header.
  if (packet.length !== 11 || !packet.subarray(0, 7).equals(Buffer.from('0400040009000d', 'hex')) || packet[8] || packet[9] || packet[10]) return null;
  return Object.keys(VALUES).find(mode => VALUES[mode] === packet[7]) || null;
}
class NoiseSession {
  constructor(transport, publish, timeoutMs = 6000) {
    this.transport = transport; this.publish = publish; this.timeoutMs = timeoutMs;
    this.mode = null; this.pending = null; this.closed = false;
  }
  receive(packet) {
    if (this.closed) return;
    const mode = parseMode(packet);
    if (!mode) return;
    this.mode = mode;
    this.publish({ status: 'ready', mode, error: null });
    if (this.pending?.mode === mode) this.pending.finish(null, mode);
  }
  async start() {
    await this.transport.write(HANDSHAKE);
    await new Promise(resolve => setTimeout(resolve, 100));
    if (this.closed) return;
    await this.transport.write(FEATURES);
    await new Promise(resolve => setTimeout(resolve, 100));
    if (this.closed) return;
    await this.transport.write(NOTIFICATIONS);
  }
  setMode(mode) {
    const packet = command(mode);
    if (this.closed || !this.mode) return Promise.reject(new Error('AirPods controls are not connected.'));
    if (this.pending) return Promise.reject(new Error('Wait for the current mode change.'));
    if (this.mode === mode) return Promise.resolve(mode);
    return new Promise((resolve, reject) => {
      const finish = (error, confirmed) => {
        if (this.pending !== pending) return;
        clearTimeout(pending.timer); this.pending = null;
        if (error) reject(error); else resolve(confirmed);
      };
      const pending = { mode, finish, timer: setTimeout(() => finish(new Error('AirPods did not confirm the change. Try again with both earbuds in your ears.')), this.timeoutMs) };
      this.pending = pending;
      Promise.resolve().then(() => this.transport.write(packet)).catch(error => finish(error));
    });
  }
  close() {
    this.closed = true; this.mode = null;
    this.pending?.finish(new Error('AirPods disconnected before confirming the change.'));
  }
}
module.exports = { VALUES, HANDSHAKE, FEATURES, NOTIFICATIONS, command, parseMode, NoiseSession };
