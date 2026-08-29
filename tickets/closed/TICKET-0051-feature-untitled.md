# TICKET-0051: Highlight & Copy Any Text in the ACE UI

**Status**

Closed

**Type**

Enhancement

**Priority**

Medium

**Created**

2026-08-14

---

## Description

The user wants to be able to highlight and copy any text shown in the ACE UI
(audit log rows, token numbers, labels, model names, error messages, etc.).

Investigation findings:

* There is **no** global `user-select: none` — ordinary content text (divs,
  spans, table cells) is already selectable, and Electron's default application
  menu wires `Ctrl+C`, so keyboard copy already works for a plain selection.
* But there is **no right-click "Copy"** anywhere in the React UI — the only
  context menus are the file tree's (TICKET-0033) and the terminal's own
  right-click-paste. Users expect right-click → Copy, so copying feels
  impossible.
* Text inside `<button>`/form controls is non-selectable by the UA stylesheet,
  which reinforces the "can't select anything" impression.

## Reason

"Copy the text I can see" is a baseline expectation for a desktop app. Relying
on `Ctrl+C` alone (with no visible copy affordance) reads as "you can't copy."

---

## Implementation Plan

* [x] Add a global right-click context menu (reusing `ContextMenu.jsx`) wired at
      the app root in `App.jsx`: **Copy** (current selection), **Paste** (in
      editable fields), **Select all**.
* [x] Exclude the agent terminal: `AgentTerminal.jsx`'s existing contextmenu
      handler `stopPropagation()`s so the terminal keeps its own paste + `Ctrl+C`
      copy behaviour and the app menu doesn't double-fire over it.
* [x] CSS safety net in `globals.css` so app content is explicitly selectable
      (without overriding the intentional `select-none` spots).

---

## Files Modified

* `src/renderer/App.jsx`
* `src/renderer/components/AgentTerminal.jsx`
* `src/renderer/styles/globals.css`

---

## Testing

* [x] `npm run build` clean
* [x] `npm test` passes (13/13)
* [ ] Live: highlight text in a view, right-click → Copy, paste elsewhere
* [ ] Live: right-click an input → Paste works
* [ ] Live: terminal right-click still pastes (menu doesn't hijack it)

---

## Result

Implemented. `App.jsx` now renders a global right-click context menu (reusing
`ContextMenu.jsx`) via an `onContextMenu` handler on the root element:
**📋 Copy** (disabled when there's no selection; writes `window.getSelection()`
to the clipboard), **📥 Paste** (only for editable targets; reads the clipboard
and `execCommand('insertText')` into the focused field), and **Select all**
(selects the focused input's contents, or all text in `<main>` otherwise so it
can then be copied). `AgentTerminal.jsx`'s contextmenu handler now
`stopPropagation()`s so the terminal keeps its own copy (Ctrl+C) / paste
(right-click, Ctrl+V) and the app menu doesn't fire over it. `globals.css` states
`user-select: text` on `body` as a safety net (base layer, so the intentional
`select-none` utilities still win). Diagnosis confirmed there was never a global
`user-select: none` — plain content text was already selectable and Electron's
default menu already wired Ctrl+C; the real gap was the missing discoverable
right-click Copy. Build clean, tests 13/13. Live verification still open.

---

## Notes

Implemented in the renderer (not a main-process `Menu`) so the terminal can be
cleanly excluded via DOM `stopPropagation()` — a main-process `context-menu`
handler fires regardless of the renderer's `preventDefault`, which would collide
with the terminal's right-click-paste. Reuses the existing `ContextMenu.jsx`.

---

## Closed

2026-08-29
