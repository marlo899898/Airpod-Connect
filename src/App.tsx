import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AudioLines, Bluetooth, Headphones, Settings2, ChevronRight, ChevronDown, ArrowUpRight, ArrowRight, Check, X, Minus, RefreshCw, Volume2, Wind, Ear, Sparkles, Power, Battery, Zap, CircleHelp, Monitor, Sun, Moon, Radio, Bell, Search, Info, Laptop, ShieldCheck } from 'lucide-react';
import { MODELS, defaults, inferModel, readPreferences, selectDevice, type BluetoothDevice, type ModelId, type NoiseMode, type Preferences, type ScanResult } from './domain';

const demoDevice: BluetoothDevice = { id: 'preview', name: 'AirPods Pro', connected: true };
const modeDetails = {
  cancellation: { name: 'Noise cancellation', short: 'Noise cancelling', description: 'Just you and your sound.', icon: AudioLines, guide: 'Press and hold either AirPod stem to cycle to Noise Cancellation. On AirPods Max, press the noise control button.' },
  transparency: { name: 'Transparency', short: 'Transparency', description: 'Let the world come through.', icon: Ear, guide: 'Press and hold either AirPod stem to cycle to Transparency. On AirPods Max, press the noise control button.' },
  adaptive: { name: 'Adaptive audio', short: 'Adaptive', description: 'The best of both worlds.', icon: Sparkles, guide: 'Enable Adaptive Audio and add it to the press-and-hold cycle on a compatible iPhone, iPad, or Mac. Then use the stem to switch while connected to Windows. Requires compatible firmware.' },
  off: { name: 'Noise control off', short: 'Off', description: 'Keep it natural.', icon: Power, guide: 'Add Off to the listening-mode cycle in AirPods settings on an Apple device, then press and hold the stem to cycle to it. Availability depends on your model and firmware.' },
};
function Product({ model, part = 'buds', className = '' }: { model: ModelId; part?: 'buds' | 'case'; className?: string }) {
  return <div role="img" aria-label={`${MODELS[model].shortName} ${part === 'case' ? 'charging case' : 'earphones'}`} className={`product ${model === 'max' ? 'product-max' : ''} product-${part} ${className}`} style={{ '--product-image': `url("./images/${MODELS[model].image}.png")` } as CSSProperties} />;
}
function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return <button type="button" className={`toggle ${checked ? 'on' : ''}`} role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={onChange}><span /></button>;
}
function Modal({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const nodes = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select, a[href], input') || []);
    nodes()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'Tab') {
        const items = nodes(); const first = items[0]; const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, [close]);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><div ref={ref} className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-title"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={close}><X size={19} /></button></div>{children}</div></div>;
}
export default function App() {
  const [prefs, setPrefs] = useState<Preferences>(() => { try { return readPreferences(localStorage.getItem('airpod-preferences')); } catch { return { ...defaults }; } });
  const [page, setPage] = useState<'overview' | 'devices' | 'settings'>('overview');
  const [preview, setPreview] = useState(!window.airpod);
  const [previewModel, setPreviewModel] = useState<ModelId>('pro-2');
  const [scan, setScan] = useState<ScanResult>({ devices: [], platform: window.airpod?.platform || 'browser', scannedAt: 0 });
  const [scanning, setScanning] = useState(false);
  const [mode, setMode] = useState<NoiseMode>('cancellation');
  const [dialog, setDialog] = useState<'model' | 'help' | NoiseMode | null>(null);
  const [toast, setToast] = useState('');
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const nativeConfigVersion = useRef(0);
  const device = preview ? demoDevice : selectDevice(scan.devices, prefs.preferredDevice);
  const modelId = preview ? previewModel : device ? prefs.modelOverrides[device.id] || inferModel(device.name) : 'unknown';
  const model = MODELS[modelId];
  const connected = !!device?.connected;
  const theme = prefs.theme === 'system' ? systemDark ? 'dark' : 'light' : prefs.theme;
  const notify = (message: string) => setToast(message);
  async function refresh() {
    if (!window.airpod) { notify('Live detection is available in the Windows desktop app.'); return; }
    setScanning(true);
    try { setScan(await window.airpod.scan()); } catch { setScan({ devices: [], platform: window.airpod.platform, scannedAt: Date.now(), error: 'The Bluetooth service could not be reached. Please restart the app.' }); }
    finally { setScanning(false); }
  }
  useEffect(() => {
    if (!window.airpod) return;
    refresh();
    return window.airpod.onDevices(setScan);
  }, []);
  useEffect(() => {
    try { localStorage.setItem('airpod-preferences', JSON.stringify(prefs)); } catch { notify('Your preferences could not be saved on this device.'); }
  }, [prefs]);
  useEffect(() => {
    if (!window.airpod) return;
    const version = ++nativeConfigVersion.current;
    window.airpod.configure({ autoOpen: prefs.autoOpen, notifications: prefs.notifications, launchAtLogin: prefs.launchAtLogin, preferredDevice: prefs.preferredDevice }).then(result => {
      if (version === nativeConfigVersion.current && prefs.launchAtLogin !== result.launchAtLogin) {
        setPrefs(p => ({ ...p, launchAtLogin: result.launchAtLogin }));
        notify('Launch at login is available in the installed Windows app.');
      }
    }).catch(() => notify('Windows preferences could not be saved. Please try again.'));
  }, [prefs.autoOpen, prefs.notifications, prefs.launchAtLogin, prefs.preferredDevice]);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => { if (toast) { const timeout = setTimeout(() => setToast(''), 5500); return () => clearTimeout(timeout); } }, [toast]);
  useEffect(() => { if (model.modes.length && !model.modes.includes(mode)) setMode(model.modes[0]); }, [modelId, mode]);
  function updatePref<K extends keyof Preferences>(key: K, value: Preferences[K]) { setPrefs(p => ({ ...p, [key]: value })); }
  async function openSettings(target: 'bluetooth' | 'sound') {
    if (!window.airpod) { notify(`In the Windows app, this opens Windows ${target === 'sound' ? 'Sound' : 'Bluetooth'} settings.`); return; }
    try { await window.airpod.settings(target); } catch { notify('This shortcut requires the Windows desktop app.'); }
  }
  function chooseModel(value: ModelId) {
    if (preview) setPreviewModel(value);
    else if (device) setPrefs(p => ({ ...p, modelOverrides: { ...p.modelOverrides, [device.id]: value } }));
  }
  const preferenceRows = <>
    <div className="setting-row"><div className="setting-icon"><Bluetooth size={19} /></div><div><strong>Open on connection</strong><p>Your controls, right when you need them.</p></div><Toggle label="Open on connection" checked={prefs.autoOpen} onChange={() => updatePref('autoOpen', !prefs.autoOpen)} /></div>
    <div className="setting-row"><div className="setting-icon"><Bell size={19} /></div><div><strong>Connection notifications</strong><p>A quiet heads-up when your AirPods connect.</p></div><Toggle label="Connection notifications" checked={prefs.notifications} onChange={() => updatePref('notifications', !prefs.notifications)} /></div>
    <div className="setting-row"><div className="setting-icon"><Monitor size={19} /></div><div><strong>Launch at login</strong><p>Available in the installed Windows app.</p></div><Toggle label="Launch at login" checked={prefs.launchAtLogin} disabled={!window.airpod} onChange={() => updatePref('launchAtLogin', !prefs.launchAtLogin)} /></div>
  </>;
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setPage('overview'); }} aria-label="Airpod Connect home"><span className="brand-mark"><AudioLines size={23} strokeWidth={2.3} /></span><span>airpod<span className="brand-second">connect<span className="brand-dot">.</span></span></span></a>
      <div className="sidebar-label">YOUR SPACE</div>
      <nav aria-label="Main navigation">
        <button className={page === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('overview')}><Headphones size={19} />My AirPods<span className="nav-indicator" /></button>
        <button className={page === 'devices' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('devices')}><Bluetooth size={19} />Devices{connected && <span className="nav-count">1</span>}</button>
        <button className={page === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('settings')}><Settings2 size={19} />Preferences</button>
      </nav>
      <div className="sidebar-bottom"><div className="quiet-art" aria-hidden="true">{Array.from({ length: 19 }, (_, i) => <i key={i} style={{ '--i': i, height: `${16 + Math.sin(i * 0.65) ** 2 * 42}px` } as CSSProperties} />)}</div><p>Less noise.<br /><span>More you.</span></p><div className="sidebar-divider" /><button className="sidebar-help" onClick={() => setDialog('help')}><CircleHelp size={17} />A little help<ArrowUpRight size={15} /></button><div className="version"><span className="tiny-dot" />Made for Windows<span>v0.1.0</span></div></div>
    </aside>
    <div className="workspace">
      <header className="titlebar"><div className="breadcrumb">Your space<ChevronRight size={13} /><span>{page === 'overview' ? 'My AirPods' : page === 'devices' ? 'Devices' : 'Preferences'}</span></div><div className="titlebar-right"><span className="local-badge"><ShieldCheck size={13} /> On your device. Always.</span>{window.airpod && <div className="window-buttons"><button aria-label="Minimize window" onClick={() => window.airpod?.minimize()}><Minus size={16} /></button><button aria-label="Close to tray" onClick={() => window.airpod?.close()}><X size={16} /></button></div>}</div></header>
      <main>
        <div className="page-heading"><div><div className="eyebrow"><span className="amber-line" />YOUR EVERYDAY, UPGRADED</div><h1>{page === 'overview' ? 'Sounds like your space.' : page === 'devices' ? 'Good things connect.' : 'Make yourself at home.'}</h1><p>{page === 'overview' ? 'A little less noise. A little more of what you love.' : page === 'devices' ? 'Find your AirPods and make the connection yours.' : 'Small details. A companion that feels like you.'}</p></div><button className="subtle-button connection-button" onClick={() => setPage('devices')}><Bluetooth size={16} /><span>{preview ? 'Preview device' : connected ? 'Bluetooth connected' : 'Bluetooth devices'}</span><span className={`status-dot ${connected ? 'connected' : ''}`} /></button></div>
        {preview && <div className="preview-bar"><span><Sparkles size={14} /><strong>Take a look around.</strong> This is an interactive preview — device data is illustrative.</span><button onClick={() => { setPreview(false); setPage('devices'); }}>Use my AirPods<ArrowRight size={14} /></button></div>}
        {!preview && scan.error && <div className="error-banner" role="alert"><Info size={17} /><span>{scan.error}</span><button onClick={refresh}>Retry</button></div>}
        {page === 'overview' && <>
          <div className="top-grid">
            <section className="hero-card card">
              <div className="hero-top"><span className={`device-pill ${!connected ? 'offline' : ''}`}><span className="status-dot connected" />{preview ? 'PREVIEW CONNECTED' : connected ? 'CONNECTED' : 'NOT CONNECTED'}</span><button className="round-button" aria-label="Choose AirPods model" disabled={!device} onClick={() => setDialog('model')}><Settings2 size={16} /></button></div>
              <div className="hero-art"><div className="orb orb-one" /><div className="orb orb-two" /><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="art-spark spark-one">✦</span><span className="art-spark spark-two">+</span>{modelId === 'max' ? <Product model={modelId} className="hero-max" /> : <><Product model={modelId} part="case" className="hero-case" /><Product model={modelId} className="hero-buds" /></>}<div className="product-shadow" /></div>
              <div className="hero-footer"><div><div className="hero-kicker">{preview ? 'MEET YOUR EVERYDAY ESCAPE' : connected ? 'WELCOME BACK' : 'YOUR NEXT MOMENT OF QUIET'}</div><h2>{device ? model.shortName : 'Hello, AirPods.'}<span className="hero-period">.</span></h2><p>{device ? model.description : 'Connect your AirPods. We’ll take it from here.'}</p></div><button className="hero-model" onClick={() => device ? setDialog('model') : openSettings('bluetooth')}>{device ? modelId === 'pro-2' ? '2nd generation' : modelId === 'pro-3' ? '3rd generation' : 'Your model' : 'Connect'}<ChevronDown size={13} /></button></div>
            </section>
            <section className="battery-card card"><div className="card-heading"><h2>Ready for the day</h2><Battery size={19} className="muted" /></div><p className="card-description">{preview ? 'A little charge. A lot of listening.' : 'Your AirPods battery, at a glance.'}</p><div className="battery-list">{[{label:'Left AirPod', value:86, part:'buds'}, {label:'Right AirPod', value:82, part:'buds'}, {label:'Charging case', value:64, part:'case'}].filter(item => modelId !== 'max' || item.label === 'Left AirPod').map((item, i) => <div className="battery-row" key={item.label}><div className={`battery-thumb battery-thumb-${i}`}><Product model={modelId} part={item.part as 'buds' | 'case'} /></div><div className="battery-info"><div><span>{modelId === 'max' ? 'Headphones' : item.label}</span><strong>{preview ? `${item.value}%` : '—'}</strong></div><div className="battery-track"><div style={{ width: preview ? `${item.value}%` : '0%' }} /></div><span className="battery-caption">{preview ? i === 2 ? 'Sample battery level' : 'Ready to listen' : 'Not reported by Windows'}</span></div></div>)}</div><div className="battery-note"><span className="note-icon"><Zap size={14} /></span><p>{preview ? <>Good to go.<br /><span>Enjoy a little uninterrupted you-time.</span></> : <>Battery levels unavailable.<br /><span>Windows does not expose AirPods battery data here.</span></>}</p></div></section>
          </div>
          <section className="noise-card card"><div className="section-heading"><div><div className="section-title"><h2>Your world. Your volume.</h2><span className="tag">NOISE CONTROL</span></div><p>{model.modes.length ? preview ? 'Choose how much of the outside world comes in.' : 'Explore your model’s listening modes. Switch using your AirPods.' : modelId === 'unknown' ? 'Choose your exact model to discover its listening features.' : 'This model uses an open fit and does not support noise control.'}</p></div><button className="icon-button" aria-label="About noise control" onClick={() => setDialog('help')}><CircleHelp size={18} /></button></div>
            {model.modes.length > 0 ? <div className="mode-grid" style={{ '--mode-count': model.modes.length } as CSSProperties}>{model.modes.map(id => { const detail = modeDetails[id]; const Icon = detail.icon; const selected = preview && mode === id; return <button key={id} className={`mode-button ${selected ? 'selected' : ''}`} aria-pressed={selected} aria-label={`${detail.name}${preview ? '' : ' instructions'}`} onClick={() => { if (preview) setMode(id); else setDialog(id); }}><span className="mode-top"><span className="mode-icon"><Icon size={24} strokeWidth={1.5} /></span><span className="mode-check">{selected ? <Check size={11} strokeWidth={3} /> : ''}</span></span><strong>{detail.short}</strong><span className="mode-description">{detail.description}</span></button>; })}</div> : <div className="empty-modes"><Wind size={27} /><div><strong>{modelId === 'unknown' ? 'Every pair is a little different.' : 'Naturally open. Effortlessly simple.'}</strong><p>{modelId === 'unknown' ? 'Bluetooth names don’t always reveal the generation.' : 'Use Windows Sound settings for volume and audio output.'}</p></div><button className="text-button" onClick={() => device ? setDialog('model') : openSettings('bluetooth')}>{device ? 'Choose model' : 'Connect AirPods'}<ArrowRight size={16} /></button></div>}
            <div className="noise-footer"><span className="noise-footer-icon"><Info size={14} /></span><p>{preview ? <>Preview only. <span>On Windows, change listening modes using your AirPods’ physical controls.</span></> : <>Control on your AirPods. <span>Windows does not provide direct noise-mode switching.</span></>}</p><button onClick={() => setDialog('help')}>How it works<ArrowUpRight size={13} /></button></div>
          </section>
          <div className="bottom-grid"><section className="card quick-card"><span className="quick-icon"><Volume2 size={22} /></span><div><h2>A sound all your own</h2><p>Volume, output, and your Windows audio.</p></div><button className="round-button" aria-label="Open Windows Sound settings" onClick={() => openSettings('sound')}><ArrowUpRight size={18} /></button></section><section className="card quick-card"><span className="quick-icon"><Bluetooth size={21} /></span><div><h2>Ready when you are</h2><p>Automatically open when AirPods connect.</p></div><Toggle label="Automatically open when connected" checked={prefs.autoOpen} onChange={() => updatePref('autoOpen', !prefs.autoOpen)} /></section></div>
          <div className="page-footer"><span><span className="tiny-dot" />{preview ? 'A preview of your quieter corner.' : connected ? 'Connected. Make yourself comfortable.' : 'Waiting for your next connection.'}</span><span>Thoughtfully simple. Quietly powerful.</span></div>
        </>}
        {page === 'devices' && <div className="devices-layout"><section className="card devices-card"><div className="card-heading"><div><h2>Your devices</h2><p className="card-description">{preview ? 'Explore the experience with a sample pair.' : 'Paired devices from Windows Bluetooth.'}</p></div><button className="subtle-button" onClick={refresh} disabled={scanning}><RefreshCw size={15} className={scanning ? 'spin' : ''} />{scanning ? 'Scanning…' : 'Refresh'}</button></div>{(preview ? [demoDevice] : scan.devices).length ? (preview ? [demoDevice] : scan.devices).map(d => <div className="device-row" key={d.id}><span className="device-row-icon"><Headphones size={24} /></span><div><h3>{d.name}</h3><p><span className={`status-dot ${d.connected ? 'connected' : ''}`} />{d.connected ? 'Connected' : 'Paired · Not connected'}{preview ? ' · Preview' : ''}</p></div><button className="subtle-button" onClick={() => { if (!preview) updatePref('preferredDevice', d.id); setPage('overview'); }}>{d.id === device?.id ? 'View controls' : 'Use this device'}<ArrowRight size={14} /></button></div>) : <div className="empty-devices"><span className="empty-bluetooth"><Bluetooth size={36} /></span><h2>{scanning ? 'Looking for your AirPods…' : 'Your sound is out there.'}</h2><p>{window.airpod ? 'Open your AirPods case, then pair them in Windows Bluetooth settings. We’ll find them automatically.' : 'Open the Windows desktop app to detect your AirPods. You can explore the interface here using preview mode.'}</p><button className="primary-button" onClick={() => openSettings('bluetooth')}>Open Bluetooth settings<ArrowUpRight size={16} /></button><button className="text-button" onClick={() => { setPreview(true); setPage('overview'); }}>Explore the preview<ArrowRight size={15} /></button></div>}<div className="device-tip"><Info size={17} /><p>Renamed your AirPods? Select them from this list, then choose their model. We’ll remember this device.</p></div></section><section className="card pairing-card"><span className="eyebrow">ONE LITTLE CONNECTION</span><h2>Open. Pair.<br /><span>Make it yours.</span></h2><Product model="pro-2" part="case" /><ol><li>Put your AirPods in pairing mode.</li><li>Open Windows Bluetooth settings.</li><li>Add your AirPods as a Bluetooth device.</li></ol><button className="subtle-button" onClick={() => openSettings('bluetooth')}>Bluetooth settings<ArrowUpRight size={15} /></button></section></div>}
        {page === 'settings' && <div className="preferences-layout"><section className="card preferences-card"><h2>The way you like it</h2><p className="card-description">A little personalization goes a long way.</p><div className="theme-options">{([{id:'dark',name:'After hours',sub:'Dark',icon:Moon}, {id:'light',name:'A little daylight',sub:'Light',icon:Sun}, {id:'system',name:'Go with the flow',sub:'System',icon:Monitor}] as const).map(t => <button key={t.id} className={`theme-option ${prefs.theme === t.id ? 'chosen' : ''}`} aria-pressed={prefs.theme === t.id} onClick={() => updatePref('theme', t.id)}><div className={`theme-preview theme-preview-${t.id}`}><div /><span /><i /></div><div className="theme-label"><t.icon size={15} /><strong>{t.name}</strong>{prefs.theme === t.id && <Check size={14} />}</div><span>{t.sub}</span></button>)}</div><div className="preferences-divider" /><h2>Little conveniences</h2>{preferenceRows}</section><section className="card about-card"><span className="brand-mark"><AudioLines size={25} /></span><h2>A quieter kind<br />of companion.</h2><p>Airpod Connect brings your AirPods a little closer to Windows. No accounts. No analytics. Just your space.</p><div className="about-detail"><Laptop size={17} /><span>Windows 10 & 11</span></div><div className="about-detail"><ShieldCheck size={17} /><span>Preferences stay on your device</span></div><button className="text-button" onClick={() => setDialog('help')}>Features & limitations<ArrowUpRight size={15} /></button><span className="about-version">AIRPOD CONNECT · 0.1.0</span></section></div>}
      </main>
    </div>
    {toast && <div className="toast" role="status"><Info size={18} /><span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={16} /></button></div>}
    {dialog === 'model' && <Modal title="A pair that’s uniquely yours." close={() => setDialog(null)}><p className="modal-intro">Bluetooth names can’t reliably identify every generation. Choose your exact model to show the right listening modes.</p><label className="field-label" htmlFor="model-select">Your AirPods model</label><select id="model-select" value={modelId} onChange={e => chooseModel(e.target.value as ModelId)}>{Object.values(MODELS).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select><div className="modal-info"><Info size={18} /><p>{preview ? 'This changes the preview model. Your real device preferences are kept separately.' : 'This choice is saved for this Bluetooth device. Find the model number in AirPods settings on an Apple device or on your earbuds.'}</p></div><button className="primary-button full-width" onClick={() => setDialog(null)}>All set<Check size={16} /></button></Modal>}
    {dialog === 'help' && <Modal title="A little clarity." close={() => setDialog(null)}><p className="modal-intro">Your AirPods. Windows. Here’s what works together.</p><div className="help-row"><span><Bluetooth size={20} /></span><div><h3>Connect once. Feel at home.</h3><p>The Windows app checks paired Bluetooth devices every 8 seconds. It can open automatically and notify you when your AirPods connect. Closing the window keeps it running in the system tray; choose Quit to stop.</p></div></div><div className="help-row"><span><AudioLines size={20} /></span><div><h3>Noise control, on your AirPods.</h3><p>Windows doesn’t expose Apple’s noise-control protocol through its standard Bluetooth APIs. Use the stem or Max noise control button to switch. Configure Adaptive Audio on a compatible Apple device first. This app shows supported modes, not your current hardware mode.</p></div></div><div className="help-row"><span><Battery size={20} /></span><div><h3>Honest about battery.</h3><p>Individual AirPods and case levels aren’t available through this app’s Windows connection. Battery percentages in preview mode are sample data.</p></div></div><div className="help-row"><span><Info size={20} /></span><div><h3>Made independently.</h3><p>Not affiliated with Apple. Product renders: SpriteOvO/AirPodsDesktop (GPL-3.0). Inter typeface: Rasmus Andersson (SIL OFL). License notices are included with the app.</p></div></div><button className="primary-button full-width" onClick={() => setDialog(null)}>Got it<Check size={16} /></button></Modal>}
    {dialog && dialog in modeDetails && <Modal title={modeDetails[dialog as NoiseMode].name} close={() => setDialog(null)}><div className="control-guide-icon"><Headphones size={35} /></div><p className="modal-intro">{modeDetails[dialog as NoiseMode].guide}</p><div className="modal-info"><Info size={18} /><p>No command was sent to your AirPods. Direct noise-mode switching is not available through this app’s Windows Bluetooth connection.</p></div><button className="primary-button full-width" onClick={() => setDialog(null)}>Got it<Check size={16} /></button></Modal>}
  </div>;
}
