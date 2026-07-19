@echo off
echo Starting Claude Projects Interface...
echo.

REM Kill stale process on port 5173
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
echo Port 5173 cleared.

echo.
cd /d "%~dp0..\src"
echo Running npm run dev...
call npm run dev
echo.
echo npm run dev exited (errorlevel %errorlevel%)
pause
