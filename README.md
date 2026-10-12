# Airpod Connect

A Windows companion for AirPods, with warm amber accents, a charcoal interface, real product renders, and gentle floating animations. Built with Electron, React, and TypeScript.

## What it does

- Detects paired and connected Bluetooth devices on Windows 10/11 through WinRT, polling every 8 seconds without administrator access.
- Recognizes AirPods names conservatively. A saved model override handles ambiguous generations or renamed devices.
- Opens automatically and shows a notification when AirPods connect. Closing the window keeps discovery active in the system tray; use **Quit** in the tray menu to exit.
- Adapts the listening-mode cards to the selected model: standard AirPods, AirPods 4 with ANC, AirPods Pro generations, and AirPods Max.
- Opens Windows Bluetooth and Sound settings for pairing, volume, and audio output.
- Saves dark, light, or system theme preferences, connection behavior, and installed-app launch at login locally.
- Includes an explicitly labeled, interactive preview for development without Windows hardware. The Windows desktop app starts with live detection, never sample data.

## Current hardware limitations

**This version does not send noise-mode commands to AirPods.** Windows' standard Bluetooth APIs do not expose Apple's proprietary control protocol. In live mode, each listening-mode card explains how to switch using the stem or AirPods Max button. The app does not claim to read the current hardware mode. Adaptive Audio requires a compatible model, firmware, and configuration on an Apple device.

Individual earbud and case battery percentages are not exposed by the discovery implementation. Live mode shows unavailable values; all percentages in preview mode are illustrative. Adding actual noise switching or battery telemetry requires a separately implemented and hardware-tested Bluetooth transport (potentially a Windows driver). No unverified commands or driver installers are included.

Model inference uses the Bluetooth name, not verified hardware identity. “AirPods Pro” alone does not enable Adaptive Audio; select the exact generation in the model chooser. Unknown models do not receive guessed features. AirPods 4 defaults to the non-ANC variant unless its name or your model choice identifies ANC.

## Develop

Use Node.js 22.12+ (Node 24 recommended) and npm. Keep the existing checkout; there is no need for a Git worktree.

```sh
npm ci
npm run build
npm test
```

On Windows, run the desktop app:

```sh
npm run desktop
```

This starts Vite and Electron together. Enable Bluetooth, pair your AirPods in Windows Settings, and connect them. Windows PowerShell 5.1 is included with supported Windows versions. A machine policy that blocks local PowerShell scripts can prevent discovery; the app reports that error and does not alter the policy. Launch at login is available after installing the packaged app.

For browser-only UI development:

```sh
npm run dev
```

The browser opens in labeled preview mode. **Use my AirPods** exits the preview and explains that live detection needs the Windows app. Browser-only code never asks for Web Bluetooth access or pretends to scan hardware.

## Validate

```sh
npm test
npx playwright install chromium
npm run test:ui
npm run build
```

Unit tests cover model capabilities, preference validation, device selection, reconnection transitions, and scan failures. Playwright checks preview isolation, model-specific controls, persisted preferences, a mocked Windows bridge, product asset loading, and responsive layout. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to reuse an installed Chromium for UI tests.

See [Windows hardware checks](docs/WINDOWS-VALIDATION.md) before treating Bluetooth behavior as verified. Linux UI and packaging checks cannot validate a physical Windows Bluetooth connection.

## Build a Windows installer

```sh
npm run dist:win
```

Run on Windows for executable icon and metadata processing. The x64 NSIS installer is written to `release/Airpod-Connect-0.1.0-Setup.exe`. No signing certificate is included.

A standalone Windows executable can also be cross-built on Linux:

```sh
npm run dist:win:portable
```

This writes `release/Airpod-Connect-0.1.0-Portable.exe`. It needs no installer and disables launch at login because the runtime is extracted to a temporary path. The cross-build skips executable resource editing and signing; the application executable retains Electron's embedded metadata, while the taskbar and tray use the app icon. The portable executable is unsigned, so Windows may display its normal unrecognized-publisher prompt. The installed build is recommended for Windows notification integration and launch at login.

The cloud NSIS attempt could not finish because the Wine toolset failed to load `ntdll`. Generate the installer on Windows with `npm run dist:win`; the portable build does not need Wine.

The GitHub Actions workflow builds and uploads a Windows installer when pushed or manually triggered. It does not publish a release or configure signing credentials.

## Architecture

- `electron/main.cjs`: isolated desktop host, system shortcuts, tray, notifications, login preference, and a deduplicated Bluetooth scan loop.
- `electron/preload.cjs`: narrow IPC bridge; no renderer Node.js access or arbitrary shell commands.
- `scripts/bluetooth.ps1`: read-only WinRT enumeration and actual `ConnectionStatus`, with timeouts and disposed device handles.
- `electron/device-monitor.cjs`: connection transition logic that ignores failed scans and avoids repeated notifications.
- `src/domain.ts`: conservative model capabilities and device selection.
- `src/App.tsx`, `src/styles.css`: interface, themes, reduced-motion support, keyboard-accessible dialogs, and explicit preview state.

Discovery stays on the computer. There are no accounts, analytics, external runtime image requests, or required API keys. Bluetooth identifiers and preferences are stored locally. The app uses a locked-down renderer, production Content Security Policy, and validated system-settings targets.

## Credits

This is an independent project, not affiliated with Apple. AirPods is an Apple trademark. Real AirPods product renders are bundled from [SpriteOvO/AirPodsDesktop](https://github.com/SpriteOvO/AirPodsDesktop), commit `56b04001f75044dbd15507303a9438c71e93c6e4`, under its GPL-3.0 notice. No application code was copied from that project. Inter is by Rasmus Andersson under SIL OFL 1.1. Included attribution and full license texts are in `public/licenses/`; they are shipped in the app. See [asset provenance](public/licenses/ASSETS.md).
