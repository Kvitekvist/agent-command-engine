@echo off
REM Commits staged changes using the project's required message format.
REM Usage: scripts\git_commit.bat TICKET-#### "Short description"

if "%~1"=="" goto usage
if "%~2"=="" goto usage

git commit -m "[%~1] %~2"
goto end

:usage
echo Usage: scripts\git_commit.bat TICKET-#### "Short description"

:end
