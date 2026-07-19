@echo off
del /f "%~dp0..\.git\index.lock" 2>nul
echo Git index.lock removed (or was not present).
cd /d "%~dp0..\src"
git -C "%~dp0.." add -A
git -C "%~dp0.." commit -m "[TICKET-0010] Fix Electron launch — remove show:false, add error handlers, fix port 5173 contention, add electron downloader scripts"
git -C "%~dp0.." push
echo Done.
pause
