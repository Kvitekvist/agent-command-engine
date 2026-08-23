---
name: test-generator
description: Automatically generate unit and integration tests for functions, classes, and API endpoints
version: 1.0.0
triggers: "generate tests", "add test coverage", "scaffold tests", "create tests for"
category: Testing & Quality Assurance
phase: 1
priority: High
---

# Test Generator Skill

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

```
/test-generator <file_path>
/test-generator <file_path> --framework=jest
/test-generator <file_path> --integration
```

## Options

- `--framework`: Override auto-detected framework
- `--integration`: Generate integration tests instead of unit tests
- `--fixtures`: Generate test fixtures/factories
- `--update`: Update existing test file

## Integration Points

- Reads: `coding_conventions.md` for test style
- Reads: `architecture.md` for test structure
- Updates: Test files in project's test directory
- Triggers: `test-coverage` to validate new tests

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
4. Integrate with `definition-of-done` pre-commit hook


## Research Sources

This skill was designed based on extensive research from:
- Industry best practices for testing & quality assurance
- Expert patterns from nateherkai and robonuggets

## Version History

- v1.0.0 (2026-08-06): Initial implementation

## Contributing

To improve this skill:
1. Use `/calibrate-enhanced` to suggest improvements
2. Document patterns in `project_memory.md`
3. Update this file with learnings
