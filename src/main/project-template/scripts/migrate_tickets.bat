@echo off
REM Ticket Migration Helper
REM Helps migrate existing tickets into category subfolders

echo.
echo ========================================
echo   Ticket Category Migration Tool
echo ========================================
echo.
echo This tool helps organize tickets into category subfolders.
echo.
echo Categories:
echo   1. features       - New functionality
echo   2. bugs           - Bug fixes
echo   3. documentation  - Docs and comments
echo   4. infrastructure - Build, CI/CD, tooling
echo   5. research       - Investigation and analysis
echo.
echo Current flat structure will be preserved in:
echo   tickets/open/.gitkeep (existing tickets stay here)
echo   tickets/closed/.gitkeep (existing tickets stay here)
echo.
echo New tickets should be created in appropriate category subfolders.
echo.
echo To manually migrate a ticket:
echo   1. Determine its category from the Type field
echo   2. Move the file: tickets/open/NNNN-Title.md
echo                 to: tickets/open/[category]/NNNN-Title.md
echo   3. Update the Category field in the ticket
echo.
echo ========================================
echo.
echo Listing existing tickets:
echo.

echo Open tickets:
if exist tickets\open\*.md (
    dir /b tickets\open\*.md
) else (
    echo   (none)
)

echo.
echo Closed tickets:
if exist tickets\closed\*.md (
    dir /b tickets\closed\*.md
) else (
    echo   (none)
)

echo.
echo ========================================
echo Migration complete. Review ticket locations.
echo ========================================
