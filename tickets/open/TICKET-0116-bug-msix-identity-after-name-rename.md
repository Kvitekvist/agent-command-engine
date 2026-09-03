# TICKET-0116 — Update MSIX identity after Store name re-reservation

**Status**

Awaiting verification

**Type**

Bug

**Priority**

Medium

**Created**

2026-09-03

---

## Description

TICKET-0115 wired `build.appx` to the first Store reservation, whose name had
a typo: identity `JensR.AgnetCommandEngine`, Store ID `9N64PL478DHP`. The name
was re-reserved as "Agent Command Engine", which produced a new identity and
Store ID.

---

## Reason

`build.appx.identityName` must exactly match Partner Center > Product identity
or the package won't bind to the product.

| | Old (0115) | New |
| --- | --- | --- |
| Identity/Name | `JensR.AgnetCommandEngine` | `JensR.AgentCommandEngine` |
| Store ID | `9N64PL478DHP` | `9N4TSNZGST6N` |
| Publisher | `CN=7F30662C-…` | unchanged |
| PublisherDisplayName | `JensR` | unchanged |

---

## Implementation Plan

* [x] `build.appx.identityName` / `applicationId` → `…AgentCommandEngine`
* [x] `scripts/build-msix.js` — Store ID `9N64PL478DHP` → `9N4TSNZGST6N`
* [x] Rebuild; confirm the manifest carries the new `Identity Name`
* [ ] Delete the orphaned `9N64PL478DHP` product in Partner Center

---

## Files Modified

- `src/package.json` — `build.appx.identityName`, `applicationId`
- `scripts/build-msix.js` — Store ID in comment and console output

---

## Testing

`node scripts/build-msix.js`; unzip the `.appx` and confirm
`<Identity Name="JensR.AgentCommandEngine" … />`.

---

## Result

`build.appx` matches the "Agent Command Engine" reservation (`9N4TSNZGST6N`).

---

## Notes

The old `9N64PL478DHP` product is now unused — delete it in Partner Center so
there is only one ACE product.

---

## Closed

---
