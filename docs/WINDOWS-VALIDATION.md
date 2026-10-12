# Windows hardware validation

The cloud environment runs Linux. UI, connection-transition logic, and Windows packaging are tested here; the following require Windows 10/11 with a Bluetooth adapter and physical AirPods.

1. Run the x64 portable executable, or install a Windows-built setup executable. Open Airpod Connect. Confirm it starts in live mode without preview percentages or a fabricated connection.
2. Open Bluetooth settings from the Devices page. Pair AirPods, connect them, and confirm their Windows device name and status appear within about 8 seconds (allow longer for the initial WinRT query).
3. Disconnect and reconnect. Confirm one notification and an automatic window opening, then no repeated notifications on subsequent scans. Disable those preferences and verify each is respected.
4. Rename the AirPods so the name no longer contains “AirPods.” Select the paired device from Devices, choose its model, reconnect, and verify the saved device is recognized.
5. Select ordinary AirPods 4: no ANC or Adaptive cards. Select AirPods 4 with ANC or Pro 2/3: Adaptive appears. AirPods Max and an unspecified Pro generation must not offer Adaptive.
6. Select a listening-mode card in live mode. Confirm it opens physical-control instructions, does not show a hardware mode as selected, and never suggests it sent a command.
7. Confirm live battery values show unavailable. Open Windows Sound settings and adjust the actual Windows output/volume there.
8. Close the window. Reconnect the AirPods and confirm the tray process detects the connection. Open the tray menu, choose Quit, and confirm the process exits.
9. Enable launch at login in the installed app; sign out/in and verify it starts. Disable the setting afterward and verify it stops launching at login.
10. Turn Bluetooth off or block PowerShell through an existing test policy. Confirm missing devices or a scan error is shown rather than sample or stale connected data. Restore access and retry.
11. Check dark, light, and system themes; keyboard focus and Escape in dialogs; display scaling at 125% and 150%; and Windows reduced-motion settings.

If discovery is blocked, run `scripts/bluetooth.ps1` with Windows PowerShell 5.1 from the checkout to capture the JSON error. Do not post Bluetooth identifiers publicly. Do not disable organization security policy to make the scan work.
