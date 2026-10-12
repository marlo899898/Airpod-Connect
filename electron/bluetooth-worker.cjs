const { scanBluetooth } = require('./windows-bluetooth.cjs');
// A separate utility process isolates native calls from the app's UI and main process.
process.parentPort.postMessage(scanBluetooth());
