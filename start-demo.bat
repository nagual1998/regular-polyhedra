@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 22 or later and try again.
  pause
  exit /b 1
)

if not defined PORT set "PORT=4181"
echo Open this URL in your browser after the server starts:
echo http://127.0.0.1:%PORT%/
echo.
echo Press Ctrl+C to stop the server.
echo.
node "%~dp0src\dev-server.mjs"
if errorlevel 1 (
  echo.
  echo Server startup failed. Check the error above.
  echo If the port is in use, close the previous server or set another PORT.
  pause
  exit /b 1
)
endlocal
