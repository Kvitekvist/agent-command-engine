@echo off
REM Project Initialization Script
REM Customizes the template for a new project

setlocal EnableDelayedExpansion

echo.
echo ========================================
echo   AI Project Framework Initialization
echo ========================================
echo.

REM Check if already initialized
if exist ".initialized" (
    echo WARNING: This project appears to be already initialized.
    echo.
    set /p REINIT="Reinitialize anyway? (y/N): "
    if /i not "!REINIT!"=="y" (
        echo Initialization cancelled.
        exit /b 0
    )
)

REM Get project information
echo Let's set up your new project.
echo.

set /p PROJECT_NAME="Project Name: "
if "!PROJECT_NAME!"=="" (
    echo ERROR: Project name is required.
    exit /b 1
)

set /p PROJECT_DESC="Project Description: "
if "!PROJECT_DESC!"=="" set PROJECT_DESC=A new AI-assisted software project

set /p LANGUAGE="Primary Language (e.g., Python, C#, JavaScript, Go): "
if "!LANGUAGE!"=="" set LANGUAGE=Not specified

set /p FRAMEWORK="Framework (e.g., Flask, .NET, React, None): "
if "!FRAMEWORK!"=="" set FRAMEWORK=None

set /p BUILD_TOOL="Build Tool (e.g., PyInstaller, MSBuild, npm, None): "
if "!BUILD_TOOL!"=="" set BUILD_TOOL=None

set /p BUILDS_EXECUTABLE="Does this project build an executable? (y/N): "
if /i "!BUILDS_EXECUTABLE!"=="y" (
    set BUILDS_EXECUTABLE=yes
) else (
    set BUILDS_EXECUTABLE=no
)

set /p TESTS_REQUIRED="Are tests required before commits? (y/N): "
if /i "!TESTS_REQUIRED!"=="y" (
    set TESTS_REQUIRED=yes
) else (
    set TESTS_REQUIRED=no
)

set /p AUTO_PUSH="Auto-push after successful commits? (y/N): "
if /i "!AUTO_PUSH!"=="y" (
    set AUTO_PUSH=yes
) else (
    set AUTO_PUSH=no
)

echo.
echo ----------------------------------------
echo Configuration Summary:
echo ----------------------------------------
echo Project Name:        !PROJECT_NAME!
echo Description:         !PROJECT_DESC!
echo Language:            !LANGUAGE!
echo Framework:           !FRAMEWORK!
echo Build Tool:          !BUILD_TOOL!
echo Builds Executable:   !BUILDS_EXECUTABLE!
echo Tests Required:      !TESTS_REQUIRED!
echo Auto-Push:           !AUTO_PUSH!
echo ----------------------------------------
echo.

set /p CONFIRM="Proceed with initialization? (Y/n): "
if /i "!CONFIRM!"=="n" (
    echo Initialization cancelled.
    exit /b 0
)

echo.
echo Initializing project...
echo.

REM Update project_config.md
echo [1/6] Updating project configuration...
(
    echo project_name: !PROJECT_NAME!
    echo.
    echo language: !LANGUAGE!
    echo.
    echo framework: !FRAMEWORK!
    echo.
    echo build_tool: !BUILD_TOOL!
    echo.
    echo git_provider: GitHub
    echo.
    echo build_executable: !BUILDS_EXECUTABLE!
    echo.
    echo auto_push: !AUTO_PUSH!
    echo.
    echo ticket_system: markdown
    echo.
    echo branch_strategy: feature
    echo.
    echo tests_required: !TESTS_REQUIRED!
    echo.
    echo release_method: manual
) > .claude\project_config.md

REM Update tech_stack.md
echo [2/6] Updating tech stack documentation...
powershell -Command "(Get-Content .claude\memory\tech_stack.md) -replace '\*\*Project Name:\*\*', '**Project Name:** !PROJECT_NAME!' -replace '\*\*Version:\*\*', '**Version:** 0.1.0' -replace 'Language:', 'Language: !LANGUAGE!' -replace 'Name:', 'Name: !FRAMEWORK!' | Set-Content .claude\memory\tech_stack.md"

REM Update project_memory.md
echo [3/6] Updating project memory...
powershell -Command "(Get-Content .claude\memory\project_memory.md) -replace 'Describe the long-term goal.', '!PROJECT_DESC!' -replace 'Current development milestone.', 'Initial setup and first feature implementation' | Set-Content .claude\memory\project_memory.md"

REM Update project_status.md
echo [4/6] Updating project status...
powershell -Command "(Get-Content .claude\memory\project_status.md) -replace 'Not Started', 'Initial Setup' -replace 'Define first feature.', 'Complete project initialization and define first feature' | Set-Content .claude\memory\project_status.md"

REM Update README.md
echo [5/6] Updating README...
(
    echo # !PROJECT_NAME!
    echo.
    echo ## Overview
    echo.
    echo !PROJECT_DESC!
    echo.
    echo ---
    echo.
    echo ## Tech Stack
    echo.
    echo * **Language:** !LANGUAGE!
    echo * **Framework:** !FRAMEWORK!
    echo * **Build Tool:** !BUILD_TOOL!
    echo.
    echo ---
    echo.
    echo ## Setup
    echo.
    echo 1. Clone this repository
    echo 2. Run `scripts\setup.bat` to install dependencies
    echo 3. Run `scripts\run.bat` to start the application
    echo.
    echo ---
    echo.
    echo ## Development Workflow
    echo.
    echo This project uses the AI Project Framework for maintainable AI-assisted development.
    echo.
    echo * Every feature and bug fix requires a ticket before code is written
    echo * Documentation is updated alongside code changes
    echo * Memory files track project context across sessions
    echo.
    echo See `.claude/CLAUDE.md` for the complete development workflow.
    echo.
    echo ---
    echo.
    echo ## Project Structure
    echo.
    echo See `.claude/PROJECT_SKELETON.md` for the full directory layout.
    echo.
    echo ---
    echo.
    echo ## License
    echo.
    echo See `LICENSE` file for details.
) > README.md

REM Create initialization marker
echo [6/6] Finalizing...
echo Initialized on %date% %time% > .initialized
echo Project: !PROJECT_NAME! >> .initialized

REM Clean up template tickets
if exist "tickets\closed\TICKET-0001.md" del /q "tickets\closed\TICKET-0001.md"
if exist "tickets\closed\TICKET-0002.md" del /q "tickets\closed\TICKET-0002.md"

REM Update ticket memory
(
    echo # Ticket Memory
    echo.
    echo This file provides a quick overview of completed work.
    echo.
    echo Append entries only.
    echo.
    echo ---
    echo.
    echo ## Completed Tickets
    echo.
    echo None yet.
    echo.
    echo ---
    echo.
    echo Continue adding completed tickets in chronological order.
) > .claude\memory\ticket_memory.md

REM Reset version
echo 0.1.0 > version.txt

REM Update CHANGELOG
(
    echo # Changelog
    echo.
    echo All notable changes to this project are documented here.
    echo.
    echo ---
    echo.
    echo ## Version 0.1.0 — %date%
    echo.
    echo ### Added
    echo.
    echo * Initial project setup from AI Project Framework template
    echo * Project scaffolding and directory structure
    echo.
    echo ### Changed
    echo.
    echo *
    echo.
    echo ### Fixed
    echo.
    echo *
    echo.
    echo ### Removed
    echo.
    echo *
) > CHANGELOG.md

echo.
echo ========================================
echo   Initialization Complete!
echo ========================================
echo.
echo Your project "!PROJECT_NAME!" is ready.
echo.
echo Next steps:
echo.
echo 1. Review and edit LICENSE file
echo 2. Customize scripts\setup.bat for your stack
echo 3. Customize scripts\build.bat if applicable
echo 4. Customize scripts\run.bat for your stack
echo 5. Create your first ticket for the initial feature
echo.
echo Optional: Commit this initialization
echo   git add -A
echo   git commit -m "Initialize project: !PROJECT_NAME!"
echo.
echo For GitHub setup, consider:
echo   gh repo create !PROJECT_NAME! --private --source=. --remote=origin --push
echo.
echo Happy coding!
echo.

endlocal
