@echo off
echo ============================================================
echo  Electron Binary Installer
echo ============================================================
echo.

REM Make sure electron package is installed
cd /d "%~dp0..\src"
if not exist node_modules\electron (
    echo Installing electron npm package...
    call npm install electron
)

REM Already done?
if exist node_modules\electron\path.txt (
    echo Electron already installed! Starting app...
    goto :run
)

echo.
echo Running PowerShell downloader (bypasses proxy)...
powershell -ExecutionPolicy Bypass -File "%~dp0download-electron.ps1"

if errorlevel 1 (
    echo.
    echo Download failed. See instructions above.
    pause
    exit /b 1
)

:run
cd /d "%~dp0..\src"
if not exist node_modules\electron\path.txt (
    echo ERROR: Electron not installed. Check output above.
    pause
    exit /b 1
)
echo Starting app...
call "%~dp0run.bat"
