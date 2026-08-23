@echo off
REM Pushes the current branch to origin using GITHUB_TOKEN from .env.
REM .env is git-ignored - never commit it.

if not exist .env (
    echo .env not found. Create one with a line: GITHUB_TOKEN=your_token_here
    exit /b 1
)

set GITHUB_TOKEN=
for /f "usebackq tokens=1,* delims==" %%A in (".env") do if "%%A"=="GITHUB_TOKEN" set GITHUB_TOKEN=%%B

if "%GITHUB_TOKEN%"=="" (
    echo GITHUB_TOKEN not set in .env
    exit /b 1
)

for /f "delims=" %%U in ('git remote get-url origin') do set ORIGIN_URL=%%U
set ORIGIN_URL=%ORIGIN_URL:https://=%

git push https://%GITHUB_TOKEN%@%ORIGIN_URL% HEAD
