@echo off
setlocal

cd /d "%~dp0"

echo Starting Rent Lens...
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Install Node.js 20 or newer first: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%A in ('node -p "process.versions.node"') do set NODE_MAJOR=%%A
if %NODE_MAJOR% LSS 20 (
  echo Your Node.js version is too old.
  node -v
  echo Please install Node.js 20 or newer: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies. This may take a few minutes...
  call npm install
  if errorlevel 1 (
    echo.
    echo Dependency installation failed.
    pause
    exit /b 1
  )
  echo.
)

echo Opening http://127.0.0.1:5173/
start "" cmd /c "timeout /t 4 /nobreak >nul && start http://127.0.0.1:5173/"

call npm run dev
