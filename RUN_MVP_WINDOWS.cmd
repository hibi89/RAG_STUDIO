@echo off
setlocal DisableDelayedExpansion
REM Public synthetic-only demo, no installs, no downloads, no customer files.
if not "%~1"=="" (
 echo This demo accepts no file arguments.
 exit /b 2
)
pushd "%~dp0" 2>nul
if errorlevel 1 exit /b 2
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js must be installed separately. No changes made.
 popd
 exit /b 2
)
node "scripts\p533-verify-portable.mjs"
if errorlevel 1 (
 echo Portable demo integrity check blocked execution.
 popd
 exit /b 2
)
call "RUN_SYNTHETIC_WINDOWS.cmd"
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%
