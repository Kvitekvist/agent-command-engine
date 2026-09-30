# TICKET-0167: Prevent stale memory-editor reads

**Status**

Awaiting verification

**Type**

Bug

**Priority**

High

**Created**

2026-09-29

---

## Description

Ensure the memory editor only displays and saves the latest selected file for the active project, and protects unsaved edits when navigating.

## Reason

MemoriesPanel.openFile applies asynchronous read results without checking whether a newer request or project change superseded them. Project changes refresh the list without resetting the selected file and buffer.

## Implementation Plan

* [x] Reject superseded read results and invalidate pending reads on project changes and unmount.

* [x] Reset or safely scope selection, buffer and expected disk content to the project and file being edited.

* [x] Preserve unsaved changes through cancellation and failed saves; ensure project/view navigation cannot silently discard the memory buffer.

* [x] Show read failures and prevent saves from targeting a stale project or file while a selection is loading.

* [x] Add a controlled delayed-read regression covering reversed response order and a project switch; reuse the existing conflict-aware writer.

## Files Modified

- `src/renderer/components/MemoriesPanel.jsx`: a `generation` ref bumps on every open, project change and unmount; a read or save only applies if nothing superseded it. A project change clears the selection, buffer and saved copy. While a file is opening the textarea and Save are disabled and "Opening <file>…" shows. The dirty flag is published to the store.
- `src/renderer/store/useStore.js`: `panelDirty` / `setPanelDirty`.
- `src/renderer/App.jsx`: app-menu navigation asks "Discard unsaved changes?" while `panelDirty` is set. Sidebar and project clicks are already blocked by the modal; this was the one path that could unmount the panel silently.
- `src/scripts/smoke-renderer.js`, `src/scripts/smoke-renderer-preload.js`: controllable memory reads and a reversed-response check.

## Testing

- Renderer smoke: open `a.md`, open `b.md`, answer B then A; the editor stays on B (`Edit b.md`). With the generation check removed the same step fails at the `memory B` assertion.
- The full renderer smoke passes once its nav steps follow the intended Sidebar change (TICKET-0169).
- Saves still go through FileService's conflict-aware writer with the last-read text as `expectedContent`.
- `npm test`: 144 tests, 143 pass, 0 fail. `npm run build` passes.
- Not covered automatically: project switch mid-read (the modal blocks it in the UI), menu navigation with a dirty buffer, window close. Window close still only guards editor tabs.

## Result

Implemented and committed together with TICKET-0169 (the Memories panel this fixes). Needs a manual check of menu navigation with unsaved edits.

## Notes

MemoriesPanel is currently an untracked working-tree file. Preserve existing work. Coordinate navigation protection with existing editor-close behavior rather than adding a second global mechanism.

## Closed

Pending.

