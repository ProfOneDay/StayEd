# StayEd dev launcher.

$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$backend = Join-Path $root "StayEd_Backend"
$frontend = Join-Path $root "StayEd_Frontend"

if (-not (Test-Path (Join-Path $backend ".venv\Scripts\Activate.ps1"))) {
    Write-Host "Backend virtual environment not found at StayEd_Backend\.venv." -ForegroundColor Red
    Write-Host "Run this first:" -ForegroundColor Yellow
    Write-Host "  cd StayEd_Backend; py -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -r requirements.txt"
    exit 1
}

Write-Host "Starting StayEd backend on http://127.0.0.1:5000 (auto DB setup on first run)..." -ForegroundColor Cyan
Start-Process powershell -WorkingDirectory $backend -ArgumentList @(
    "-NoExit", "-Command",
    ".\.venv\Scripts\Activate.ps1; python run.py"
)

Write-Host "Starting StayEd frontend on http://localhost:5500 ..." -ForegroundColor Cyan
Start-Process powershell -WorkingDirectory $frontend -ArgumentList @(
    "-NoExit", "-Command",
    "python serve.py 5500"
)

Write-Host ""
Write-Host "Both servers are launching in separate windows." -ForegroundColor Green
Write-Host "Backend log window shows [db-bootstrap] messages for the database setup."
Write-Host "Close either window (or Ctrl+C inside it) to stop that server."