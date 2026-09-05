# ACE Release Testing Checklist

Run this end to end before signing off on a build. Every row is a discrete
check with an expected result. Mark **P** (pass), **F** (fail + note), or
**N/A** (with reason). A build ships only when every row is P or a justified
N/A.

Scope: the full renderer UI, the native application menu, the agent terminal,
and the packaged artifact. It is a manual pass; the automated suite
(`npm test`) is a precondition, not a substitute.

---

## 0. Preconditions

| # | Check | Expected | Result |
|---|-------|----------|--------|
| 0.1 | `cd src && npm test` | All pass, 0 failed (POSIX-only skips allowed) | |
| 0.2 | `cd src && npm run build` | Completes, no errors | |
| 0.3 | `src/package.json` version and `version.txt` match, and are bumped vs. the last release | Equal, incremented | |
| 0.4 | `CHANGELOG.md` has an entry for this version covering every user-facing change | Present | |
| 0.5 | Clean checkout state understood: note any working-tree changes not part of this release | Documented | |

**Test data used throughout:** one throwaway project folder created via
**✨ New** (call it `qa-scratch`), and one existing folder connected via
**📁 Existing**. The removal test (§3) removes `qa-scratch` — the same project
added in §2.

---

## 1. First launch / setup gate

| # | Check | Expected | Result |
|---|-------|----------|--------|
| 1.1 | Launch with `claude`, `codex`, or `git` missing from PATH | SetupView appears before the main UI | |
| 1.2 | SetupView prerequisite rows | Node/npm, Git, Claude Code CLI, Codex CLI each show correct present/missing state | |
| 1.3 | "Continue to ACE" without "Don't show this again" | Main UI opens; relaunch shows SetupView again | |
| 1.4 | Tick "Don't show this again", Continue, relaunch | SetupView skipped (`prereqs_setup_dismissed=true`) | |
| 1.5 | Launch with all three prereqs present | SetupView never shows | |
| 1.6 | Window icon (taskbar / dock) | ACE logo, not the default Electron icon | |

---

## 2. Making a new project

| # | Check | Expected | Result |
|---|-------|----------|--------|
| 2.1 | Click **+** in the Projects header | Add row appears with **📁 Existing** and **✨ New** | |
| 2.2 | Click **✨ New** | "New project" modal with a name field, autofocused | |
| 2.3 | Confirm with an empty name | Inline error "Please enter a project name"; modal stays open | |
| 2.4 | Enter `qa-scratch`, press Enter (or OK) | Modal closes; native folder picker opens at the default parent dir | |
| 2.5 | Pick a parent folder | Folder `qa-scratch` is created there; project added and selected | |
| 2.6 | Cancel the folder picker instead | No project created, no error dialog | |
| 2.7 | New project scaffold | `.claude/` present with the project template; `.needs-setup` marker written | |
| 2.8 | Launch the first Claude agent in `qa-scratch` | `/project-setup` is auto-typed once; not repeated on the next agent | |
| 2.9 | Click **📁 Existing**, pick an unrelated folder | Project added, named after the folder, selected; no scaffold written | |
| 2.10 | Modal **Cancel** / outside click / the modal **✕** | Modal closes, nothing created | |

---

## 3. Removing a project

Use `qa-scratch` from §2.

| # | Check | Expected | Result |
|---|-------|----------|--------|
| 3.1 | Launch one agent in `qa-scratch`, leave it running | Card visible, terminal live | |
| 3.2 | Hover the `qa-scratch` row in the sidebar | **✕** remove control fades in | |
| 3.3 | Click **✕** | That project's agents are stopped and deleted; project disappears from the list | |
| 3.4 | Other projects' running agents | Untouched — their terminals stay live | |
| 3.5 | If `qa-scratch` was the active project | Active project clears; Files pane shows "Select a project."; AgentView shows the select-a-project state | |
| 3.6 | Re-add the same folder via **📁 Existing** | Adds cleanly as a fresh project (no stale agents) | |
| 3.7 | Switch away from a project with unsaved editor tabs | Confirm dialog "Switching projects will close your open files…"; Cancel keeps you put | |

---

## 4. Files pane — right-click context menu

Right-click a **file** node, then a **folder** node. Confirm the menu contains
exactly these items (dividers where shown) and each fires.

| # | Item | Shown for | Expected action | Result |
|---|------|-----------|-----------------|--------|
| 4.1 | **Open** | files only | Opens in the editor, switches to Editor view | |
| 4.2 | **Open in Explorer** | files + folders | Reveals the item in the OS file manager | |
| 4.3 | **Run** | runnable files only (`.exe/.bat/.cmd/.ps1/.vbs/.com/.msi` on Windows; `.sh/.command/.app` elsewhere) | Executes the file; error alert on failure | |
| 4.4 | *divider* | | | |
| 4.5 | **Copy File Name** / **Copy Folder Name** | label matches node type | Clipboard = the base name | |
| 4.6 | **Copy Full Path** | all | Clipboard = absolute path | |
| 4.7 | **Copy Relative Path** | all | Clipboard = path relative to project root, no leading slash | |
| 4.8 | *divider* | | | |
| 4.9 | **Rename…** | all | Inline prompt; submit renames and refreshes the tree; **Esc** cancels; unchanged name is a no-op | |
| 4.10 | **Delete** | all | Confirm "Move … to the Recycle Bin?"; on OK the item goes to the Recycle Bin/Trash and the tree refreshes | |
| 4.11 | *divider* | | | |
| 4.12 | **Refresh Explorer** | all | Re-reads the tree from disk (note: collapses expanded folders) | |
| 4.13 | Menu dismissal | | Closes on outside click and on **Esc** | |
| 4.14 | Right-click inside the agent terminal | ACE's menu does **not** appear; the terminal's own paste happens instead | |

### 4b. Files pane — tree behaviour

| # | Check | Expected | Result |
|---|-------|----------|--------|
| 4.15 | Expand a folder | Lazy-loads children; ▸ becomes ▾; 📁/📄 icons correct | |
| 4.16 | Expand a large folder (e.g. `node_modules`) | Loads that level only, no whole-tree walk / freeze | |
| 4.17 | Click a binary or very large file | Alert ("looks like a binary file" / "is too large to edit here"), no editor tab | |
| 4.18 | No project selected | "Select a project." placeholder | |
| 4.19 | Empty project folder | "Empty folder." | |

---

## 5. Editor

| # | Check | Expected | Result |
|---|-------|----------|--------|
| 5.1 | Open two+ files | One tab each, active tab highlighted | |
| 5.2 | Edit a file | Dirty dot appears on the tab; "Unsaved" shows in the toolbar | |
| 5.3 | **Save** button / **Ctrl/Cmd+S** | Writes to disk, dirty dot clears; write failure shows an alert | |
| 5.4 | **Save** with no changes | Disabled | |
| 5.5 | Close a dirty tab (**×**) | "Discard unsaved changes?" confirm | |
| 5.6 | **Find** button / **Ctrl/Cmd+F** | Monaco find widget opens | |
| 5.7 | **Replace** button / **Ctrl/Cmd+H** | Monaco find+replace widget opens | |
| 5.8 | Many tabs | Tab strip scrolls horizontally, page does not | |
| 5.9 | Editor loads offline | Monaco renders (vs-dark, no minimap), no CDN fetch | |
| 5.10 | No files open | "No files open. Pick one from Files in the Sidebar." | |
| 5.11 | Switch project | All editor tabs close | |

---

## 6. Agents view — launch bar

| # | Check | Expected | Result |
|---|-------|----------|--------|
| 6.1 | Select a project | Launch bar shows: project name, agent-label input (prefilled), provider toggle, model selector, 🔔/🔇, ▦/▤, **+ New Agent** | |
| 6.2 | Provider toggle **⚖ Auto / 🟣 Claude / 🟢 Codex** | Selection highlights; picking Claude/Codex sets that provider's default model | |
| 6.3 | Auto selected | Model selector replaced by "Provider and compatible model selected at launch" | |
| 6.4 | Model selector | Grouped options; only models enabled in Settings → Models appear | |
| 6.5 | **+ New Agent** with the provider's CLI missing | Inline error pointing to Settings → General → Prerequisites; no card created | |
| 6.6 | **+ New Agent** with CLI present | Card appears, label input regenerates a fresh name; button disabled while "Launching…" | |
| 6.7 | 🔔 / 🔇 toggle | Flips icon and tooltip; writes `notification_sounds_muted`; a `.muted` marker appears/disappears beside the hook files | |
| 6.8 | ▦ / ▤ grid toggle | Switches between two-column and single-wide layout; survives an app restart (`ace:agentGridCols`) | |
| 6.9 | No project selected | "Select a project from the sidebar to get started." with the 📁 glyph | |
| 6.10 | Project with no agents | "No agents running. Launch one above." with the ⚡ glyph | |

---

## 7. Agent card

| # | Check | Expected | Result |
|---|-------|----------|--------|
| 7.1 | Status badge transitions | Connecting → **● Waiting** (yellow) → **● Running** (green) while the agent works → **● Waiting** when idle | |
| 7.2 | Badge on PTY exit / error | **● Done** (blue) on clean exit, **● Error** (red) on spawn failure, **○ Stopped** after Close | |
| 7.3 | Card header | Agent-name pill, session title (once captured), model text, permission icon 🔒 with "Permission: safe" tooltip | |
| 7.4 | Session title capture | First line submitted in the terminal becomes the title; upgrades to an AI-generated title a moment later; a restored agent keeps its existing title | |
| 7.5 | **📸** (running only) | App hides, region drag-select, image saved under `assets/images/screenshots/`, path copied to clipboard, toast "Saved … — path copied" | |
| 7.6 | 📸 cancelled | Toast "Screenshot cancelled", nothing saved | |
| 7.7 | **Close** | Agent stopped and deleted, card removed, PTY process gone | |
| 7.8 | Tab switch away and back (Processes → Agents) | Terminal session survives, no console-window flash, scrollback intact | |
| 7.9 | Project switch away and back | Running agents keep their live session; stopped agents restore as cards without spawning a process | |
| 7.10 | Restart app with a previously running agent | Card restored; a running row gets a fresh terminal session | |

---

## 8. Agent terminal — quick actions

All pills appear once the terminal reaches "ready". Confirm each is present
and fires.

| # | Pill | Expected | Result |
|---|------|----------|--------|
| 8.1 | **🛡️ Auto-approve: Off/On** | Toggles live; when On, a permission prompt already on screen gets auto-confirmed (no relaunch) | |
| 8.2 | **⬆️ Push update** | Types `/push-update` into the terminal | |
| 8.3 | **⬇️ Pull** | Runs `git pull` (no AI); "Pull…" progress bar, then a green success or red error line | |
| 8.4 | **🔨 Build** | Shown only when the project's `package.json` has a `build` target (win/mac) and a `package`/`build` script; runs it, same progress/result strip | |
| 8.5 | 🔨 Build hidden | For a project without that config, no Build pill | |
| 8.6 | **🎯 Calibrate** | Types `/calibrate-enhanced` | |
| 8.7 | **Generate image** | Codex agents only; prompts for a brief, then sends the image-generation prompt | |
| 8.8 | Generate image hidden | Not shown for Claude agents | |
| 8.9 | **🧹 Clear** | Types `/clear` | |
| 8.10 | Error / exited state | Pills hidden; "Failed to start terminal." / "Session ended." line shown | |

### 8b. Terminal core behaviour

| # | Check | Expected | Result |
|---|-------|----------|--------|
| 8.11 | Launch banner | "Launching <name>…" overlay masks CLI boot churn, then reveals the live CLI with its Welcome box intact | |
| 8.12 | Keystrokes | Typing reaches the CLI when the terminal is focused; click anywhere in the terminal refocuses it | |
| 8.13 | Copy | Select text, **Ctrl+C** (Windows/Linux) / **Cmd+C** (macOS) copies it; on macOS **Ctrl+C** still sends SIGINT | |
| 8.14 | Paste | **Ctrl/Cmd+V** and right-click both paste once (no double paste) | |
| 8.15 | Large paste (>8 KB) | Chunked; "Pasting…" strip, then "Pasted N.NKB" | |
| 8.16 | Resize the card / window | Terminal reflows, PTY cols/rows update | |
| 8.17 | PTY host lost | "[terminal process was lost …]" message; stop+relaunch starts a fresh session | |

---

## 9. Processes view

| # | Check | Expected | Result |
|---|-------|----------|--------|
| 9.1 | Open the view | "ACE Internal" table: Process, PID, Memory, CPU % for each ACE process | |
| 9.2 | Auto-refresh | Values update roughly every 3 s | |
| 9.3 | With agents running | "Agent Processes" table: Agent, Model, PID, In tokens, Out tokens | |
| 9.4 | With no agents | "No agents running." | |
| 9.5 | Memory formatting | `< 1024` shows KB, otherwise MB to one decimal; missing values show `—` | |

---

## 10. Token Usage view

| # | Check | Expected | Result |
|---|-------|----------|--------|
| 10.1 | Live usage cards | Claude and Codex cards render with the provider SVG icon, plan label, quota bars, reset countdown | |
| 10.2 | Quota bar | % used matches tokscale; "resets in …" formats as `Nd Nh` / `Nh Nm` / `Nm` | |
| 10.3 | Unlimited / enterprise plan | Card switches to a tokens + cost summary instead of quota bars | |
| 10.4 | Quota fetch failure | "Quota unavailable — <reason>", rest of the card still renders | |
| 10.5 | "Models" and "Today by project" mini-lists | Populate, or show "No usage today." | |
| 10.6 | **↻ Refresh** (Usage) | Re-polls live usage | |
| 10.7 | History summary cards | Total Tokens, Cache Read Tokens, Total Prompts, Cost — all reflect the active project | |
| 10.8 | **↻ Refresh** (History) | Re-reads project history from tokscale | |
| 10.9 | View tabs | **By Day / By Model / By Agent / By Session** each render their chart plus a cost-breakdown table | |
| 10.10 | By Day | Bar chart (input/output) + cost line chart | |
| 10.11 | By Agent | ACE agent names resolve; untracked sessions grouped as "Untracked" | |
| 10.12 | By Session | Titled sessions grouped; untitled as "Untitled" | |
| 10.13 | No project selected | "Select a project to see its history." | |
| 10.14 | Project with no usage | "No recorded usage for this project yet." | |

### 10b. UsageBar (compact strip on the Agents tab)

| # | Check | Expected | Result |
|---|-------|----------|--------|
| 10.15 | Strip renders | One row per provider: icon, name, progress bar, "% used", "resets in …" | |
| 10.16 | Click the provider icon | Toggles between "% used" and "% remaining"; choice persists (`ace-usage-show-tokens`) | |
| 10.17 | No quota data | "no quota data" instead of the bar | |
| 10.18 | Unlimited plan | Shows `<tokens> tokens · $<cost>` | |
| 10.19 | While live usage is loading | Strip is hidden (no flicker of empty bars) | |

---

## 11. Settings view

| # | Check | Expected | Result |
|---|-------|----------|--------|
| 11.1 | Tabs | **General** and **Models**, active tab underlined | |
| 11.2 | Prerequisites — Node.js + npm | Green "✓ Installed" with versions, or "Download Node.js ↗" opening the download page | |
| 11.3 | Prerequisites — Git | "✓ Installed" with version, or "Download Git ↗" | |
| 11.4 | Prerequisites — Claude Code CLI / Codex CLI | "✓ Installed" with version, or an **Install** button (disabled until Node+npm are ready) | |
| 11.5 | Click **Install <CLI>** | "Installing…", progress strip, then success/failure; list rechecks itself | |
| 11.6 | **↻ Recheck** | Re-runs the whole prerequisite check | |
| 11.7 | Both CLIs present | "✓ Ready to launch agents" | |
| 11.8 | **Uninstall CLIs** (Settings only) | Removes the global claude/codex npm packages; Node/npm/Git untouched; list rechecks | |
| 11.9 | Default Provider toggle | Auto/Claude/Codex; Auto shows the routing note; Claude/Codex show the Default Model selector | |
| 11.10 | **Save Settings** | Button flips to "✓ Saved" for ~2 s; `default_provider` / `default_model` persist and become the launch-bar defaults on next open | |
| 11.11 | Models tab | Per provider (🟣 Claude, 🟢 Codex), every catalog model listed with a checkbox, grouped by family | |
| 11.12 | Untick a model, **Save Model Visibility** | "✓ Saved"; that model no longer appears in the launch-bar model selector | |
| 11.13 | Untick every model in a provider | Launch-bar selector falls back to showing all (empty set = no filter) | |

---

## 12. Application menu

| # | Check | Expected | Result |
|---|-------|----------|--------|
| 12.1 | **File → Settings** (macOS: app menu → Settings…) | Switches to the Settings view | |
| 12.2 | **Ctrl/Cmd+,** | Same as 12.1 | |
| 12.3 | **File → Quit** (Win/Linux) / **Close** (mac) | Exits / closes; agent PTYs terminate | |
| 12.4 | **Edit** menu | Standard Undo/Redo/Cut/Copy/Paste/Select All present and working in inputs | |
| 12.5 | **View** menu | Reset Zoom / Zoom In / Zoom Out / Toggle Fullscreen | |
| 12.6 | **View** menu in a packaged build | **No** Reload / Force Reload / Toggle DevTools | |
| 12.7 | **Help → About Agent Command Engine** | Native About panel: name "Agent Command Engine", version = `package.json` version, copyright line, no stray build line | |
| 12.8 | **Help → Report an Issue** | Opens the repo's new-issue page in the browser | |
| 12.9 | **Help → Documentation** | Opens the repo README in the browser | |
| 12.10 | **Window** menu | Minimize / Zoom / (mac) standard items | |

---

## 13. App-wide right-click menu (outside the terminal and the file tree)

| # | Check | Expected | Result |
|---|-------|----------|--------|
| 13.1 | Right-click with text selected | **📋 Copy** enabled; copies the selection | |
| 13.2 | Right-click with nothing selected | **📋 Copy** disabled | |
| 13.3 | Right-click inside an input/textarea | **📥 Paste** present; pastes clipboard text at the cursor | |
| 13.4 | Right-click on non-editable content | No Paste item | |
| 13.5 | **Select all** | Selects the input's contents when in a field, otherwise the main content region | |
| 13.6 | Dismiss | Outside click and **Esc** both close it | |

---

## 14. Icons and glyphs — presence and function

Confirm each renders (no missing-glyph box) **and** its control does what the
label says.

| Area | Glyphs | Result |
|------|--------|--------|
| Sidebar nav | ⚡ Agents · 🔧 Processes · 📊 Token Usage · ⚙️ Settings · 📝 Editor | |
| Sidebar projects | **+** add · ✨ New · 📁 Existing / project rows · ✕ remove | |
| File tree | 📁 folder · 📄 file · ▸ / ▾ expand | |
| App context menu | 📋 Copy · 📥 Paste | |
| Provider toggle | ⚖ Auto · 🟣 Claude · 🟢 Codex | |
| Launch bar | 🔔 / 🔇 sound · ▦ / ▤ grid | |
| Agent card | 📸 screenshot · 🔒 / 🛡️ / ⚡ permission · ○ / ● status dots | |
| Terminal pills | 🛡️ Auto-approve · ⬆️ Push update · ⬇️ Pull · 🔨 Build · 🎯 Calibrate · 🧹 Clear | |
| Usage | `claude.svg` and `codex.svg` on the Token Usage cards and the compact UsageBar | |
| Token Usage refresh | ↻ Refresh (both) | |
| App / OS | window + taskbar/dock icon (`icon.ico` / `icon.icns`) | |

---

## 15. Packaged build

| # | Check | Expected | Result |
|---|-------|----------|--------|
| 15.1 | `cd src && npm run package` (or the release workflow) | Produces the installer/portable artifact with no errors | |
| 15.2 | `node src/scripts/smoke-package.js` (packaging smoke test) | Passes — tokscale runs from the packaged path | |
| 15.3 | Install/run the packaged app on a clean machine or VM | Launches; SetupView drives CLI install; an agent can be launched end to end | |
| 15.4 | Notification sound | On **Stop** / permission **Notification** a sound plays; muting via 🔔/🔇 silences it; bundled `notification.wav` is present in resources | |
| 15.5 | Offline | Editor, fonts, and all assets load with no network | |
| 15.6 | Uninstall | Removes the app cleanly | |

---

## Sign-off

| Field | Value |
|-------|-------|
| Build / version | |
| Platform(s) tested | |
| Tester | |
| Date | |
| Automated suite (`npm test`) | pass / fail |
| Rows failed | (list #s) |
| Ship decision | GO / NO-GO |
