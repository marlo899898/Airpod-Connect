/** Computes connection transitions without mistaking a failed scan for a disconnect. */
function updateConnections(previous, result, preferredDevice = '') {
  if (result.error) return { current: previous, arrivals: [] };
  const connected = result.devices.filter(d => d.connected && (/air\s*pods/i.test(d.name) || d.id === preferredDevice));
  const current = new Set(connected.map(d => d.id));
  return { current, arrivals: previous === null ? [] : connected.filter(d => !previous.has(d.id)) };
}
module.exports = { updateConnections };
