const { openTransport } = require('./windows-noise.cjs');
const { NoiseSession } = require('./noise-protocol.cjs');
const port = process.parentPort;
let session, transport, stopping = false, readyTimer;
const send = message => port.postMessage(message);
function state(value) {
  if (stopping) return;
  if (value.status === 'ready') clearTimeout(readyTimer);
  send({ type: 'state', ...value });
}
async function stop() {
  if (stopping) return;
  stopping = true; clearTimeout(readyTimer); session?.close();
  await transport?.close();
  process.exit(0);
}
port.on('message', async ({ data }) => {
  if (data?.type === 'close') return stop();
  if (data?.type !== 'set' || !session || stopping) return;
  try { const mode = await session.setMode(data.mode); send({ type: 'reply', requestId: data.requestId, mode }); }
  catch (error) { send({ type: 'reply', requestId: data.requestId, error: error.message }); }
});
(async () => {
  try {
    transport = openTransport(process.argv[2]);
    session = new NoiseSession(transport, state);
    readyTimer = setTimeout(() => {
      state({ status: 'error', mode: null, error: 'AirPods did not answer. Close other AirPods control apps, reconnect your earbuds, then retry.' });
      stop();
    }, 8000);
    (async () => {
      try {
        while (!stopping) {
          const packet = await transport.read();
          if (!packet.length) throw new Error('AirPods closed the control connection.');
          session.receive(packet);
        }
      } catch (error) {
        if (!stopping) { state({ status: 'error', mode: null, error: error.message }); stop(); }
      }
    })();
    await session.start();
  } catch (error) {
    state({ status: error.code === 'driver-missing' ? 'driver-missing' : 'error', mode: null, error: error.message });
    stop();
  }
})();
