# Windows hardware validation — 0.2.0

CI verifies the actual Win32 discovery bindings and the scanner inside the packaged Electron app. It also tests the real compact window dimensions with a simulated connection event. Physical AirPods still require these checks on a Windows 10/11 x64 PC with Bluetooth.

1. Quit version 0.1.0 from the system tray before starting `Airpod-Connect-0.2.0-Portable.exe`. Confirm the connection screen has no dashboard or battery values.
2. Leave the existing PowerShell policy unchanged. Discovery must run without PowerShell; it now uses `bthprops.cpl` through the bundled native addon.
3. Connect AirPods in Windows Bluetooth settings. Within about 5 seconds, the large window should become a 430 × 250 panel with only the device title, supported listening modes, and their availability note.
4. Repeat with AirPods already connected before starting the app. It should enter compact mode on its first scan.
5. Disconnect and reconnect. Confirm setup returns on disconnect and compact controls return on reconnect. There should be at most one notification per new connection and no repeated focus changes during normal polling.
6. Open **Preferences & model** from the system tray. Normal scans must not dismiss preferences. Select the correct generation, then choose **Back to controls**.
7. AirPods 4 without ANC should have no noise-mode buttons. AirPods 4 with ANC and Pro 2/3 should include Adaptive. Max and unknown-generation Pro should not.
8. Click a live noise-mode button. Confirm the stem/Max instructions appear and no mode is marked as active. This version does not issue Apple noise-mode commands.
9. Rename AirPods to something without “AirPods.” Select them in **Choose a paired device**, then select their model. Confirm subsequent connections are recognized.
10. Close controls to the tray, reconnect, and verify the automatic-open preference. Test dark, light, and system themes and Windows display scaling at 125%/150%. The compact panel must remain inside the monitor work area.
11. Turn off Bluetooth. Confirm the app shows an unavailable adapter or disconnected devices, not a policy suggestion or invented connection. Turn Bluetooth back on and retry.
12. If discovery fails, record the exact native Windows error message and run `npm run test:bluetooth` from a Windows checkout. This test prints only the adapter state and device count. Do not change security policy or post Bluetooth addresses publicly.
