# Standard Project Layout

```
Project/

.claude/
    CLAUDE.md
    PROJECT_RULES.md
    PROJECT_SKELETON.md
    framework_version.md
    project_config.md
    memory/
        architecture.md
        coding_conventions.md
        project_memory.md
        project_status.md
        tech_stack.md
        ticket_memory.md
    prompts/
        bugfix.md
        feature.md
        project_init.md
        project_questionnaire.md
        refactor.md
        release.md
    templates/
        changelog_template.md
        readme_template.md
        tickets.md

src/

tests/

docs/

tickets/
    open/
    closed/
    archived/
    TEMPLATE.md

scripts/
    setup.bat
    build.bat
    git_commit.bat
    clear_cache.bat
    run.bat
    release.bat

build/

releases/

assets/

README.md

CHANGELOG.md

LICENSE

.gitignore

version.txt
```

All AI-operational files (instructions, rules, memory, prompts, templates) live under `.claude/`.
Root-level files and folders are project-facing: source, tests, docs, tickets, scripts, and build output.

If folders already exist, do not overwrite them.

Only create missing files.
