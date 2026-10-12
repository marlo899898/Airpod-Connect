# Noise control in version 0.3.0

The compact buttons now send real AirPods noise-control commands over the **MagicAAP Windows driver interface**. A mode is highlighted only when AirPods report it. Stem/button changes are reflected in the app too. Cancellation, Transparency, Adaptive and Off appear according to the selected model.

## What you need

- Windows 10/11 x64, connected AirPods with noise-control hardware, and compatible firmware.
- **MagicAAP already installed and working for those AirPods.** Ordinary Windows Bluetooth pairing is sufficient for audio and discovery, but does not expose the required L2CAP control channel to this app.
- Close other programs using the AirPods control channel before opening this app.

**Driver installation is a separate, consequential choice.** The publisher currently describes the official driver as unsigned and requires disabling Secure Boot and enabling Windows Test Mode. Its community variant uses a signing workaround and may be blocked by security software or anti-cheat. These are not normal plug-and-play prerequisites, and this app does not recommend weakening Windows security simply to enable headphone controls.

Read the publisher's current [official driver requirements](https://github.com/steam3d/help.magicpods.app/blob/main/docs/fun-magicaap.md) and [community driver information](https://github.com/steam3d/help.magicpods.app/blob/main/docs/fun-magicaap-community.md) before considering either. Airpod Connect does **not** bundle/install a driver, run installation scripts, request elevation, change Secure Boot/Test Mode, or add antivirus exclusions. There is no driver-free noise-control fallback in this version.

## Using an existing driver

1. Quit the previous Airpod Connect from its system tray menu and run version 0.3.0.
2. Connect your AirPods to Windows. The compact panel appears automatically.
3. If the driver is available, the app reads the current mode and enables the controls. Click a mode; selection changes after a report from the AirPods. A failed/unconfirmed command shows an error instead of a false success.
4. If **Control driver required** appears, the driver interface for this specific pair was not found. **Driver details** opens this document. After correcting an existing installation or reconnecting, click **Retry**.
5. If controls are busy or do not respond, close other AirPods control apps, reconnect the earbuds and retry. Use both earbuds when testing cancellation. Firmware/settings on an Apple device can restrict Off or Adaptive.

Select the correct generation under **Preferences & model** in the tray if the Bluetooth name does not identify it. Plain AirPods without ANC hardware cannot gain cancellation through software.

## Validation and limits

Automated tests cover exact command bytes, received-mode parsing, confirmation/timeouts, competing commands, disconnects, device address matching, native buffer lifetime, handle cleanup and UI behavior. Windows CI loads the actual SetupAPI/Kernel32 bindings and launches the packaged control worker to verify its missing-driver result. **These checks do not establish physical compatibility with your driver version, Bluetooth adapter, AirPods model or firmware. No physical AirPods are available in the build environment.** Follow [hardware validation](WINDOWS-VALIDATION.md) before relying on this integration.

## Implementation references

This is a JavaScript/Koffi implementation using the public Windows device-interface ABI and published AAP wire-format findings. It opens only the enumerated MagicAAP interface whose remote Bluetooth address exactly matches the selected connected device; it never falls back to another pair. Native I/O runs in an isolated process with overlapped reads/writes, cancellation and bounded parent waits. No raw packet or device-path IPC is exposed to the renderer.

- [AirPodsWindows AAP packet definitions](https://github.com/YimingZhanshen/AirPodsWindows/blob/b5a39950c2b68e094fc36af8be2f6f407d1fc9d2/Source/Core/AAP.h)
- [AirPodsWindows MagicAAP interface findings](https://github.com/YimingZhanshen/AirPodsWindows/blob/b5a39950c2b68e094fc36af8be2f6f407d1fc9d2/Source/Core/MagicAAPWinRT.cpp), interface GUID `9eec98bb-3c54-45d4-a843-7900c4635e08`
- [LibrePods protocol research](https://github.com/kavishdevar/librepods)
- MagicAAP is developed separately by the MagicPods authors. This app is not affiliated with them or Apple.
