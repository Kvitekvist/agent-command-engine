---
name: security-scan
description: Scan dependencies for known CVEs, check for outdated packages, and detect secrets in code
version: 1.0.0
triggers: "security scan", "check vulnerabilities", "audit dependencies", "scan for CVEs"
category: Security & Compliance
phase: 1
priority: High
---

# Security Scan Skill

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

```
/security-scan
/security-scan --critical-only
/security-scan --dependencies
/security-scan --secrets
```

## Options

- `--critical-only`: Only report critical/high severity
- `--dependencies`: Scan dependencies only
- `--secrets`: Scan code for secrets only
- `--fix`: Auto-update fixable vulnerabilities

## Integration Points

- Reads: `package.json`, `requirements.txt`, `go.mod`, etc.
- Reads: `project_config.md` for allowed licenses
- Updates: `project_status.md` with security score
- Blocks: Commits if critical vulnerabilities found (via `definition-of-done`)
- Creates: Tickets for vulnerabilities (via `new-ticket`)

## Output

Security report includes:
- CVE IDs and severity levels
- Affected dependencies and versions
- Available patches/fixes
- Exploit availability status
- License compliance issues
- Detected secrets (redacted)

## Remediation Workflow

1. Auto-patches available → Apply with `--fix`
2. Manual update needed → Create ticket with steps
3. No fix available → Document risk acceptance
4. Secret detected → Remove, rotate credentials

## Severity Levels

- **Critical**: Block all commits
- **High**: Block production deployments
- **Medium**: Warning, create ticket
- **Low**: Log, review quarterly


## Research Sources

This skill was designed based on extensive research from:
- Industry best practices for security & compliance
- Expert patterns from nateherkai and robonuggets

## Version History

- v1.0.0 (2026-08-06): Initial implementation

## Contributing

To improve this skill:
1. Use `/calibrate-enhanced` to suggest improvements
2. Document patterns in `project_memory.md`
3. Update this file with learnings
