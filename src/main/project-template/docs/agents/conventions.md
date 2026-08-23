# Conventions

<!-- Coding and test conventions that are specific to this project. Generic
     advice belongs nowhere; the working rules in AGENTS.md already cover it. -->

- <language/module style, e.g. "CommonJS in tooling, ESM in src">
- Keep business logic out of UI components when a focused module can own it.
- Prefer pure helpers for parsing, policy, and command construction; cover
  those with tests.
- <test framework and where tests live>
- Update the active ticket's plan, files, and verification result as work
  advances.

The older [coding-conventions memory](../../.claude/memory/coding_conventions.md)
holds generic conventions and can be consulted for additional context.
