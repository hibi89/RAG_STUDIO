@echo off
setlocal DisableDelayedExpansion
REM Strict pinned synthetic SMAX producer-shaped input ONLY; never customer data.
if not "%~1"=="" (
 echo No user file arguments are accepted by this synthetic MVP.
 exit /b 2
)
pushd "%~dp0" 2>nul
if errorlevel 1 exit /b 2
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js required. No software was installed.
 popd
 exit /b 2
)
if exist "portable-manifest.json" (
 node "scripts\p533-verify-portable.mjs"
 if errorlevel 1 (
  echo Portable integrity check blocked the SMAX synthetic demo.
  popd
  exit /b 2
 )
)
node "scripts\windows-preflight.mjs"
if errorlevel 1 (
 echo Synthetic Windows preflight blocked launch.
 popd
 exit /b 2
)
set "RAG_DASHBOARD_PORT=8765"
echo Local SYNTHETIC SMAX V1 to SQLite/document dashboard. Ctrl+C to stop.
node "scripts\p534-smax-vertical-cli.mjs"
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%
