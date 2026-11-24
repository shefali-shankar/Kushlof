# Runs every test, linter and vulnerability scanner for Kushlof. Run this before finishing any change.

$projectRootFolder = $PSScriptRoot
$backendFolder = Join-Path $projectRootFolder "backend"
$frontendFolder = Join-Path $projectRootFolder "frontend"
$backendPython = Join-Path $backendFolder ".venv\Scripts\python.exe"
$failedCheckNames = @()

function Invoke-Check([string]$checkName, [string]$workingFolder, [scriptblock]$checkCommand) {
    Write-Host "`n=== $checkName ===" -ForegroundColor Cyan
    Push-Location $workingFolder
    & $checkCommand
    if ($LASTEXITCODE -ne 0) { $script:failedCheckNames += $checkName }
    Pop-Location
}

Invoke-Check "Backend tests (pytest)" $backendFolder { & $backendPython -m pytest -q }
Invoke-Check "Backend lint (ruff)" $backendFolder { & $backendPython -m ruff check app tests }
Invoke-Check "Backend security lint (bandit)" $backendFolder { & $backendPython -m bandit -c pyproject.toml -r app -q }
Invoke-Check "Backend dependency vulnerabilities (pip-audit)" $backendFolder { & $backendPython -m pip_audit --progress-spinner off }
Invoke-Check "Frontend lint (eslint)" $frontendFolder { npm run lint }
Invoke-Check "Frontend type check and build" $frontendFolder { npm run build }
Invoke-Check "Frontend dependency vulnerabilities (npm audit)" $frontendFolder { npm audit }

if ($failedCheckNames.Count -eq 0) {
    Write-Host "`nAll checks passed." -ForegroundColor Green
} else {
    Write-Host "`nFailed checks: $($failedCheckNames -join ', ')" -ForegroundColor Red
    exit 1
}
