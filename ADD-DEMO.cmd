@echo off
setlocal
cd /d "%~dp0"
node --env-file-if-exists=.env scripts/demo-catalog.mjs seed
if errorlevel 1 (
  pause
  exit /b 1
)
call START-FLIXORA.cmd
