@echo off
setlocal DisableDelayedExpansion
REM P5.42: double click -> Windows native file selection -> fixed synthetic AX preview.
REM User paths never enter CMD variables, arguments, quoting or expansion.
if not "%~1"=="" (
 echo This picker does not accept command line paths or arguments.
 exit /b 2
)
pushd "%~dp0" 2>nul
if errorlevel 1 exit /b 2
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js 22.23 or newer required. Nothing installed.
 popd
 exit /b 2
)
node -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit(major>22||(major===22&&minor>=23)?0:2)"
if errorlevel 1 (
 echo Windows Node.js 22.23 or newer required. Nothing installed.
 popd
 exit /b 2
)
if exist "native-portable-manifest.json" (
 node "scripts\p543-verify-native-portable.mjs"
 if errorlevel 1 (
  echo Native preview bundle integrity check failed. No launch.
  popd
  exit /b 2
 )
)
if exist "portable-manifest.json" (
 node "scripts\p533-verify-portable.mjs"
 if errorlevel 1 (
  echo Portable source integrity verification failed.
  popd
  exit /b 2
 )
)
if not exist "node_modules\pdfjs-dist\legacy\build\pdf.mjs" (
 echo Local PDF parser missing. Install project dependencies once with npm ci.
 echo No dependencies will be installed automatically.
 popd
 exit /b 2
)
if not exist "node_modules\mammoth\lib\index.js" (
 echo Local DOCX parser missing. Install project dependencies once with npm ci.
 echo No dependencies will be installed automatically.
 popd
 exit /b 2
)
if not exist "scripts\p542-native-file-picker.ps1" (
 echo Native file picker script missing. Launch blocked.
 popd
 exit /b 2
)
echo Choose 2 to 4 local PDF or DOCX files. Synthetic AX fixture only.
echo Selected files are local unapproved previews. No upload or customer import.
echo Close with Ctrl+C. The private local URL must not be shared.
set "RAG_AUTO_OPEN_LOCAL_BROWSER=1"
set "RAG_DASHBOARD_PORT=8765"
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "scripts\p542-native-file-picker.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%
