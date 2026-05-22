@echo off
setlocal

cd /d "%~dp0"

set APP_URL=http://127.0.0.1:5173/
set EXTENSION_DIR=%CD%\extension

echo Starting Rent Lens...
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required.
  where winget >nul 2>nul
  if errorlevel 1 (
    echo winget is not available. Opening the Node.js download page.
    start "" "https://nodejs.org/"
    echo Install Node.js 20 LTS or newer, then run this file again.
    echo.
    pause
    exit /b 1
  ) else (
    echo Installing Node.js LTS with winget...
    winget install -e --id OpenJS.NodeJS.LTS
    echo.
    echo If Node.js was installed successfully, close this window and run start-windows.cmd again.
    pause
    exit /b 0
  )
)

for /f "tokens=1 delims=." %%A in ('node -p "process.versions.node"') do set NODE_MAJOR=%%A
if %NODE_MAJOR% LSS 20 (
  echo Current Node.js version:
  node -v
  echo Node.js 20 or newer is required.
  where winget >nul 2>nul
  if errorlevel 1 (
    start "" "https://nodejs.org/"
    echo Install Node.js 20 LTS or newer, then run this file again.
    pause
    exit /b 1
  ) else (
    echo Installing Node.js LTS with winget...
    winget install -e --id OpenJS.NodeJS.LTS
    echo.
    echo If Node.js was installed successfully, close this window and run start-windows.cmd again.
    pause
    exit /b 0
  )
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm is missing. Opening the Node.js download page.
  start "" "https://nodejs.org/"
  echo Install Node.js 20 LTS or newer, then run this file again.
  pause
  exit /b 1
)

echo Environment OK:
node -v
npm -v
echo.

if not exist "node_modules" (
  echo Installing project dependencies. This may take a few minutes...
  call npm install
  if errorlevel 1 (
    echo.
    echo Dependency installation failed.
    pause
    exit /b 1
  )
  echo.
) else (
  echo Dependencies already installed.
  echo.
)

if not exist "data" mkdir data

echo The web app will open automatically: %APP_URL%
echo.
echo Browser extension note:
echo   Browsers do not allow local extensions to be installed automatically by a script.
echo   This script will open the extension folder and browser extension page.
echo   In Chrome or Edge, enable Developer mode, choose Load unpacked, then select:
echo   %EXTENSION_DIR%
echo.

start "" powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 4; Start-Process '%APP_URL%'; Start-Sleep -Seconds 1; Start-Process explorer.exe -ArgumentList '%EXTENSION_DIR%'"

where chrome >nul 2>nul
if not errorlevel 1 (
  start "" chrome "chrome://extensions"
) else (
  where msedge >nul 2>nul
  if not errorlevel 1 start "" msedge "edge://extensions"
)

call npm run dev
