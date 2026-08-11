@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM  Agent Command Engine - Release
REM  One command to ship a release:
REM    1. Compile the exe          (npm run package)
REM    2. Commit pending changes
REM    3. Push the current branch
REM    4. Merge into main if needed (when on a feature/bugfix branch)
REM    5. Tag + publish a GitHub release with the exe attached
REM
REM  Usage:
REM    scripts\release.bat ["commit / release message"]
REM  If no message is given, "Release v<version>" is used, where the
REM  version is read from src\package.json.
REM ============================================================

set "ROOT=%~dp0.."
set "SRC=%ROOT%\src"
set "RELEASES=%ROOT%\releases"
set "REPO=Kvitekvist/agent-command-engine"

REM --- Read version from src\package.json (cwd-independent) ---
for /f "usebackq delims=" %%v in (`node -e "process.stdout.write(require('%SRC:\=/%/package.json').version)" 2^>nul`) do set "VERSION=%%v"
if not defined VERSION (
    echo ERROR: Could not read version from src\package.json
    exit /b 1
)
set "TAG=v%VERSION%"

if "%~1"=="" (set "MSG=Release %TAG%") else (set "MSG=%~1")

REM --- Load GitHub token from .env for the gh release step ----
REM  gh's logged-in account may lack write access to this repo; the
REM  .env `github_token` PAT does. Setting GH_TOKEN overrides gh's
REM  keyring auth for THIS process only (setlocal), without changing
REM  the user's logged-in accounts. Git push/commit/tag use SSH and
REM  are unaffected either way. If no token is found, gh falls back
REM  to whatever it's logged in as.
if exist "%ROOT%\.env" (
    for /f "usebackq tokens=1,* delims==" %%a in ("%ROOT%\.env") do (
        if /i "%%a"=="GH_TOKEN" set "GH_TOKEN=%%b"
        if /i "%%a"=="github_token" set "GH_TOKEN=%%b"
    )
)
if defined GH_TOKEN (
    echo   GitHub auth: using github_token from .env
) else (
    echo   GitHub auth: no .env github_token found - using gh login
)

echo ============================================================
echo  Releasing %TAG%
echo  Message: %MSG%
echo ============================================================

REM --- 1. Compile the exe -------------------------------------
echo.
echo [1/5] Compiling exe (npm run package)...
pushd "%SRC%"
call npm run package
if errorlevel 1 (
    echo ERROR: Packaging failed.
    popd
    exit /b 1
)
popd

set "PORTABLE=%RELEASES%\Agent Command Engine %VERSION%.exe"
set "INSTALLER=%RELEASES%\Agent Command Engine Setup %VERSION%.exe"
if not exist "%PORTABLE%" (
    echo ERROR: Expected portable exe not found:
    echo   "%PORTABLE%"
    exit /b 1
)

REM --- 2. Commit pending changes -----------------------------
echo.
echo [2/5] Committing pending changes...
git -C "%ROOT%" add -A
git -C "%ROOT%" diff --cached --quiet
if errorlevel 1 (
    git -C "%ROOT%" commit -m "%MSG%"
    if errorlevel 1 (
        echo ERROR: commit failed.
        exit /b 1
    )
) else (
    echo   Nothing to commit, skipping.
)

REM --- 3. Push the current branch ----------------------------
echo.
echo [3/5] Pushing current branch...
for /f "delims=" %%b in ('git -C "%ROOT%" rev-parse --abbrev-ref HEAD') do set "BRANCH=%%b"
git -C "%ROOT%" push origin "%BRANCH%"
if errorlevel 1 (
    echo ERROR: push failed.
    exit /b 1
)

REM --- 4. Merge into main if needed --------------------------
echo.
echo [4/5] Merge check...
if /i "%BRANCH%"=="main" (
    echo   Already on main, no merge needed.
) else (
    echo   On branch %BRANCH% - merging into main...
    git -C "%ROOT%" checkout main
    if errorlevel 1 ( echo ERROR: could not checkout main. & exit /b 1 )
    git -C "%ROOT%" pull origin main --ff-only
    git -C "%ROOT%" merge --no-ff "%BRANCH%" -m "Merge %BRANCH% for %TAG%"
    if errorlevel 1 (
        echo ERROR: merge conflict - resolve manually, then re-run.
        exit /b 1
    )
    git -C "%ROOT%" push origin main
    if errorlevel 1 ( echo ERROR: push main failed. & exit /b 1 )
)

REM --- 5. Tag + publish GitHub release with the exe ----------
echo.
echo [5/5] Publishing GitHub release %TAG%...
git -C "%ROOT%" tag %TAG% 2>nul
git -C "%ROOT%" push origin %TAG% 2>nul

pushd "%ROOT%"
gh release view %TAG% >nul 2>&1
if errorlevel 1 (
    echo   Creating release %TAG%...
    gh release create %TAG% "%PORTABLE%" "%INSTALLER%" -t "%TAG%" -n "%MSG%"
) else (
    echo   Release %TAG% exists - uploading/overwriting assets...
    gh release upload %TAG% "%PORTABLE%" "%INSTALLER%" --clobber
)
set "GHRC=%errorlevel%"
popd
if not "%GHRC%"=="0" (
    echo ERROR: GitHub release step failed.
    exit /b 1
)

echo.
echo ============================================================
echo  Release %TAG% complete.
echo ============================================================
endlocal
