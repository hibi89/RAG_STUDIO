@echo off
setlocal DisableDelayedExpansion
REM Explicit local opt-in, three selected source files; never imports into AX/SQLite.
if "%~3"=="" (
 echo Usage: RUN_LOCAL_SMAX_REVIEW.cmd smax-v1.json original.csv local.txt
 exit /b 2
)
if not "%~4"=="" (
 echo Exactly 3 selected files required.
 exit /b 2
)
pushd "%~dp0" 2>nul
if errorlevel 1 exit /b 2
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js is required but not bundled.
 popd
 exit /b 2
)
if exist "portable-manifest.json" (
 node "scripts\p533-verify-portable.mjs"
 if errorlevel 1 (
  echo Portable integrity check failed.
  popd
  exit /b 2
 )
)
node "src\local-smax-review-cli.mjs" "%~1" "%~2" "%~3"
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%
