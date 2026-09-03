@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM  Agent Command Engine - Quick Release
REM  Same as release.bat but:
REM    - Skips rebuild if src/ unchanged since last tag
REM    - Only builds portable exe (not installer)
REM    - 10x faster for non-code releases (docs, configs, etc)
REM
REM  Usage:
REM    scripts\quick-release.bat ["commit / release message"]
REM    scripts\quick-release.bat --force ["message"]  (force rebuild)
REM ============================================================

set "ROOT=%~dp0.."
set "SRC=%ROOT%\src"
set "RELEASES=%ROOT%\releases"
set "FORCE_BUILD="

if "%~1"=="--force" (
    set "FORCE_BUILD=1"
    shift
)

for /f "usebackq delims=" %%v in (`node -e "process.stdout.write(require('%SRC:\=/%/package.json').version)" 2^>nul`) do set "VERSION=%%v"
if not defined VERSION (
    echo ERROR: Could not read version from src\package.json
    exit /b 1
)
set "TAG=v%VERSION%"

if "%~1"=="" (set "MSG=Release %TAG%") else (set "MSG=%~1")

if exist "%ROOT%\.env" (
    for /f "usebackq tokens=1,* delims==" %%a in ("%ROOT%\.env") do (
        if /i "%%a"=="GH_TOKEN" set "GH_TOKEN=%%b"
        if /i "%%a"=="github_token" set "GH_TOKEN=%%b"
    )
)

echo ============================================================
echo  Quick-releasing %TAG%
echo  Message: %MSG%
echo ============================================================

REM --- Check if src/ changed since last tag ------------------
set "NEED_BUILD=1"
if not defined FORCE_BUILD (
    for /f %%t in ('git -C "%ROOT%" describe --tags --abbrev=0 2^>nul') do set "LAST_TAG=%%t"
    if defined LAST_TAG (
        git -C "%ROOT%" diff --quiet "!LAST_TAG!" HEAD -- src/
        if !errorlevel! equ 0 (
            set "NEED_BUILD="
            echo   src/ unchanged since !LAST_TAG! - reusing build
        )
    )
)

REM --- Build only if needed -----------------------------------
if defined NEED_BUILD (
    echo.
    echo [1/5] Rebuilding (src/ changed)...
    pushd "%SRC%"
    call npm run build:renderer
    if errorlevel 1 ( popd & exit /b 1 )
    call npm run build:main
    if errorlevel 1 ( popd & exit /b 1 )

    REM Build portable only (not installer)
    call electron-builder --win portable --x64
    if errorlevel 1 ( popd & exit /b 1 )
    popd
) else (
    echo.
    echo [1/5] Skipping build (src/ unchanged)
)

set "PORTABLE=%RELEASES%\Agent Command Engine %VERSION%.exe"
if not exist "%PORTABLE%" (
    echo ERROR: Expected portable exe not found:
    echo   "%PORTABLE%"
    exit /b 1
)

REM --- Rest is same as release.bat ----------------------------
echo.
echo [2/5] Committing pending changes...
git -C "%ROOT%" add -A
git -C "%ROOT%" diff --cached --quiet
if errorlevel 1 (
    git -C "%ROOT%" commit -m "%MSG%"
    if errorlevel 1 ( echo ERROR: commit failed. & exit /b 1 )
) else (
    echo   Nothing to commit, skipping.
)

echo.
echo [3/5] Pushing current branch...
for /f "delims=" %%b in ('git -C "%ROOT%" rev-parse --abbrev-ref HEAD') do set "BRANCH=%%b"
git -C "%ROOT%" push origin "%BRANCH%"
if errorlevel 1 ( echo ERROR: push failed. & exit /b 1 )

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
    if errorlevel 1 ( echo ERROR: merge conflict. & exit /b 1 )
    git -C "%ROOT%" push origin main
    if errorlevel 1 ( echo ERROR: push main failed. & exit /b 1 )
)

echo.
echo [5/5] Publishing GitHub release %TAG%...
git -C "%ROOT%" tag %TAG% 2>nul
git -C "%ROOT%" push origin %TAG% 2>nul

pushd "%ROOT%"
gh release view %TAG% >nul 2>&1
if errorlevel 1 (
    echo   Creating release %TAG% (portable only)...
    gh release create %TAG% "%PORTABLE%" -t "%TAG%" -n "%MSG%"
) else (
    echo   Release %TAG% exists - uploading portable...
    gh release upload %TAG% "%PORTABLE%" --clobber
)
set "GHRC=%errorlevel%"
popd
if not "%GHRC%"=="0" ( echo ERROR: GitHub release failed. & exit /b 1 )

echo.
echo ============================================================
echo  Release %TAG% complete (quick mode).
echo  Built: portable only
echo  Time saved: ~2-3 minutes vs full release
echo ============================================================
endlocal
