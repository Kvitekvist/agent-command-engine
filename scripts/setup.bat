@echo off
echo ============================================================
echo  Claude Projects Interface - Setup
echo ============================================================

echo.
echo [1/3] Checking Node.js (v18+ required)...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)
for /f %%i in ('node -e "process.stdout.write(process.versions.node)"') do set NODE_VER=%%i
echo Found Node.js v%NODE_VER%

echo.
echo [2/3] Installing dependencies (clean install)...
cd /d "%~dp0..\src"

REM Clean any partial installs to avoid corrupt node_modules
if exist node_modules (
    echo Removing previous node_modules...
    rmdir /s /q node_modules
)
if exist package-lock.json del /f package-lock.json

REM Pure JS deps - no native compilation needed (uses sql.js WASM instead of better-sqlite3)
echo Installing packages...
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed. Check the output above.
    pause
    exit /b 1
)

echo.
echo [3/3] Setup complete!
echo.
echo Start the app with:
echo   scripts\run.bat
echo.
pause
