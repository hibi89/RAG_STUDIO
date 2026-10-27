@echo off
setlocal DisableDelayedExpansion
REM P5.37: zero path expansion in CMD. The Node wizard reads selections on stdin.
REM The output is always REVIEW_HOLD; no AX/SQLite import.
pushd "%~dp0" 2>nul
if errorlevel 1 exit /b 2
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js is required but not bundled.
 popd
 exit /b 2
)
node -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit(major>22||(major===22&&minor>=23)?0:2)"
if errorlevel 1 (
 echo Windows Node.js 22.23 or newer is required for the verified file identity checks.
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
echo Interactive local-only input review. Results never approve AX or SQLite import.
node "src\local-smax-approval-wizard.mjs"
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%
