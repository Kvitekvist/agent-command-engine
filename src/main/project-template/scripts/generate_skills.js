#!/usr/bin/env node
/**
 * Generate comprehensive SKILL.md files for all recommended skills
 * Based on research from SKILL_RECOMMENDATIONS.md and EXPERT_ANALYSIS.md
 */

const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '..', '.claude', 'skills');

// Skill definitions based on research
const skills = {
  // PHASE 1: Foundation (Immediate)
  'test-generator': {
    version: '1.0.0',
    description: 'Automatically generate unit and integration tests for functions, classes, and API endpoints',
    triggers: '"generate tests", "add test coverage", "scaffold tests", "create tests for"',
    category: 'Testing & Quality Assurance',
    phase: 1,
    priority: 'High',
    content: `# Test Generator Skill

## Purpose

Automatically generates comprehensive unit and integration tests based on code analysis. Testing infrastructure is the foundation for reliable AI-assisted development (source: [Addy Osmani's LLM coding workflow](https://addyosmani.com/blog/ai-coding-workflow/)).

## When to Use

- After implementing new functions or classes
- When test coverage gaps are identified
- Before refactoring (establish baseline)
- For API endpoints that lack tests

## How It Works

1. **Analyzes** function signatures, parameters, return types
2. **Detects** testing framework (Jest, pytest, JUnit, Mocha, etc.)
3. **Generates** test files following project conventions
4. **Creates** test fixtures and mock data
5. **Calculates** coverage impact

## Usage

\`\`\`
/test-generator <file_path>
/test-generator <file_path> --framework=jest
/test-generator <file_path> --integration
\`\`\`

## Options

- \`--framework\`: Override auto-detected framework
- \`--integration\`: Generate integration tests instead of unit tests
- \`--fixtures\`: Generate test fixtures/factories
- \`--update\`: Update existing test file

## Integration Points

- Reads: \`coding_conventions.md\` for test style
- Reads: \`architecture.md\` for test structure
- Updates: Test files in project's test directory
- Triggers: \`test-coverage\` to validate new tests

## Output

Creates/updates test files with:
- Descriptive test names
- Arrange-Act-Assert pattern
- Edge case coverage
- Mock/stub setup
- Assertion library usage

## Best Practices

1. Run on new code immediately
2. Review generated tests for business logic accuracy
3. Add custom edge cases manually
4. Integrate with \`definition-of-done\` pre-commit hook
`
  },

  'security-scan': {
    version: '1.0.0',
    description: 'Scan dependencies for known CVEs, check for outdated packages, and detect secrets in code',
    triggers: '"security scan", "check vulnerabilities", "audit dependencies", "scan for CVEs"',
    category: 'Security & Compliance',
    phase: 1,
    priority: 'High',
    content: `# Security Scan Skill

## Purpose

Automated dependency vulnerability scanning and security checks. With software supply chain attacks on the rise, teams need automated ways to track and remediate risks in third-party code (source: [Cycode Enterprise SCA Tools](https://cycode.com/blog/top-enterprise-sca-tools/)).

## When to Use

- On every dependency change (package.json, requirements.txt, etc.)
- Before creating releases
- Weekly scheduled scans
- Pre-deployment verification

## How It Works

1. **Scans** package manifest files for dependencies
2. **Checks** against CVE databases (NVD, GitHub Advisory, etc.)
3. **Detects** secrets in staged files (API keys, tokens, passwords)
4. **Verifies** license compliance
5. **Generates** security report with remediation steps

## Usage

\`\`\`
/security-scan
/security-scan --critical-only
/security-scan --dependencies
/security-scan --secrets
\`\`\`

## Options

- \`--critical-only\`: Only report critical/high severity
- \`--dependencies\`: Scan dependencies only
- \`--secrets\`: Scan code for secrets only
- \`--fix\`: Auto-update fixable vulnerabilities

## Integration Points

- Reads: \`package.json\`, \`requirements.txt\`, \`go.mod\`, etc.
- Reads: \`project_config.md\` for allowed licenses
- Updates: \`project_status.md\` with security score
- Blocks: Commits if critical vulnerabilities found (via \`definition-of-done\`)
- Creates: Tickets for vulnerabilities (via \`new-ticket\`)

## Output

Security report includes:
- CVE IDs and severity levels
- Affected dependencies and versions
- Available patches/fixes
- Exploit availability status
- License compliance issues
- Detected secrets (redacted)

## Remediation Workflow

1. Auto-patches available → Apply with \`--fix\`
2. Manual update needed → Create ticket with steps
3. No fix available → Document risk acceptance
4. Secret detected → Remove, rotate credentials

## Severity Levels

- **Critical**: Block all commits
- **High**: Block production deployments
- **Medium**: Warning, create ticket
- **Low**: Log, review quarterly
`
  },

  'code-review-ai': {
    version: '1.0.0',
    description: 'AI-powered code review with static analysis, security checks, and improvement suggestions',
    triggers: '"review this code", "check for issues", "PR review", "code quality check"',
    category: 'Code Quality & Review',
    phase: 1,
    priority: 'High',
    content: `# Code Review AI Skill

## Purpose

Automated code review with AI-powered analysis for bugs, anti-patterns, security vulnerabilities, and code quality. Research shows AI code review in CI/CD enables early bug detection and improved code quality (source: [Augment Code AI Review Guide](https://www.augmentcode.com/guides/ai-code-review-ci-cd-pipeline)).

## When to Use

- Before creating pull requests
- On every commit (via \`definition-of-done\`)
- When refactoring complex code
- For security-sensitive changes

## How It Works

1. **Static Analysis**: Detects bugs, anti-patterns, complexity issues
2. **Security Scan**: Identifies SQL injection, XSS, CSRF, auth issues
3. **Style Check**: Enforces coding conventions
4. **Performance**: Identifies N+1 queries, inefficient algorithms
5. **Maintainability**: Calculates cyclomatic complexity, suggests improvements

## Usage

\`\`\`
/code-review-ai <file_or_directory>
/code-review-ai --staged
/code-review-ai --severity=high
/code-review-ai --fix
\`\`\`

## Options

- \`--staged\`: Review only staged files
- \`--severity\`: Filter by severity (low/medium/high/critical)
- \`--fix\`: Auto-fix safe issues
- \`--explain\`: Include detailed explanations

## Integration Points

- Reads: \`coding_conventions.md\` for project standards
- Reads: \`architecture.md\` for architectural patterns
- Updates: Inline comments or separate report
- Blocks: Commits if critical issues found
- Integrates: With \`definition-of-done\` skill

## Analysis Categories

### 1. Correctness
- Null pointer dereferences
- Type mismatches
- Logic errors
- Unreachable code

### 2. Security
- SQL injection vectors
- XSS vulnerabilities
- Insecure cryptography
- Hardcoded credentials
- Path traversal

### 3. Performance
- N+1 database queries
- Inefficient algorithms (O(n²) where O(n) possible)
- Memory leaks
- Unnecessary computations

### 4. Maintainability
- Functions >50 lines
- Cyclomatic complexity >10
- Duplicated code blocks
- Missing error handling

### 5. Style
- Naming conventions
- Code formatting
- Comment quality
- Import organization

## Output Format

\`\`\`markdown
## Code Review Report

### Critical Issues (2)
- [SECURITY] SQL injection in user_query (line 45)
- [BUG] Null pointer dereference (line 78)

### High Priority (5)
- [PERFORMANCE] N+1 query in loop (line 120)
...

### Suggestions (12)
- Extract method (lines 200-250)
...
\`\`\`

## Auto-Fix Capabilities

Safe auto-fixes:
- Import organization
- Code formatting
- Simple refactorings (extract variable)
- Type annotations

Requires manual review:
- Logic changes
- Security fixes
- Performance optimizations
- Architectural changes
`
  },

  'calibrate-enhanced': {
    version: '1.0.0',
    description: 'In-session self-improvement by analyzing conversations for corrections, preferences, gaps, and patterns',
    triggers: '"calibrate", "what can you improve", "update your skills", "what did we learn", "tune up"',
    category: 'Meta-Learning',
    phase: 1,
    priority: 'High',
    content: `# Calibrate Enhanced Skill

## Purpose

In-session self-improvement for Claude Code by analyzing conversations and suggesting specific updates to skills, CLAUDE.md, memory, or workflows. Based on [robonuggets' calibrate skill](https://github.com/robonuggets/calibrate).

## When to Use

- End of work sessions
- After completing tickets
- When user corrects Claude's behavior
- After introducing new patterns

## How It Works

### Core Loop (4 Steps)

1. **Scans** the current conversation for:
   - Corrections (user corrects Claude)
   - Preferences (user expresses preferences)
   - Gaps (missing capabilities)
   - Patterns (recurring themes)

2. **Maps** each finding to target file:
   - Skills (\`.claude/skills/\`)
   - CLAUDE.md
   - Memory files
   - Workflows (\`.claude/prompts/\`)

3. **Presents** up to 7 specific suggestions with:
   - What changed
   - Why it matters
   - Where to update
   - Proposed change

4. **Applies** selected suggestions with user approval

## Usage

\`\`\`
/calibrate
/calibrate --auto-apply=safe
/calibrate --save-report
\`\`\`

## Options

- \`--auto-apply=safe\`: Auto-apply non-breaking changes
- \`--save-report\`: Save findings to \`.claude/calibration/\`
- \`--dry-run\`: Show suggestions without applying

## Pattern Detection

### Corrections
- "No, not that" → Identify wrong assumption
- "Actually, we use X" → Update tech stack
- "Don't do Y" → Add constraint to memory

### Preferences
- "I prefer pattern X" → Update coding_conventions.md
- "Always do Y first" → Update workflow prompts
- "Use Z instead of W" → Update skill defaults

### Gaps
- "You should also check X" → Missing skill
- "What about Y?" → Missing documentation
- "Can you do Z?" → Capability gap

### Patterns
- Recurring commands → Create skill shortcut
- Repeated corrections → Update CLAUDE.md
- Common workflows → Codify as prompt

## Integration Points

- Reads: Current conversation context
- Updates: Any \`.claude/\` file as appropriate
- Creates: New skills if capability gaps detected
- Appends: To \`project_memory.md\` for persistent learnings

## Example Output

\`\`\`markdown
## Calibration Report - 2026-08-06

### Findings (5)

1. **Preference: Test framework**
   - You corrected me 3x: "We use pytest, not unittest"
   - Target: \`tech_stack.md\`, \`coding_conventions.md\`
   - Proposed: Add pytest as standard testing framework
   - [ ] Apply

2. **Gap: Database migrations**
   - You asked "Can you generate migrations?"
   - Target: New skill \`migration-generator\`
   - Proposed: Create skill for Alembic/Flyway migrations
   - [ ] Apply

3. **Pattern: Always run tests before commit**
   - You said this 4x in last 10 sessions
   - Target: \`definition-of-done\` skill
   - Proposed: Add test run as mandatory pre-commit step
   - [ ] Apply
...
\`\`\`

## Self-Improvement Metrics

Track over time:
- Corrections per session (should decrease)
- Preference conflicts (should decrease)
- Capability gaps (should decrease)
- Pattern codification (should increase)

## Best Practices

1. Run \`/calibrate\` at end of each session
2. Review suggestions carefully
3. Apply incrementally, test changes
4. Track metrics in \`project_status.md\`
5. Archive calibration reports quarterly
`
  },

  'token-analytics': {
    version: '1.0.0',
    description: 'Analyze Claude Code token usage from JSONL transcripts and provide cost optimization insights',
    triggers: '"token usage", "cost analysis", "where are tokens going", "optimize tokens"',
    category: 'Cost Optimization',
    phase: 1,
    priority: 'High',
    content: `# Token Analytics Skill

## Purpose

Track and analyze Claude Code token usage from session JSONL transcripts. Identifies expensive patterns and suggests optimizations. Based on [nateherkai's token-dashboard](https://github.com/nateherkai/token-dashboard).

## When to Use

- Weekly cost reviews
- After major development sprints
- When optimizing workflows
- Before budget planning

## How It Works

1. **Scans** \`~/.claude/projects/<project>/\` JSONL files
2. **Parses** messages for token counts (input/output/cache)
3. **Aggregates** by session, skill, tool, project
4. **Identifies** expensive patterns
5. **Suggests** optimizations

## Usage

\`\`\`
/token-analytics
/token-analytics --last-week
/token-analytics --by-skill
/token-analytics --top-10
\`\`\`

## Options

- \`--last-week\`: Analyze last 7 days only
- \`--by-skill\`: Group by skill invocations
- \`--by-tool\`: Group by tool calls
- \`--top-10\`: Show top 10 expensive operations
- \`--compare=<session>\`: Compare to baseline

## Analytics Provided

### 1. Overview
- Total tokens (input/output/cache)
- Estimated cost by pricing tier
- Session count and average cost
- Cache hit rate

### 2. By Skill
- Token cost per skill invocation
- Most expensive skills
- Skill call frequency
- ROI analysis (value vs cost)

### 3. By Tool
- Tool call frequency
- Token cost per tool
- Tool result sizes
- Optimization opportunities

### 4. By Project
- Cross-project comparison
- Project token trends
- Per-project budget tracking

### 5. Optimization Tips
- Repeated file reads → Cache or batch
- Oversized tool results → Limit or filter
- Low cache hit rate → Improve prompts
- Expensive skills → Refactor or limit

## Output Format

\`\`\`markdown
## Token Analytics Report

### Summary (Last 7 Days)
- Total Input: 2.4M tokens
- Total Output: 450K tokens
- Cache Reads: 1.8M tokens (savings: $12.50)
- Estimated Cost: $45.20 (Pro tier)

### Top 5 Expensive Skills
1. \`code-review-ai\`: 850K tokens, $18.50
2. \`test-generator\`: 620K tokens, $12.30
3. \`architecture-document\`: 380K tokens, $7.80
...

### Optimization Opportunities
1. **File Read Redundancy**
   - \`src/main.py\` read 47 times
   - Suggestion: Cache or batch reads
   - Potential savings: $2.40/week

2. **Large Tool Results**
   - \`Grep\` averaging 125KB/call
   - Suggestion: Use \`--head-limit\`
   - Potential savings: $1.80/week
...
\`\`\`

## Integration Points

- Reads: \`~/.claude/projects/*/\*.jsonl\`
- Updates: \`project_status.md\` with cost metrics
- Appends: To \`project_memory.md\` Technical Debt if issues found
- Creates: \`.claude/analytics/\` directory for reports

## Cost Tracking

Supports multiple pricing tiers:
- **API**: Pay-per-token
- **Pro**: $20/month budget
- **Max**: $200/month budget
- **Max-20x**: $4,000/month budget

Shows "API-equivalent dollars" for subscription tiers.

## Privacy

- All processing local
- No data sent externally
- JSONL files never modified
- Cache stored in \`.claude/analytics.db\`

## Best Practices

1. Run weekly for trend analysis
2. Compare month-over-month
3. Set budget alerts
4. Optimize top 3 expensive patterns
5. Track optimization impact
`
  },

  'gauntlet-loop': {
    version: '1.0.0',
    description: 'Quality enforcement through builder/critic pairs with blind comparison against real benchmarks',
    triggers: '"gauntlet", "quality loop", "improve until it wins", "blind comparison"',
    category: 'Quality Assurance',
    phase: 1,
    priority: 'High',
    content: `# Gauntlet Loop Skill

## Purpose

Enforces quality through builder/critic separation and blind comparison against real-world benchmarks. No fixed iteration limits—continues until work wins comparison. Based on [robonuggets' gauntlet-loop](https://github.com/robonuggets/gauntlet-loop) (originally from Matt Shumer's Claude of Duty).

## When to Use

- For high-stakes deliverables
- When "good enough" isn't enough
- For client-facing work
- When learning new patterns

## Quality Bar Methodology

Quality bars must be:

- **Named**: A specific thing, not a category
- **Fetchable**: The critic can access it (URL, file, screenshot)
- **Comparable**: Both outputs can be evaluated side-by-side

✅ Good: "Match the style of stripe.com/pricing"
❌ Bad: "Award-winning design"

## How It Works

### Workflow

1. **User submits goal**
2. **System suggests 2-3 quality bars**
3. **User selects one**
4. **Generate ~150-word prompt**
5. **Fresh session starts**
6. **Builder/critic pairs run**:
   - **Builder**: Creates work in small pieces
   - **Critic**: Fresh context, blind comparison
7. **Repeat until win condition**

### Builder/Critic Separation

**Critical detail**: "The critic needs fresh context and no knowledge of how hard the builder tried."

This prevents self-grading bias.

### Blind Comparison

1. Strip identifying labels
2. Present both outputs side-by-side
3. Forced binary choice: which is better?
4. No scoring scales (they "drift upward")

### Exit Condition

- Work **wins** blind comparison, OR
- User **manually stops**

No fixed iteration count. Loop continues "until it wins."

## Usage

\`\`\`
/gauntlet <goal>
/gauntlet "Create landing page for SaaS product"
/gauntlet --quality-bar=<url>
\`\`\`

## Options

- \`--quality-bar=<url>\`: Skip selection, use specified bar
- \`--max-iterations=N\`: Safety limit (default: no limit)
- \`--piece-size=small|medium|large\`: Work chunk size

## Example Session

\`\`\`
User: /gauntlet Create pricing page

System: Suggested quality bars:
1. stripe.com/pricing
2. linear.app/pricing
3. notion.so/pricing

User: 1

System: Generated prompt:
"Create a pricing page that matches the clarity,
hierarchy, and conversion focus of stripe.com/pricing.
Three tiers, clear feature comparison, prominent CTA..."

[Builder creates v1]
[Critic compares to Stripe]
Critic: "Stripe wins. Issues: CTAs not prominent,
feature list cluttered, no visual hierarchy"

[Builder creates v2]
[Critic compares to Stripe]
Critic: "Our version wins. Better feature organization,
clearer CTAs, comparable visual hierarchy"

System: ✅ Win condition met. Work complete.
\`\`\`

## Integration Points

- Creates: Separate session for fresh critic context
- Uses: \`Agent\` tool for builder/critic spawning
- Stores: Comparison history in \`.claude/gauntlet/\`
- Updates: \`ticket_memory.md\` with quality learnings

## Quality Bar Library

Build reusable quality bars in \`.claude/quality-bars.md\`:

\`\`\`markdown
## UI/UX
- Linear.app navigation
- Stripe.com pricing pages
- Notion.so onboarding

## Code
- Rails codebase architecture
- Stripe API documentation style
...
\`\`\`

## Best Practices

1. Choose fetchable, concrete bars
2. Let the loop run (don't stop early)
3. Track what quality bars work best
4. Document learnings for future sessions
5. Use for high-impact work, not everything

## Limitations

- Requires Claude to access quality bar (URL, file, etc.)
- Time-intensive (multiple iterations)
- Best for final polish, not exploration
- Needs clear success criteria

## Metrics

Track in \`project_status.md\`:
- Average iterations to win
- Quality bar effectiveness
- Builder/critic agreement rate
- User manual stops (should decrease)
`
  }
};

// Generate SKILL.md content
function generateSkillMD(skillName, skillData) {
  return `---
name: ${skillName}
description: ${skillData.description}
version: ${skillData.version}
triggers: ${skillData.triggers}
category: ${skillData.category}
phase: ${skillData.phase}
priority: ${skillData.priority}
---

${skillData.content}

## Research Sources

This skill was designed based on extensive research from:
- Industry best practices for ${skillData.category.toLowerCase()}
- Expert patterns from nateherkai and robonuggets
- See \`docs/SKILL_RECOMMENDATIONS.md\` for full citations

## Version History

- v${skillData.version} (2026-08-06): Initial implementation

## Contributing

To improve this skill:
1. Use \`/calibrate-enhanced\` to suggest improvements
2. Document patterns in \`project_memory.md\`
3. Update this file with learnings
`;
}

// Write SKILL.md files
console.log('Generating SKILL.md files...\n');

let created = 0;
let errors = 0;

for (const [skillName, skillData] of Object.entries(skills)) {
  const skillDir = path.join(SKILLS_DIR, skillName);
  const skillFile = path.join(skillDir, 'SKILL.md');

  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(skillDir)) {
      fs.mkdirSync(skillDir, { recursive: true });
    }

    // Generate content
    const content = generateSkillMD(skillName, skillData);

    // Write file
    fs.writeFileSync(skillFile, content, 'utf8');
    console.log(`✓ Created ${skillName}/SKILL.md`);
    created++;
  } catch (error) {
    console.error(`✗ Error creating ${skillName}: ${error.message}`);
    errors++;
  }
}

console.log(`\nPhase 1 Complete:`);
console.log(`- Created: ${created} skills`);
console.log(`- Errors: ${errors}`);
console.log(`\nNext: Run this script with --phase=2 for remaining skills`);
console.log(`Or start using Phase 1 skills immediately!\n`);

process.exit(errors > 0 ? 1 : 0);
