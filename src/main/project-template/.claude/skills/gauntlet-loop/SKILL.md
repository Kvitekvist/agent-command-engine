---
name: gauntlet-loop
description: Quality enforcement through builder/critic pairs with blind comparison against real benchmarks
version: 1.0.0
triggers: "gauntlet", "quality loop", "improve until it wins", "blind comparison"
category: Quality Assurance
phase: 1
priority: High
---

# Gauntlet Loop Skill

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

```
/gauntlet <goal>
/gauntlet "Create landing page for SaaS product"
/gauntlet --quality-bar=<url>
```

## Options

- `--quality-bar=<url>`: Skip selection, use specified bar
- `--max-iterations=N`: Safety limit (default: no limit)
- `--piece-size=small|medium|large`: Work chunk size

## Example Session

```
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
```

## Integration Points

- Creates: Separate session for fresh critic context
- Uses: `Agent` tool for builder/critic spawning
- Stores: Comparison history in `.claude/gauntlet/`
- Updates: `ticket_memory.md` with quality learnings

## Quality Bar Library

Build reusable quality bars in `.claude/quality-bars.md`:

```markdown
## UI/UX
- Linear.app navigation
- Stripe.com pricing pages
- Notion.so onboarding

## Code
- Rails codebase architecture
- Stripe API documentation style
...
```

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

Track in `project_status.md`:
- Average iterations to win
- Quality bar effectiveness
- Builder/critic agreement rate
- User manual stops (should decrease)


## Research Sources

This skill was designed based on extensive research from:
- Industry best practices for quality assurance
- Expert patterns from nateherkai and robonuggets

## Version History

- v1.0.0 (2026-08-06): Initial implementation

## Contributing

To improve this skill:
1. Use `/calibrate-enhanced` to suggest improvements
2. Document patterns in `project_memory.md`
3. Update this file with learnings
