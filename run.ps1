<#
.SYNOPSIS
    SANAG Full-Stack Service Runner
.DESCRIPTION
    Launches the FastAPI backend (port 8000) and Vite frontend (port 5173)
    simultaneously in separate PowerShell windows, safely handling folder paths with spaces.
#>

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$BackendDir = Join-Path $ScriptDir "backend"
$FrontendDir = Join-Path $ScriptDir "frontend"

# Check virtual environment paths
$VenvCandidates = @(
    (Join-Path $ScriptDir ".venv\Scripts\python.exe"),
    (Join-Path $BackendDir "venv\Scripts\python.exe"),
    (Join-Path $BackendDir ".venv\Scripts\python.exe"),
    (Join-Path $ScriptDir "venv\Scripts\python.exe")
)

$VenvPython = $null
foreach ($path in $VenvCandidates) {
    if (Test-Path $path) {
        $VenvPython = $path
        break
    }
}

if (-not $VenvPython) {
    $VenvPython = "python"
    Write-Host "[SANAG] Virtual environment not found. Falling back to system 'python'." -ForegroundColor Yellow
}
else {
    Write-Host "[SANAG] Using VirtualEnv Python: $VenvPython" -ForegroundColor Green
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Starting SANAG Full-Stack Services...    " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "-> Backend:  http://127.0.0.1:8000 (Swagger Docs at /docs)"
Write-Host "-> Frontend: http://localhost:5173"
Write-Host ""

# 1. Backend Launch Command (FastAPI / Uvicorn)
$BackendScript = @"
`$Host.UI.RawUI.WindowTitle = 'SANAG Backend (FastAPI - Port 8000)'
Set-Location -LiteralPath '$BackendDir'
Write-Host '============================================' -ForegroundColor Green
Write-Host ' Starting FastAPI backend on port 8000...   ' -ForegroundColor Green
Write-Host ' Swagger Docs: http://127.0.0.1:8000/docs    ' -ForegroundColor Green
Write-Host '============================================' -ForegroundColor Green
& '$VenvPython' -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
"@

# 2. Frontend Launch Command (Vite)
$FrontendScript = @"
`$Host.UI.RawUI.WindowTitle = 'SANAG Frontend (Vite)'
Set-Location -LiteralPath '$FrontendDir'
Write-Host '============================================' -ForegroundColor Cyan
Write-Host ' Starting Vite frontend server...           ' -ForegroundColor Cyan
Write-Host ' URL: http://localhost:5173                 ' -ForegroundColor Cyan
Write-Host '============================================' -ForegroundColor Cyan

if (Test-Path 'package.json') {
    npm run dev
} else {
    & '$VenvPython' -m http.server 3000 --bind 127.0.0.1
}
"@

# Launch backend in a dedicated window
Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $BackendScript

# Launch frontend in a dedicated window
Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $FrontendScript

Write-Host "[SANAG] Both services launched successfully in separate windows." -ForegroundColor Green