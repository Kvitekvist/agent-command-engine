# TICKET-0022

**Status**

Closed

**Type**

Feature

**Priority**

Medium

**Created**

2026-08-09

---

## Description

Add a live token-usage dashboard to CPI's Token Usage tab, matching the
design of the user's reference app `token-monitor`
(`C:\Users\jensr\Documents\VS Projects\token-monitor-main`): per-provider
(Claude, Codex) cards showing real subscription quota (5-hour rolling +
weekly limits with reset countdowns), today's usage broken down by model
and by project, and a total tokens-used figure — all sourced live from
`tokscale`, not CPI's own `prompts` DB table. Make Token Usage the app's
default tab on launch.

---

## Reason

User shared a screenshot of `token-monitor`'s dashboard and said "I like
this exact design, so make this the default tab." `token-monitor` and CPI
already share the same underlying data source (`tokscale`, already a CPI
dependency since TICKET-0018) — this is a design port, not new plumbing to
invent from scratch. It also happens to solve part of the "rebuild token
tracking for the new per-agent terminal path" priority noted in
TICKET-0019's Notes: unlike CPI's `prompts` table (which only fills in via
the now-unused headless `AgentService.sendPrompt` path), `tokscale` reads
Claude's/Codex's own session transcripts directly, so it reflects usage
regardless of whether an agent ran headlessly or through the new embedded
terminal.

---

## Implementation Plan

* [ ] Research pass against `token-monitor`'s source confirmed: quota %/
      reset data is available directly from the installed `tokscale`
      binary's own `usage --json` subcommand (`tokscale usage --json` —
      returns `[{provider, plan, metrics: [{label, used_percent,
      remaining_percent, resets_at}]}]`, e.g. Claude gets `Session` +
      `Weekly`, Codex gets `Weekly` only) — this CPI's installed tokscale
      version (4.9.0) added natively; `token-monitor`'s older-pinned
      version (^4.8.0) didn't have it and calls Anthropic's/OpenAI's own
      account APIs by hand instead. Using tokscale's own command is
      simpler and doesn't require CPI to touch OAuth tokens itself.
* [ ] Today's per-model / per-project breakdown: `tokscale --json --today
      --client claude,codex --group-by workspace,model` (also confirmed
      directly against the installed CLI) — one call produces rows
      carrying both `model` and `workspaceLabel`, rolled up client-side
      into two breakdowns from the same dataset. Per-row token total =
      `input + output + cacheRead + cacheWrite` (excludes `reasoning` —
      confirmed via `token-monitor`'s `usage.js`: Codex's `reasoning`
      tokens are already counted inside `output`, so adding them again
      would double-count)
* [ ] Extend `TokscaleService.js`: `getQuota()` and `getTodayBreakdown(clients)`
* [ ] Add `tokens:getLiveUsage` IPC handler (`handlers.js`) combining both
      into `{ claude: {...}, codex: {...} }`, tolerant of either provider
      failing independently (e.g. not logged into one of them) rather than
      the whole call failing
* [ ] Expose `window.cpi.getLiveTokenUsage()` in `preload.js`
* [ ] Copy `claude.svg`/`codex.svg` icon assets from `token-monitor`'s
      `assets/icons/` into `src/renderer/assets/icons/` — real monochrome
      SVGs (`currentColor` fill), not emoji, matching the reference design
* [ ] Add `src/renderer/components/UsageCard.jsx` — one provider card:
      icon + name + "Live usage · today", a bar per quota metric (session/
      weekly) with reset countdown, a Models list, a Today-by-project
      grid, and a big total-tokens number
* [ ] Rewrite `TokenView.jsx`'s top section to render a Claude + Codex
      `UsageCard` pair fetched from `getLiveTokenUsage()`, refreshed on
      mount and on a light polling interval. Keep the existing
      Recharts-based historical charts (DB-sourced, per-project) below it
      rather than deleting them — relabeled to make clear they're
      historical/DB-scoped, not live
* [ ] Set `useStore.js`'s default `activeView` to `'tokens'` instead of
      `'agents'`
* [x] Manual verification, driven live over the Chrome DevTools Protocol:
      launched the app fresh and confirmed it lands on the Usage tab with
      no click needed; confirmed both provider cards render real data
      (Claude: Pro plan, 5-hour rolling 80%/resets in 4h 14m, Weekly
      46%/resets in 4d 11h, real model/project token breakdowns, 139.6M
      tokens today; Codex: Plus plan, Weekly 0%/resets in 6d 21h, real
      breakdown, 383.6K tokens today) matching a direct
      `window.cpi.getLiveTokenUsage()` call's raw payload; confirmed the
      historical Recharts section below still renders correctly with real
      data and no console errors anywhere

---

## Files Modified

- src/main/services/TokscaleService.js
- src/main/ipc/handlers.js
- src/main/preload.js
- src/renderer/components/UsageCard.jsx (new)
- src/renderer/assets/icons/claude.svg (new)
- src/renderer/assets/icons/codex.svg (new)
- src/renderer/views/TokenView.jsx
- src/renderer/store/useStore.js
- src/tests/tokscale-service.test.js

---

## Testing

`npm test` (11/11 passing, including new `rowTokenTotal` coverage),
`npm run build:renderer` / `npm run build:main`, and full live
verification — see checklist above.

---

## Result

Fully implemented and verified live: the app now opens directly on the
Usage tab, showing real Claude + Codex subscription quota (5-hour
rolling/weekly % and reset countdowns) and today's token usage broken
down by model and by project, all sourced from the already-installed
`tokscale` binary rather than CPI's own (frozen-for-new-agents, see
TICKET-0019) `prompts` table. The existing Recharts-based historical view
is preserved underneath, relabeled to make clear it's DB-scoped/historical
rather than live.

---

## Notes

Chose a **vertical card layout** (icon/name header, then quota bars, then
a Models/Today-by-project two-column grid, then a total) rather than the
reference screenshot's wide single-row horizontal layout — CPI's main
content pane sits next to a fixed Sidebar and isn't reliably as wide as
the reference app's own window, so a literal pixel-for-pixel port would
have broken down at normal window widths. Same information architecture
and visual language (icons, colors, bar style, section labels), adapted
layout.

Brand colors taken from the user's reference screenshot (not
`token-monitor`'s own CSS, which uses a slightly different palette):
Claude a warm coral/orange (`#d97757`), Codex blue (`#3b82f6`).

Live usage polls every 60s while the Usage tab exists in the component
tree (`LIVE_USAGE_POLL_MS`) — independent of the historical section's
project-scoped `load()`, since quota/today's-usage is whole-machine data,
not scoped to whichever CPI project is active.

---

## Closed

2026-08-09
