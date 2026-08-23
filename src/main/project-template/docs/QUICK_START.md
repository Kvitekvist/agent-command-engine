# Quick Start Guide

## For New Project Users

### Create a New Project (2 commands)

```bash
# 1. Create from template
gh repo create my-new-project --template Kvitekvist/claude_project_framework --private --clone
cd my-new-project

# 2. Initialize
.\scripts\init_project.bat
```

That's it! Your project is ready.

---

## Next Steps

### 1. Customize Build Scripts

Edit these files for your stack:

* `scripts/setup.bat` - Install dependencies
* `scripts/build.bat` - Build your project
* `scripts/run.bat` - Run your application

### 2. Choose a License

Edit `LICENSE` file with your chosen license (MIT, Apache-2.0, etc.)

### 3. Create Your First Feature

```bash
# Copy ticket template
copy tickets\TEMPLATE.md tickets\open\TICKET-0001.md

# Edit the ticket to describe your feature
# Then open in Claude Code and start building!
```

---

## Development Workflow

### Every Feature or Bug Fix:

1. **Create a ticket** in `tickets/open/`
2. **Implement** the feature/fix
3. **Update** the ticket as you work
4. **Commit** with `[TICKET-####]` format
5. **Close** the ticket when done

### Large Features:

For complex work (3+ components, multiple layers), the framework will:
- Propose breaking it into parent + child tickets
- Track dependencies
- Guide you through implementation order

See `.claude/prompts/decomposition.md` for details.

---

## Memory System

The AI reads these files at the start of each session:

* `.claude/memory/project_memory.md` - Project goals and context
* `.claude/memory/architecture.md` - System design
* `.claude/memory/tech_stack.md` - Technologies used
* `.claude/memory/ticket_memory.md` - What's been completed

**Keep these updated!** They're the AI's long-term memory.

---

## Helper Scripts

```bash
.\scripts\setup.bat         # Install dependencies
.\scripts\build.bat         # Build the project
.\scripts\run.bat           # Run the application
.\scripts\git_commit.bat    # Commit with proper format
.\scripts\git_push.bat      # Push to remote
.\scripts\clear_cache.bat   # Clean build artifacts
.\scripts\release.bat       # Create a release
```

---

## Questions?

* **Framework questions**: See `docs/DISTRIBUTION.md`
* **Workflow questions**: See `.claude/CLAUDE.md`
* **Ticket system**: See `tickets/TEMPLATE.md`

---

Happy building! 🚀
