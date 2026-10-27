@echo off
setlocal DisableDelayedExpansion
REM Synthetic-only local demo. No downloads, admin elevation, or customer-file support.
if not "%~1"=="" (
  echo This launcher accepts no arguments. Synthetic demonstration only.
  exit /b 2
)
pushd "%~dp0" 2>nul
if errorlevel 1 (
  echo Cannot access the project folder.
  exit /b 2
)
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.16.0 or newer is required. Nothing was installed.
  popd
  exit /b 2
)
REM Pin this launcher to the verified fixed demo port even if the shell has overrides.
set "RAG_DASHBOARD_PORT=8765"
node "scripts\windows-preflight.mjs"
if errorlevel 1 (
  echo Windows synthetic preflight blocked the launch.
  popd
  exit /b 2
)
echo Verified synthetic local demo; not for customer data. Press Ctrl+C to stop.
node "src\dashboard-cli.mjs" "fixtures\ax_multi_doc_v0"
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%
