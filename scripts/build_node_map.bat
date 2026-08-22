@echo off
REM Regenerates docs\node-map.html - the second brain that brain.js queries.
REM See .claude\skills\build-node-map\SKILL.md for when to run this.
setlocal

set "ROOT=%~dp0.."
set "MAP=%ROOT%\docs\node-map.html"

where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js was not found on PATH.
    echo   The node map generator needs Node; install it or run scripts\setup.bat first.
    pause
    exit /b 1
)

echo Rebuilding the ACE node map...
node "%~dp0build-node-map.js"
if errorlevel 1 (
    echo ERROR: Node map generation failed.
    pause
    exit /b 1
)

if not exist "%MAP%" (
    echo ERROR: Generator reported success but the map was not written:
    echo   "%MAP%"
    pause
    exit /b 1
)

echo.
echo Node map written to "%MAP%"
echo   Open it in a browser to explore, or query it with:
echo     node .claude\skills\node-map\assets\brain.js "your question"
pause
endlocal
