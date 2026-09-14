@echo off
setlocal
REM Usage: scripts\release.bat <full-reviewed-commit-sha>
node "%~dp0prepare-release.js" "%~1"
exit /b %errorlevel%
