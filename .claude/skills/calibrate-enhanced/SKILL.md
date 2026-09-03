---
name: calibrate-enhanced
description: In-session self-improvement by analyzing conversations for corrections, preferences, gaps, and patterns
version: 1.0.0
triggers: "calibrate", "what can you improve", "update your skills", "what did we learn", "tune up"
category: Meta-Learning
phase: 1
priority: High
---

# Calibrate Enhanced Skill

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
   - Skills (`.claude/skills/`)
   - CLAUDE.md
   - Memory files
   - Workflows (`.claude/prompts/`)

3. **Presents** up to 7 specific suggestions with:
   - What changed
   - Why it matters
   - Where to update
   - Proposed change

4. **Applies** selected suggestions with user approval

## Usage

```
/calibrate
/calibrate --auto-apply=safe
/calibrate --save-report
```

## Options

- `--auto-apply=safe`: Auto-apply non-breaking changes
- `--save-report`: Save findings to `.claude/calibration/`
- `--dry-run`: Show suggestions without applying

## Scope Clarification

When user says "add all X" or requests bulk implementation (10+ items):

1. **Ask for confirmation**:
   - "Should I implement all [N] items immediately, or start with Phase 1 (highest priority)?"
   - Show estimated effort for full implementation
   - Recommend phased approach with justification

2. **Present options**:
   - **Immediate**: Implement all now (time estimate: X)
   - **Phased**: Implement Phase 1 now (Y items), document roadmap for rest
   - **Custom**: User specifies which subset

3. **If phased approach selected**:
   - Implement highest priority/foundation items immediately
   - Document remaining items with clear roadmap
   - Explain dependencies between phases

**Rationale**: Large bulk requests may benefit from phased implementation. Explicit confirmation prevents misalignment.

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
- Updates: Any `.claude/` file as appropriate
- Creates: New skills if capability gaps detected
- Appends: To `project_memory.md` for persistent learnings

## Example Output

```markdown
## Calibration Report - 2026-08-06

### Findings (5)

1. **Preference: Test framework**
   - You corrected me 3x: "We use pytest, not unittest"
   - Target: `tech_stack.md`, `coding_conventions.md`
   - Proposed: Add pytest as standard testing framework
   - [ ] Apply

2. **Gap: Database migrations**
   - You asked "Can you generate migrations?"
   - Target: New skill `migration-generator`
   - Proposed: Create skill for Alembic/Flyway migrations
   - [ ] Apply

3. **Pattern: Always run tests before commit**
   - You said this 4x in last 10 sessions
   - Target: `definition-of-done` skill
   - Proposed: Add test run as mandatory pre-commit step
   - [ ] Apply
...
```

## Self-Improvement Metrics

Track over time:
- Corrections per session (should decrease)
- Preference conflicts (should decrease)
- Capability gaps (should decrease)
- Pattern codification (should increase)

## Best Practices

1. Run `/calibrate` at end of each session
2. Review suggestions carefully
3. Apply incrementally, test changes
4. Track metrics in `project_status.md`
5. Archive calibration reports quarterly


## Research Sources

This skill was designed based on extensive research from:
- Industry best practices for meta-learning
- Expert patterns from nateherkai and robonuggets

## Version History

- v1.0.0 (2026-08-06): Initial implementation

## Contributing

To improve this skill:
1. Use `/calibrate-enhanced` to suggest improvements
2. Document patterns in `project_memory.md`
3. Update this file with learnings
