@echo off
echo Building Claude Projects Interface...
cd /d "%~dp0..\src"
call npm run build
if errorlevel 1 (
    echo ERROR: Build failed.
    pause
    exit /b 1
)
echo.
echo Build complete. Run 'npm run package' inside src\ to create installer.
pause
