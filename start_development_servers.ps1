# Starts the Kushlof backend and frontend in two new PowerShell windows.
# Run it from the project folder with:  .\start_development_servers.ps1
# Then open http://localhost:5173 in your browser. Close the two windows to stop Kushlof.

$projectRootFolder = $PSScriptRoot
$backendPython = Join-Path $projectRootFolder "backend\.venv\Scripts\python.exe"

# Reload PATH from Windows settings, so tools installed after this terminal was opened are found.
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

function Test-PortIsFree([int]$portNumber, [string]$serverName) {
    $processUsingPort = Get-NetTCPConnection -LocalPort $portNumber -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($processUsingPort) {
        Write-Host "Port $portNumber (needed by the $serverName) is already in use by process $($processUsingPort.OwningProcess)." -ForegroundColor Red
        Write-Host "Close the old Kushlof window, or stop it with:  Stop-Process -Id $($processUsingPort.OwningProcess)" -ForegroundColor Yellow
        exit 1
    }
}

if (-not (Test-Path $backendPython)) {
    Write-Host "The backend is not set up yet. Run .\setup_project.ps1 first." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path (Join-Path $projectRootFolder "frontend\node_modules"))) {
    Write-Host "The frontend is not set up yet. Run .\setup_project.ps1 first." -ForegroundColor Red
    exit 1
}
Test-PortIsFree 8000 "backend"
Test-PortIsFree 5173 "frontend"

# Only listen on this computer unless network access was switched on in .env.
$backendListenAddress = "127.0.0.1"
$environmentFilePath = Join-Path $projectRootFolder ".env"
if ((Test-Path $environmentFilePath) -and (Select-String -Path $environmentFilePath -Pattern "^ALLOW_NETWORK_ACCESS=true" -Quiet)) {
    $backendListenAddress = "0.0.0.0"
    Write-Warning "Network access is ON. Sign-in uses only a username, so only do this on a network you trust (Tailscale recommended)."
}

Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$host.UI.RawUI.WindowTitle = 'Kushlof backend'; Set-Location '$projectRootFolder\backend'; & '$backendPython' -m uvicorn app.main:app --host $backendListenAddress --port 8000 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$host.UI.RawUI.WindowTitle = 'Kushlof frontend'; Set-Location '$projectRootFolder\frontend'; npm run dev"

Write-Host "Kushlof is starting in two new windows. Open http://localhost:5173" -ForegroundColor Green
