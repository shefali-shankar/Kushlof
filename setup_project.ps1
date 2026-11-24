# One-time setup: installs the backend and frontend libraries and the PDF export browser.
# Run from the project folder with:  .\setup_project.ps1

$ErrorActionPreference = "Stop"
$projectRootFolder = $PSScriptRoot
$backendFolder = Join-Path $projectRootFolder "backend"
$frontendFolder = Join-Path $projectRootFolder "frontend"
$backendPython = Join-Path $backendFolder ".venv\Scripts\python.exe"

# Reload PATH so tools installed after this terminal was opened (uv, Node) are found.
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

foreach ($requiredCommand in "uv", "npm") {
    if (-not (Get-Command $requiredCommand -ErrorAction SilentlyContinue)) {
        Write-Host "Cannot find '$requiredCommand'. Install uv (winget install astral-sh.uv) and Node.js, then try again." -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n=== 1/4  Python 3.12 virtual environment ===" -ForegroundColor Cyan
if (-not (Test-Path $backendPython)) {
    uv venv --python 3.12 (Join-Path $backendFolder ".venv")
} else {
    Write-Host "Already exists."
}

Write-Host "`n=== 2/4  Backend libraries (requirements-dev.txt) ===" -ForegroundColor Cyan
uv pip install --python $backendPython -r (Join-Path $backendFolder "requirements-dev.txt")

Write-Host "`n=== 3/4  Chromium for PDF export (about 150 MB) ===" -ForegroundColor Cyan
& $backendPython -m playwright install chromium

Write-Host "`n=== 4/4  Frontend libraries (package.json) ===" -ForegroundColor Cyan
Push-Location $frontendFolder
npm install
Pop-Location

Write-Host "`nSetup complete. Start Kushlof with:  .\start_development_servers.ps1" -ForegroundColor Green
Write-Host "Optional free local AI model:          ollama pull qwen3:4b"
