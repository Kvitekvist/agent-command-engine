@echo off
REM Install all recommended skills into .claude/skills/

echo Installing comprehensive skill system...
echo.

REM Create skill directories
echo Creating skill directories...
mkdir ".claude\skills\test-generator" 2>nul
mkdir ".claude\skills\security-scan" 2>nul
mkdir ".claude\skills\code-review-ai" 2>nul
mkdir ".claude\skills\test-coverage" 2>nul
mkdir ".claude\skills\smoke-test" 2>nul
mkdir ".claude\skills\secrets-detect" 2>nul
mkdir ".claude\skills\api-doc-generator" 2>nul
mkdir ".claude\skills\architecture-document" 2>nul
mkdir ".claude\skills\readme-generator" 2>nul
mkdir ".claude\skills\component-scaffold" 2>nul
mkdir ".claude\skills\microservice-scaffold" 2>nul
mkdir ".claude\skills\migration-generator" 2>nul
mkdir ".claude\skills\schema-validator" 2>nul
mkdir ".claude\skills\performance-profile" 2>nul
mkdir ".claude\skills\benchmark-runner" 2>nul
mkdir ".claude\skills\ci-config-generator" 2>nul
mkdir ".claude\skills\release-prepare" 2>nul
mkdir ".claude\skills\dependency-update" 2>nul
mkdir ".claude\skills\license-check" 2>nul
mkdir ".claude\skills\health-check" 2>nul
mkdir ".claude\skills\technical-debt-tracker" 2>nul
mkdir ".claude\skills\refactor-safe" 2>nul
mkdir ".claude\skills\calibrate-enhanced" 2>nul
mkdir ".claude\skills\token-analytics" 2>nul
mkdir ".claude\skills\gauntlet-loop" 2>nul
mkdir ".claude\skills\four-cs-audit" 2>nul

echo.
echo Skill directories created successfully!
echo.
echo Next steps:
echo 1. Run 'node scripts/generate_skills.js' to populate SKILL.md files
echo 2. Review generated skills in .claude/skills/
echo 3. Customize project-specific settings in project_config.md
echo.
pause
