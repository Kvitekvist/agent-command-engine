---
name: code-review-ai
description: AI-powered code review with static analysis, security checks, and improvement suggestions
version: 1.0.0
triggers: "review this code", "check for issues", "PR review", "code quality check"
category: Code Quality & Review
phase: 1
priority: High
---

# Code Review AI Skill

## Purpose

Automated code review with AI-powered analysis for bugs, anti-patterns, security vulnerabilities, and code quality. Research shows AI code review in CI/CD enables early bug detection and improved code quality (source: [Augment Code AI Review Guide](https://www.augmentcode.com/guides/ai-code-review-ci-cd-pipeline)).

## When to Use

- Before creating pull requests
- On every commit (via `definition-of-done`)
- When refactoring complex code
- For security-sensitive changes

## How It Works

1. **Static Analysis**: Detects bugs, anti-patterns, complexity issues
2. **Security Scan**: Identifies SQL injection, XSS, CSRF, auth issues
3. **Style Check**: Enforces coding conventions
4. **Performance**: Identifies N+1 queries, inefficient algorithms
5. **Maintainability**: Calculates cyclomatic complexity, suggests improvements

## Usage

```
/code-review-ai <file_or_directory>
/code-review-ai --staged
/code-review-ai --severity=high
/code-review-ai --fix
```

## Options

- `--staged`: Review only staged files
- `--severity`: Filter by severity (low/medium/high/critical)
- `--fix`: Auto-fix safe issues
- `--explain`: Include detailed explanations

## Integration Points

- Reads: `coding_conventions.md` for project standards
- Reads: `architecture.md` for architectural patterns
- Updates: Inline comments or separate report
- Blocks: Commits if critical issues found
- Integrates: With `definition-of-done` skill

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

```markdown
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
```

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


## Research Sources

This skill was designed based on extensive research from:
- Industry best practices for code quality & review
- Expert patterns from nateherkai and robonuggets

## Version History

- v1.0.0 (2026-08-06): Initial implementation

## Contributing

To improve this skill:
1. Use `/calibrate-enhanced` to suggest improvements
2. Document patterns in `project_memory.md`
3. Update this file with learnings
