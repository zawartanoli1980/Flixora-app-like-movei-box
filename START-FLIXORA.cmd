@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 24 or newer, then open this file again.
  pause
  exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0])<24)process.exit(1)"
if errorlevel 1 (
  echo Node.js 24 or newer is required.
  pause
  exit /b 1
)
if not exist "node_modules\vite\package.json" (
  call npm.cmd ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
set "FLIXORA_START_DIR=%CD%"
powershell.exe -NoProfile -Command "$p=$env:FLIXORA_START_DIR; $apiReady=$false; try { $h=Invoke-RestMethod 'http://127.0.0.1:3201/api/platform/health' -TimeoutSec 2 -ErrorAction Stop; if($h.status -eq 'ok') { $s=Invoke-RestMethod 'http://127.0.0.1:3201/api/platform/status' -TimeoutSec 2 -ErrorAction Stop; if(-not $s.features.demoCatalog) { Write-Host 'Close the OLD API and Vite windows, then open START-FLIXORA.cmd again.'; exit 1 }; $apiReady=$true } } catch {}; if(-not $apiReady) { Start-Process cmd.exe -WorkingDirectory $p -ArgumentList '/k npm.cmd run api' }; $webReady=$false; try { $h=Invoke-RestMethod 'http://127.0.0.1:5173/api/platform/health' -TimeoutSec 2 -ErrorAction Stop; $webReady=($h.status -eq 'ok') } catch {}; if(-not $webReady) { Start-Process cmd.exe -WorkingDirectory $p -ArgumentList '/k npm.cmd run dev -- --port 5173 --strictPort' }; for($attempt=0; $attempt -lt 30; $attempt++) { try { $h=Invoke-RestMethod 'http://127.0.0.1:5173/api/platform/health' -TimeoutSec 2 -ErrorAction Stop; if($h.status -eq 'ok') { Start-Process 'http://localhost:5173'; exit 0 } } catch {}; Start-Sleep -Seconds 1 }; Write-Host 'Servers are not ready. Read the errors in the new windows.'; exit 1"
if errorlevel 1 (
  pause
  exit /b 1
)
exit /b 0
