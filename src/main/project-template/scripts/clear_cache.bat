@echo off
REM Clears common build/cache artifacts. Extend this list for the project's chosen tooling.

echo Clearing cache and build artifacts...

if exist build (
    for /d %%D in (build\*) do rmdir /s /q "%%D"
    for %%F in (build\*) do if not "%%~nxF"==".gitkeep" del /q "%%F"
)

for /d /r %%D in (__pycache__) do @if exist "%%D" rmdir /s /q "%%D"
for /d /r %%D in (.pytest_cache) do @if exist "%%D" rmdir /s /q "%%D"
if exist node_modules\.cache rmdir /s /q node_modules\.cache
if exist bin rmdir /s /q bin
if exist obj rmdir /s /q obj

echo Done.
