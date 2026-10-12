import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, AudioLines, Bluetooth, Check, ChevronRight, Ear, Minus, Moon, Power, RefreshCw, Settings2, Sparkles, Sun, X, Monitor } from 'lucide-react';
import { MODELS, defaults, inferModel, readPreferences, selectDevice, type ModelId, type NoiseMode, type Preferences, type ScanResult } from './domain';

import type { NoiseState } from './native';
const idleNoise: NoiseState = { deviceId: null, status: 'disconnected', mode: null, error: null };
const demo = { id: 'preview', name: 'AirPods Pro', connected: true };
const modes = {
  cancellation: { name: 'Noise cancelling', icon: AudioLines },
  transparency: { name: 'Transparency', icon: Ear },
  adaptive: { name: 'Adaptive', icon: Sparkles },
  off: { name: 'Off', icon: Power },
};
type Page = 'setup' | 'compact' | 'settings';
function loadPreferences() {
  try { return readPreferences(localStorage.getItem('airpod-preferences')); }
  catch { return { ...defaults }; }
}
export default function App() {
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences);
  const [scan, setScan] = useState<ScanResult>({ devices: [], platform: window.airpod?.platform || 'browser', scannedAt: 0 });
  const [preview, setPreview] = useState(false);
  const [previewModel, setPreviewModel] = useState<ModelId>('pro-2');
  const [page, setPage] = useState<Page>('setup');
  const [scanning, setScanning] = useState(false);
  const [sampleMode, setSampleMode] = useState<NoiseMode>('cancellation');
  const [noise, setNoise] = useState<NoiseState>(idleNoise);
  const [pendingMode, setPendingMode] = useState<NoiseMode | null>(null);
  const [controlError, setControlError] = useState('');
  const controlGeneration = useRef(0);
  const [message, setMessage] = useState('');
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const device = preview ? demo : selectDevice(scan.devices, prefs.preferredDevice);
  const modelId = preview ? previewModel : device ? prefs.modelOverrides[device.id] || inferModel(device.name) : 'unknown';
  const model = MODELS[modelId];
  const connected = !!device?.connected;
  const theme = prefs.theme === 'system' ? systemDark ? 'dark' : 'light' : prefs.theme;

  async function refresh() {
    if (!window.airpod) { setMessage('Live detection is available in the Windows app.'); return; }
    setScanning(true);
    try { setScan(await window.airpod.scan()); }
    catch { setScan({ devices: [], platform: window.airpod.platform, scannedAt: Date.now(), error: 'The Bluetooth service could not be reached. Restart the app, then retry.' }); }
    finally { setScanning(false); }
  }
  useEffect(() => {
    if (!window.airpod) return;
    const unsubscribe = window.airpod.onDevices(setScan);
    const unsubscribePreferences = window.airpod.onPreferences(() => setPage('settings'));
    refresh();
    return () => { unsubscribe(); unsubscribePreferences(); };
  }, []);
  // React only to actual connection changes; repeated scans must not dismiss settings.
  useEffect(() => {
    setPage(connected ? 'compact' : 'setup');
  }, [device?.id, connected, preview]);
  useEffect(() => {
    const bridge = window.airpod;
    const generation = ++controlGeneration.current;
    setNoise(idleNoise); setPendingMode(null); setControlError('');
    if (!bridge || preview || !device?.connected || !model.modes.length) {
      bridge?.disconnectControls().catch(() => {});
      return;
    }
    const id = device.id;
    const accept = (state: NoiseState) => {
      if (generation === controlGeneration.current && (state.deviceId === id || state.status === 'disconnected')) setNoise(state);
    };
    const unsubscribe = bridge.onNoiseState(accept);
    bridge.connectControls(id).then(accept).catch(error => {
      if (generation === controlGeneration.current) setNoise({ ...idleNoise, deviceId: id, status: 'error', error: String(error.message) });
    });
    return () => { ++controlGeneration.current; unsubscribe(); bridge.disconnectControls().catch(() => {}); };
  }, [device?.id, connected, preview, modelId]);
  async function retryControls() {
    if (!window.airpod || !device) return;
    const generation = controlGeneration.current;
    setControlError('');
    setNoise({ ...idleNoise, deviceId: device.id, status: 'connecting' });
    try { const state = await window.airpod.connectControls(device.id); if (generation === controlGeneration.current) setNoise(state); }
    catch (error) { if (generation === controlGeneration.current) setNoise({ ...idleNoise, deviceId: device.id, status: 'error', error: String((error as Error).message) }); }
  }
  async function changeMode(mode: NoiseMode) {
    if (preview) { setSampleMode(mode); return; }
    if (!window.airpod || !device || pendingMode || noise.status !== 'ready') return;
    const generation = controlGeneration.current;
    setPendingMode(mode); setControlError('');
    try { await window.airpod.setNoiseMode(device.id, mode); }
    catch (error) { if (generation === controlGeneration.current) setControlError(String((error as Error).message).replace(/^Error invoking remote method '[^']+': Error: /, '')); }
    finally { if (generation === controlGeneration.current) setPendingMode(null); }
  }
  useEffect(() => {
    document.documentElement.dataset.view = page === 'compact' ? 'compact' : 'setup';
    window.airpod?.setView(page === 'compact' ? 'compact' : 'setup').catch(() => setMessage('The window could not be resized. Restart the app to restore the compact layout.'));
  }, [page]);
  useEffect(() => {
    try { localStorage.setItem('airpod-preferences', JSON.stringify(prefs)); }
    catch { setMessage('Preferences could not be saved.'); }
  }, [prefs]);
  useEffect(() => {
    if (!window.airpod) return;
    let current = true;
    window.airpod.configure({ autoOpen: prefs.autoOpen, notifications: prefs.notifications, launchAtLogin: prefs.launchAtLogin, preferredDevice: prefs.preferredDevice }).then(result => {
      if (current && result.launchAtLogin !== prefs.launchAtLogin) setPrefs(p => ({ ...p, launchAtLogin: result.launchAtLogin }));
    }).catch(() => { if (current) setMessage('Connection preferences could not be saved.'); });
    return () => { current = false; };
  }, [prefs.autoOpen, prefs.notifications, prefs.launchAtLogin, prefs.preferredDevice]);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 6000);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    if (!model.modes.includes(sampleMode) && model.modes.length) setSampleMode(model.modes[0]);
  }, [modelId]);
  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) { setPrefs(p => ({ ...p, [key]: value })); }
  function chooseModel(value: ModelId) {
    if (preview) setPreviewModel(value);
    else if (device) setPrefs(p => ({ ...p, modelOverrides: { ...p.modelOverrides, [device.id]: value } }));
  }
  async function bluetoothSettings() {
    if (!window.airpod) { setMessage('Open the Windows desktop app to pair your AirPods.'); return; }
    try { await window.airpod.settings('bluetooth'); }
    catch { setMessage('Windows Bluetooth settings could not be opened.'); }
  }
  function close() {
    if (window.airpod) window.airpod.close();
    else { setPreview(false); setPage('setup'); }
  }

  if (page === 'compact' && connected) return <main className="compact-panel" aria-label="AirPods compact controls">
    <header className="compact-header">
      <div className="compact-device"><span className="status-dot" /><h1>{model.shortName}</h1>{preview && <span className="preview-label">PREVIEW</span>}</div>
      <div className="window-actions">
        {preview && <button aria-label="Preview preferences" onClick={() => setPage('settings')}><Settings2 size={15} /></button>}
        <button aria-label="Close controls" onClick={close}><X size={16} /></button>
      </div>
    </header>
    {model.modes.length > 0 ? <>
      <div className="compact-modes" style={{ '--count': model.modes.length } as CSSProperties}>
        {model.modes.map(id => {
          const Icon = modes[id].icon;
          const selected = preview ? sampleMode === id : noise.status === 'ready' && noise.deviceId === device?.id && noise.mode === id;
          return <button key={id} className={`noise-mode ${selected ? 'selected' : ''}`} aria-label={modes[id].name} aria-pressed={selected} aria-busy={!preview && pendingMode === id} disabled={!preview && (noise.status !== 'ready' || pendingMode !== null)}
            onClick={() => changeMode(id)}>
            {pendingMode === id ? <RefreshCw size={23} className="spin" /> : <Icon size={23} strokeWidth={1.65} />}<span>{modes[id].name}</span>{selected && <i><Check size={9} /></i>}
          </button>;
        })}
      </div>
      <div className="control-note" role="status">
        {preview ? 'Preview only — no command is sent to AirPods.' : pendingMode ? 'Waiting for AirPods…' : controlError || (noise.status === 'ready' ? '' : noise.status === 'driver-missing' ? 'Control driver required.' : noise.status === 'connecting' ? 'Connecting controls…' : noise.error || 'Controls disconnected.')}
        {!preview && noise.status === 'driver-missing' && <button onClick={() => window.airpod?.driverInfo().catch(() => setControlError('Open Preferences for driver information.'))}>Driver details</button>}
        {!preview && ['driver-missing', 'error', 'disconnected'].includes(noise.status) && <button onClick={retryControls}>Retry</button>}
      </div>
    </> : <div className="compact-empty">
      <p>{modelId === 'unknown' ? 'Choose your model to see its listening modes.' : 'This model does not support noise control.'}</p>
      <button className="text-button" onClick={() => setPage('settings')}>{modelId === 'unknown' ? 'Choose model' : 'Preferences'}<ChevronRight size={14} /></button>
    </div>}
  </main>;

  return <main className="setup-panel">
    <header className="app-header">
      <div className="brand"><span><AudioLines size={21} /></span>airpod connect<span className="brand-period">.</span></div>
      <div className="window-actions">
        {page === 'setup' && <button aria-label="Preferences" onClick={() => setPage('settings')}><Settings2 size={17} /></button>}
        {window.airpod && <><button aria-label="Minimize window" onClick={() => window.airpod?.minimize()}><Minus size={16} /></button><button aria-label="Close to tray" onClick={close}><X size={16} /></button></>}
      </div>
    </header>
    {page === 'setup' ? <section className="connection-screen">
      <div className="product-stage" aria-label="AirPods product image" role="img"><span className="product-glow" /><div className="product-buds" /><div className="product-case" /></div>
      <h1>Connect your AirPods.</h1>
      <p className="subtitle">Your controls appear in a small window.<br />Everything else gets out of the way.</p>
      <button className="primary-button" onClick={bluetoothSettings}><Bluetooth size={17} />Open Bluetooth settings</button>
      <div className="connection-status"><span className={`waiting-dot ${scanning ? 'pulse' : ''}`} /><span>{scanning ? 'Checking Bluetooth…' : scan.adapterAvailable === false ? 'Turn on Bluetooth to connect.' : device ? `${device.name} is paired. Waiting for a connection.` : 'Waiting for your AirPods'}</span><button aria-label="Refresh Bluetooth" onClick={refresh} disabled={scanning}><RefreshCw size={13} className={scanning ? 'spin' : ''} /></button></div>
      {scan.error && <div className="scan-error" role="alert"><p>{scan.error}</p><button onClick={refresh}>Retry</button></div>}
      {scan.devices.length > 0 && <details className="paired-devices"><summary>Choose a paired device<ChevronRight size={14} /></summary><div>{scan.devices.map(d => <button key={d.id} onClick={() => update('preferredDevice', d.id)}><span>{d.name}</span><small>{d.connected ? 'Connected' : 'Paired'}</small></button>)}</div></details>}
      {!window.airpod && <button className="preview-button" onClick={() => setPreview(true)}>Preview compact controls<ChevronRight size={13} /></button>}
      <p className="tray-hint">Once connected, find preferences in the system tray.</p>
    </section> : <section className="settings-screen">
      <button className="back-button" onClick={() => setPage(connected ? 'compact' : 'setup')}><ArrowLeft size={15} />{connected ? 'Back to controls' : 'Back'}</button>
      <h1>Keep it simple.</h1>
      <p className="subtitle">Just the settings you need.</p>
      {device && <div className="setting-block"><label htmlFor="model">AirPods model</label><select id="model" value={modelId} onChange={e => chooseModel(e.target.value as ModelId)}>{Object.values(MODELS).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select><p className="field-hint">Names don’t always reveal the generation. We’ll remember your choice.</p></div>}
      <div className="setting-block"><span className="field-label">Appearance</span><div className="theme-options">{([{ id: 'dark', label: 'Dark', icon: Moon }, { id: 'light', label: 'Light', icon: Sun }, { id: 'system', label: 'System', icon: Monitor }] as const).map(t => <button key={t.id} aria-pressed={prefs.theme === t.id} onClick={() => update('theme', t.id)}><t.icon size={16} />{t.label}</button>)}</div></div>
      <div className="setting-row"><label htmlFor="auto-open">Open controls when AirPods connect</label><button id="auto-open" role="switch" aria-checked={prefs.autoOpen} aria-label="Open controls on connection" className={`toggle ${prefs.autoOpen ? 'on' : ''}`} onClick={() => update('autoOpen', !prefs.autoOpen)}><span /></button></div>
      <div className="setting-row"><label htmlFor="notifications">Connection notifications</label><button id="notifications" role="switch" aria-checked={prefs.notifications} aria-label="Connection notifications" className={`toggle ${prefs.notifications ? 'on' : ''}`} onClick={() => update('notifications', !prefs.notifications)}><span /></button></div>
      <div className="setting-block"><button className="text-button" onClick={() => window.airpod?.driverInfo()}>Noise-control driver requirements<ChevronRight size={14} /></button></div>
      <details className="about"><summary>About this app</summary><p>Airpod Connect 0.3.0. Detection uses native Windows Bluetooth; no PowerShell or administrator access is required.</p><p>Live noise control requires a separately installed MagicAAP driver. Buttons send commands and highlight the mode reported by AirPods. The driver publisher currently requires Windows security changes; review the requirements before considering installation. This app does not install drivers or change Windows security settings.</p><p>Independent of Apple. Product renders: SpriteOvO/AirPodsDesktop (GPL-3.0). Inter: Rasmus Andersson (SIL OFL). Notices are bundled.</p></details>
      {preview && <button className="text-button" onClick={() => setPreview(false)}>Exit preview</button>}
    </section>}
    {message && <div className="toast" role="status">{message}<button aria-label="Dismiss message" onClick={() => setMessage('')}><X size={14} /></button></div>}
  </main>;
}
