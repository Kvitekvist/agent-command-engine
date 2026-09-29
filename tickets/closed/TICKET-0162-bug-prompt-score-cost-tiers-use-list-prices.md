# TICKET-0162 — Prompt Score cost tiers rank by list price

**Status**

Closed

**Type**

Bug

**Priority**

Medium

**Created**

2026-09-29

---

## Description

The Prompt Score tab's Models Used table put models in the wrong cost tier.
After a change to fixed dollar cutoffs every model showed as Lower-cost, and
before that the tercile split ranked models by their observed blended $/1K
rate, so Haiku 4.5 ranked above Sonnet 5 and Opus 4.5 looked cheap.

---

## Reason

The observed rate is session cost divided by input + output + cache-read
tokens. It tracks cache behaviour more than price: long, heavily cached
sessions pull a model's rate down, and cache writes (in the cost, not in the
token count) push short sessions' rate up. Haiku runs short subagent
sessions with a high write-to-read ratio, so it came out near $0.72/M while
Sonnet 5 came out near $0.27/M.

---

## Implementation Plan

* [x] Add a list-price table ($/1M input, output) for current Claude models
  and the GPT-6 / GPT-5.6 families, matched by the longest key contained in
  the model id after lowercasing and turning dots into dashes.
* [x] Price every model on one reference job (100k in, 700 out); models
  missing from the table fall back to their observed rate.
* [x] Tier by percentile: cheapest 20% economy, priciest 30% premium, the
  rest balanced. Count strictly cheaper / strictly pricier models so equal
  prices share a tier.

---

## Files Modified

- `src/renderer/utils/promptScore.mjs`
- `src/tests/prompt-score.test.js`
- `CHANGELOG.md`, `src/package.json`, `src/package-lock.json`, `version.txt`

---

## Testing

- `node --test tests/prompt-score.test.js`: 11 pass, including new cases for
  the 20/50/30 split, list price beating a heavily cached observed rate, and
  id spellings (`claude-opus-4-5-20251101`, `haiku-4.5`,
  `anthropic/claude-sonnet-4.6`, `gpt-5.6-terra`, unknown `gpt-4o`).
- Ran the 13 models from the user's Models Used table through
  `modelCostTiers`: economy gpt-6-luna, gpt-5.6-luna, Haiku 4.5; premium
  gpt-6-astra and Opus 4.5/4.6/4.7/5; the rest balanced. User confirmed.

---

## Result

Tiers now follow list price. Prices come from Anthropic's model table and
https://developers.openai.com/api/docs/pricing (checked 2026-09-29). The
table needs a manual update when prices change or a model ships; unlisted
models still use the observed rate.

---

## Notes

Follow-up to TICKET-0151 (Prompt Score tab).

---

## Closed

2026-09-29
