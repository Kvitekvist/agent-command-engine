@echo off
REM Regenerates docs\node-map.html (the second brain brain.js queries).

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js is required but was not found on PATH.
    exit /b 1
)

pushd "%~dp0.."
node scripts\build-node-map.js
if errorlevel 1 (
    popd
    exit /b 1
)
if not exist docs\node-map.html (
    echo docs\node-map.html was not written.
    popd
    exit /b 1
)
echo Wrote docs\node-map.html
popd
