# Airpod Connect

A small Windows companion for AirPods. Version **0.2.0** replaces PowerShell discovery with native Windows Bluetooth APIs and replaces the dashboard with a compact control panel.

## Download and update

1. Sign into GitHub and open [Windows builds](https://github.com/marlo899898/Airpod-Connect/actions/workflows/windows.yml).
2. Open the latest successful **Validate and build Windows** run.
3. Under **Artifacts**, download **Airpod-Connect-Windows** and extract the ZIP.
4. **Quit the old copy from its system tray menu first.** Run `Airpod-Connect-0.2.0-Portable.exe` on Windows 10/11 (x64).

No installation, administrator access, or PowerShell policy change is required. The executable is unsigned. GitHub requires sign-in for artifact downloads. Source is available through **Code → Download ZIP**; cloud `/workspace/` links are not public downloads.

## Everyday use

Open Windows Bluetooth settings from the connection screen and pair your AirPods. The app checks the native connected flag every 5 seconds. As soon as a selected or recognized pair connects—including one already connected at startup—the large connection screen is replaced with a **430 × 250** panel containing the device name and its listening modes.

The compact panel has no navigation, battery cards, artwork, marketing text, or settings section. Close it to keep detection in the system tray. Right-click the tray icon for **Preferences & model**, Bluetooth settings, or Quit. Disconnecting restores the connection screen; a subsequent connection returns to compact controls. Repeated scans do not interrupt an open preferences page.

Preferences include dark (default), light, and system themes, model choice, automatic opening, and notifications. Renamed devices can be selected from **Choose a paired device**. Model inference is conservative: an unspecified AirPods Pro generation does not acquire Adaptive Audio automatically.

## Noise-control limitation

**Direct noise-mode switching is not implemented.** The standard Win32 Bluetooth API used here exposes discovery and connection status, not Apple's proprietary control protocol. Live listening-mode buttons display concise instructions for the AirPods stem or Max noise-control button. They do not send commands or claim to read the active hardware mode. A single availability line remains in the compact panel to make this clear.

Adaptive Audio needs a compatible model, firmware, and prior configuration on an Apple device. Plain AirPods 1–4 have no noise-control buttons; AirPods 4 with ANC, Pro variants, and Max receive their appropriate modes. Unknown devices require a model choice.

Browser preview is opt-in and explicitly labeled. Only in preview can mode selection be simulated. There are no fake battery levels or automatic demo devices in live mode.

## Develop and test

Use Node.js 24 and npm in the existing checkout; no Git worktree is needed.

```sh
npm ci
npm run build
npm test
npm run dev
```

`npm run dev` runs the browser UI, with an explicit **Preview compact controls** button. Live detection requires Windows. On Windows, `npm run desktop` runs Electron and Vite together. The native discovery library (Koffi) has a prebuilt Windows x64 Node-API addon; no compiler, .NET runtime, PowerShell, or special driver is needed on the user's machine.

```sh
npx playwright install chromium
npm run test:ui
```

To reuse an installed browser, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Unit tests cover Win32 structure sizes, native handle cleanup, UTF-16 names, connected/paired distinctions, Windows error reporting, model capabilities, preferences, connection transitions, and compact window bounds. Browser tests check first-connect behavior, disconnect/reconnect, tray preferences, themes, error messages, and the actual compact viewport.

On Windows, also run:

```sh
npm run test:bluetooth
npm run dist:win:portable
node scripts/check-packaged.cjs
```

The first command actually loads `bthprops.cpl` and calls the Win32 APIs. No adapter is an explicit valid outcome. The packaged test launches the built executable, invokes its real utility-process scanner, and checks the actual window transition using a simulated connection event. Neither test substitutes for testing physical AirPods; see [Windows hardware validation](docs/WINDOWS-VALIDATION.md).

## Windows builds

Build on Windows so npm installs the Windows Koffi addon:

```sh
npm run dist:win:portable
```

The output is `release/Airpod-Connect-0.2.0-Portable.exe`. CI runs the native and browser checks, builds it, verifies the packaged scanner, then uploads the download. Native binaries are explicitly unpacked from Electron's ASAR archive. Linux supports UI development and unit tests; do not ship a Linux-produced archive containing only the Linux native addon.

An NSIS installer target (`npm run dist:win`) is also defined, but the published and tested download is the portable executable. No signing credentials or release publishing are configured. Login startup is unavailable for the portable app because its runtime is extracted to a temporary directory.

## Implementation

- `electron/windows-bluetooth.cjs`: documented Win32 discovery using `BluetoothFindFirstRadio`, `BluetoothFindFirstDevice`, and `BluetoothFindNextDevice`. Reads `fConnected`; pairing alone never implies connection. No inquiry or device changes are performed.
- `electron/bluetooth-worker.cjs`: isolated Electron utility process, with a 10-second parent timeout.
- `electron/main.cjs`: scanner scheduling, narrow IPC, tray, window sizing, and notifications.
- `electron/window-layout.cjs`: compact sizing and monitor work-area clamping.
- `src/App.tsx`: simple setup, preferences, and compact listening modes.

The old script's generic fallback could blame PowerShell policy for initialization or parsing failures. Version 0.2.0 removes that entire dependency; native failures now retain their Windows error code. No policy is changed, bypassed, or disabled.

There are no accounts, analytics, external runtime images, or API keys. Preferences stay on the device. The renderer uses context isolation, a sandboxed preload, and a production Content Security Policy.

## Credits

Independent of Apple. AirPods is an Apple trademark. Product renders are from [SpriteOvO/AirPodsDesktop](https://github.com/SpriteOvO/AirPodsDesktop), commit `56b04001f75044dbd15507303a9438c71e93c6e4`, with its GPL-3.0 notice. Inter is by Rasmus Andersson under SIL OFL 1.1. Asset provenance and licenses are in `public/licenses/`. Koffi is by Niels Martignène under MIT; its license is bundled with the dependency.
