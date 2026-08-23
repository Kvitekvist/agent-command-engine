# Distribution Guide

This guide explains how to use the AI Project Framework template to create new projects.

---

## For End Users

### Prerequisites

* Git installed
* GitHub CLI (`gh`) installed - [Download here](https://cli.github.com/)
* GitHub account with access to the template repository

### Creating a New Project

**Step 1: Create from Template**

```bash
gh repo create my-new-project --template Kvitekvist/claude_project_framework --private --clone
cd my-new-project
```

Replace `my-new-project` with your desired project name.

**Step 2: Initialize the Project**

```bash
.\scripts\init_project.bat
```

The script will prompt you for:
* Project name
* Project description
* Primary language (Python, C#, JavaScript, etc.)
* Framework (Flask, .NET, React, etc.)
* Build tool (PyInstaller, MSBuild, npm, etc.)
* Whether it builds an executable
* Whether tests are required before commits
* Whether to auto-push after commits

**Step 3: Customize for Your Stack**

Edit these files based on your chosen language/framework:

* `scripts/setup.bat` - Add dependency installation commands
* `scripts/build.bat` - Add build commands (if applicable)
* `scripts/run.bat` - Add commands to start your application
* `LICENSE` - Choose and add your license

**Step 4: Create Your First Ticket**

```bash
# Copy the ticket template
copy tickets\TEMPLATE.md tickets\open\TICKET-0001.md

# Edit TICKET-0001.md to describe your first feature
```

**Step 5: Start Development**

You're ready! Open the project in Claude Code and start building.

---

## For Repository Administrators

### Setting Up the Template Repository

**Step 1: Configure GitHub Template**

1. Go to https://github.com/Kvitekvist/claude_project_framework
2. Click **Settings**
3. Under **General**, check ✅ **Template repository**
4. Save changes

**Step 2: Update Repository Settings**

Recommended settings:
* **Visibility**: Private (for company internal use)
* **Features**: 
  - ✅ Issues (for template feedback)
  - ✅ Discussions (for template questions)
  - ❌ Wikis (not needed)
  - ❌ Projects (not needed for template)

**Step 3: Set Up Branch Protection**

Protect the `main` branch:
* Require pull request reviews before merging
* Require status checks to pass
* Include administrators (to prevent accidental force pushes)

**Step 4: Add Collaborators**

Grant company team members access:
* **Read access**: All developers who will create projects
* **Write access**: Template maintainers only

---

## Advanced: Custom GitHub Org Template

For large organizations, consider creating an org-level template:

### Option 1: Organization Template Repository

1. Create repository under your organization: `your-org/project-template`
2. Make it a template repository
3. Users create with:
   ```bash
   gh repo create my-project --template your-org/project-template --private --clone
   ```

### Option 2: Internal Package/Script

Create a company-wide initialization script:

```bash
# Install company CLI tool
npm install -g @your-company/create-project

# Users create projects with
create-project my-new-project
```

This script would:
* Clone the template
* Run initialization
* Set up company-specific integrations
* Configure CI/CD pipelines
* Add to company project registry

---

## Updating the Template

### For Template Maintainers

When you improve the template:

1. Make changes in the `claude_project_framework` repository
2. Test thoroughly
3. Update `CHANGELOG.md` and bump version
4. Commit and push
5. Tag the release: `git tag v1.2.0 && git push --tags`
6. Announce to company (Slack, email, etc.)

### For Project Users

Existing projects can pull template improvements:

```bash
# Add template as a remote (one-time)
git remote add template https://github.com/Kvitekvist/claude_project_framework.git

# Fetch template updates
git fetch template

# Review changes
git diff template/main

# Selectively merge improvements
git checkout template/main -- .claude/prompts/new_prompt.md
git commit -m "Update: Add new prompt from template v1.2.0"
```

**Warning**: Do NOT blindly merge `template/main` into your project. Selectively pick improvements to avoid overwriting project-specific files.

---

## Troubleshooting

### "gh: command not found"

Install GitHub CLI:
* **Windows**: `winget install GitHub.cli` or download from https://cli.github.com/
* **Mac**: `brew install gh`
* **Linux**: See https://github.com/cli/cli/blob/trunk/docs/install_linux.md

Then authenticate: `gh auth login`

### "Repository not found" or "403 Forbidden"

You may not have access to the template repository. Contact the repository administrator.

### Init script fails on PowerShell commands

The init script uses PowerShell for some text replacements. If PowerShell is not available:
* Install PowerShell 7: `winget install Microsoft.PowerShell`
* Or manually edit the files mentioned in the script output

### Template checkbox not showing in GitHub

Only repository owners/admins can mark a repository as a template. Contact your repository administrator.

---

## Best Practices

### For Template Maintainers

* **Version the template**: Use semantic versioning in `version.txt`
* **Document changes**: Keep `CHANGELOG.md` up to date
* **Test before releasing**: Create a test project from template before pushing changes
* **Keep it minimal**: Template should be a starting point, not a kitchen sink
* **Provide examples**: Include example implementations in `docs/`

### For Project Users

* **Don't modify `.claude/` framework files**: These are the AI operating instructions
* **Do customize `scripts/`**: Tailor build/setup scripts to your stack
* **Keep memory files updated**: This is the source of truth for Claude
* **Follow the ticket workflow**: Every change needs a ticket
* **Update from template selectively**: Cherry-pick improvements, don't merge blindly

---

## Support

For issues with the template framework itself:
* Open an issue: https://github.com/Kvitekvist/claude_project_framework/issues
* Contact: [Your internal support channel]

For issues with your specific project:
* Use the project's own ticket system in `tickets/`
* Consult `.claude/CLAUDE.md` for workflow guidance

---

## License

See `LICENSE` file in the template repository.
