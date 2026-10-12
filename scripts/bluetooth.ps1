# Read-only Windows Bluetooth discovery using WinRT. No administrator access required.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Devices.Bluetooth.BluetoothDevice, Windows.Devices.Bluetooth, ContentType = WindowsRuntime]
$null = [Windows.Devices.Enumeration.DeviceInformation, Windows.Devices.Enumeration, ContentType = WindowsRuntime]
$null = [Windows.Devices.Enumeration.DeviceInformationCollection, Windows.Devices.Enumeration, ContentType = WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetGenericArguments().Count -eq 1 -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1
function Await-WinRT($operation, [Type]$resultType) {
    $task = $asTask.MakeGenericMethod($resultType).Invoke($null, @($operation))
    if (-not $task.Wait(5000)) { throw 'Windows Bluetooth operation timed out.' }
    return $task.Result
}
try {
    $selector = [Windows.Devices.Bluetooth.BluetoothDevice]::GetDeviceSelectorFromPairingState($true)
    $items = Await-WinRT ([Windows.Devices.Enumeration.DeviceInformation]::FindAllAsync($selector)) ([Windows.Devices.Enumeration.DeviceInformationCollection])
    $devices = @()
    $failures = 0
    foreach ($item in $items) {
        $device = $null
        try {
            $device = Await-WinRT ([Windows.Devices.Bluetooth.BluetoothDevice]::FromIdAsync($item.Id)) ([Windows.Devices.Bluetooth.BluetoothDevice])
            if ($null -ne $device) {
                $devices += @{ id = $item.Id; name = $device.Name; connected = ($device.ConnectionStatus.ToString() -eq 'Connected') }
            } else { $failures++ }
        } catch { $failures++ }
        finally { if ($null -ne $device) { $device.Dispose() } }
    }
    $result = @{ devices = @($devices) }
    if ($failures -gt 0) { $result.error = "Windows could not read $failures paired device(s). Check Bluetooth permissions and refresh." }
    $result | ConvertTo-Json -Compress -Depth 4
} catch {
    @{ devices = @(); error = "Bluetooth scan failed: $($_.Exception.Message)" } | ConvertTo-Json -Compress -Depth 4
    exit 1
}
