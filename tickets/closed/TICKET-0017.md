# TICKET-0017

**Status**

Open

**Type**

Bug

**Priority**

Medium

**Created**

2026-07-24

---

## Description

`DBService.init()` located the sql.js WASM binary by joining `__dirname`
with a relative `node_modules/sql.js/...` path. `DBService.js` is copied
from `src/main/services` to `dist/main/services` during a build (see
`scripts/build-main.js`), so deriving the package location from
`__dirname` at runtime incorrectly targets `dist/node_modules` (which
doesn't exist) instead of the real `node_modules` — breaking database
init in a built/packaged app.

---

## Reason

Path-derivation-from-`__dirname` silently breaks the moment a file is
copied somewhere else at build time. `require.resolve('sql.js/...')` asks
Node's own module resolver instead, so it keeps working after the copy and
inside a packaged Electron app.

---

## Implementation Plan

* [x] Replace the `__dirname`-relative path in `DBService.init()` with
      `require.resolve('sql.js/dist/sql-wasm.js')`

---

## Files Modified

- src/main/services/DBService.js

---

## Testing

`npm run build` (production build) and `npm test` (existing automated
suite) both pass.

---

## Result

Fixed. This was found as an uncommitted local fix already present in the
working tree when this session started; formalized under this ticket
since no ticket previously documented it.

---

## Notes

Found already applied, uncommitted, in the working tree — not written new
in this session.

---

## Closed

2026-07-24
