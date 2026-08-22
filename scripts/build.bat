@echo off
setlocal

set "ROOT=%~dp0.."
set "SRC=%ROOT%\src"
set "RELEASES=%ROOT%\releases"

echo Building Agent Command Engine...
node "%~dp0bump-version.js"
if errorlevel 1 (
    echo ERROR: Version bump failed.
    pause
    exit /b 1
)

for /f "usebackq delims=" %%v in (`node -e "process.stdout.write(require('%SRC:\=/%/package.json').version)" 2^>nul`) do set "VERSION=%%v"
if not defined VERSION (
    echo ERROR: Could not read version from src\package.json.
    pause
    exit /b 1
)

pushd "%SRC%"
call npm run package
if errorlevel 1 (
    echo ERROR: Packaging failed.
    popd
    pause
    exit /b 1
)
popd

set "PORTABLE=%RELEASES%\Agent Command Engine %VERSION%.exe"
set "INSTALLER=%RELEASES%\Agent Command Engine Setup %VERSION%.exe"
if not exist "%PORTABLE%" (
    echo ERROR: Portable executable was not created:
    echo   "%PORTABLE%"
    pause
    exit /b 1
)
if not exist "%INSTALLER%" (
    echo ERROR: Installer was not created:
    echo   "%INSTALLER%"
    pause
    exit /b 1
)

echo.
echo Build complete.
echo   Portable: "%PORTABLE%"
echo   Installer: "%INSTALLER%"
pause
endlocal
