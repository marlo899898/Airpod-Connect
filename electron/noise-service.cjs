const { VALUES } = require('./noise-protocol.cjs');
class NoiseService {
  constructor(spawn, publish) {
    this.spawn = spawn; this.publish = publish; this.worker = null; this.sequence = 0; this.pending = null;
    this.state = { deviceId: null, status: 'disconnected', mode: null, error: null };
  }
  emit(patch) { this.state = { ...this.state, ...patch }; this.publish(this.state); return this.state; }
  connect(deviceId) {
    if (!/^bluetooth:(?:[A-F\d]{2}:){5}[A-F\d]{2}$/i.test(deviceId)) throw new Error('Invalid AirPods address.');
    if (this.worker && this.state.deviceId === deviceId) return this.state;
    this.disconnect();
    this.emit({ deviceId, status: 'connecting', mode: null, error: null });
    try {
      const worker = this.spawn(deviceId); this.worker = worker;
      worker.stdout?.resume(); worker.stderr?.resume();
      const deadline = setTimeout(() => {
        if (this.worker !== worker || this.state.status !== 'connecting') return;
        this.fail('AirPods controls did not respond. Reconnect your earbuds and retry.');
      }, 12000);
      worker.on('message', data => {
        if (this.worker !== worker || !data) return;
        if (data.type === 'state') {
          if (!['ready', 'driver-missing', 'error'].includes(data.status)) return;
          if (data.status === 'ready' && !Object.hasOwn(VALUES, data.mode)) return;
          clearTimeout(deadline);
          this.emit({ status: data.status, mode: data.status === 'ready' ? data.mode : null, error: typeof data.error === 'string' ? data.error.slice(0, 500) : null });
          if (data.status !== 'ready') this.retire();
        } else if (data.type === 'reply' && data.requestId === this.pending?.id) {
          if (typeof data.error === 'string') this.pending.finish(new Error(data.error));
          else if (data.mode === this.pending.mode) this.pending.finish(null, data.mode);
        }
      });
      worker.on('exit', () => {
        clearTimeout(deadline);
        if (this.worker === worker) this.fail('AirPods controls disconnected. Reconnect your earbuds and retry.');
      });
    } catch (error) { this.fail(`Could not start AirPods controls: ${error.message}`); }
    return this.state;
  }
  retire() {
    const worker = this.worker; this.worker = null;
    this.pending?.finish(new Error('AirPods controls disconnected before confirming the change.'));
    if (worker) {
      // Allow CancelIoEx to finish before the process releases native buffers.
      try { worker.postMessage({ type: 'close' }); } catch {}
      const timer = setTimeout(() => worker.kill(), 2000); timer.unref?.();
      worker.once('exit', () => clearTimeout(timer));
    }
  }
  fail(error) { this.retire(); this.emit({ status: 'error', mode: null, error }); }
  disconnect() { this.retire(); return this.emit({ deviceId: null, status: 'disconnected', mode: null, error: null }); }
  setMode(deviceId, mode) {
    if (!Object.hasOwn(VALUES, mode)) return Promise.reject(new Error('Invalid noise mode.'));
    if (this.state.deviceId !== deviceId || this.state.status !== 'ready' || !this.worker) return Promise.reject(new Error('AirPods controls are not connected.'));
    if (this.pending) return Promise.reject(new Error('Wait for the current mode change.'));
    return new Promise((resolve, reject) => {
      const pending = { id: ++this.sequence, mode, timer: null, finish: (error, result) => {
        if (this.pending !== pending) return;
        clearTimeout(pending.timer); this.pending = null;
        if (error) reject(error); else resolve(result);
      } };
      this.pending = pending;
      pending.timer = setTimeout(() => { pending.finish(new Error('AirPods did not confirm the change. Reconnect and retry.')); this.fail('AirPods control service stopped responding. Retry the connection.'); }, 10000);
      try { this.worker.postMessage({ type: 'set', requestId: pending.id, mode }); }
      catch (error) { pending.finish(error); this.fail('Could not send the AirPods command. Retry the connection.'); }
    });
  }
}
module.exports = { NoiseService };
