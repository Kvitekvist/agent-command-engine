---
name: token-analytics
description: Analyze Claude Code token usage from JSONL transcripts and provide cost optimization insights
version: 1.0.0
triggers: "token usage", "cost analysis", "where are tokens going", "optimize tokens"
category: Cost Optimization
phase: 1
priority: High
---

# Token Analytics Skill

## Purpose

Track and analyze Claude Code token usage from session JSONL transcripts. Identifies expensive patterns and suggests optimizations. Based on [nateherkai's token-dashboard](https://github.com/nateherkai/token-dashboard).

## When to Use

- Weekly cost reviews
- After major development sprints
- When optimizing workflows
- Before budget planning

## How It Works

1. **Scans** `~/.claude/projects/<project>/` JSONL files
2. **Parses** messages for token counts (input/output/cache)
3. **Aggregates** by session, skill, tool, project
4. **Identifies** expensive patterns
5. **Suggests** optimizations

## Usage

```
/token-analytics
/token-analytics --last-week
/token-analytics --by-skill
/token-analytics --top-10
```

## Options

- `--last-week`: Analyze last 7 days only
- `--by-skill`: Group by skill invocations
- `--by-tool`: Group by tool calls
- `--top-10`: Show top 10 expensive operations
- `--compare=<session>`: Compare to baseline

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

```markdown
## Token Analytics Report

### Summary (Last 7 Days)
- Total Input: 2.4M tokens
- Total Output: 450K tokens
- Cache Reads: 1.8M tokens (savings: $12.50)
- Estimated Cost: $45.20 (Pro tier)

### Top 5 Expensive Skills
1. `code-review-ai`: 850K tokens, $18.50
2. `test-generator`: 620K tokens, $12.30
3. `architecture-document`: 380K tokens, $7.80
...

### Optimization Opportunities
1. **File Read Redundancy**
   - `src/main.py` read 47 times
   - Suggestion: Cache or batch reads
   - Potential savings: $2.40/week

2. **Large Tool Results**
   - `Grep` averaging 125KB/call
   - Suggestion: Use `--head-limit`
   - Potential savings: $1.80/week
...
```

## Integration Points

- Reads: `~/.claude/projects/*/*.jsonl`
- Updates: `project_status.md` with cost metrics
- Appends: To `project_memory.md` Technical Debt if issues found
- Creates: `.claude/analytics/` directory for reports

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
- Cache stored in `.claude/analytics.db`

## Best Practices

1. Run weekly for trend analysis
2. Compare month-over-month
3. Set budget alerts
4. Optimize top 3 expensive patterns
5. Track optimization impact


## Research Sources

This skill was designed based on extensive research from:
- Industry best practices for cost optimization
- Expert patterns from nateherkai and robonuggets

## Version History

- v1.0.0 (2026-08-06): Initial implementation

## Contributing

To improve this skill:
1. Use `/calibrate-enhanced` to suggest improvements
2. Document patterns in `project_memory.md`
3. Update this file with learnings
