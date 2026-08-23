/*
 * Regenerates docs/node-map.html - the second brain that `brain.js` queries.
 *
 *   node scripts/build-node-map.js
 *
 * The generic `node-map` skill has the agent scan the project live each run.
 * ACE uses this committed script instead, for three reasons: the curated
 * KEYWORDS map below would be lost on every regeneration otherwise, ticket
 * nodes need their description folded into the label (see ticketNodes), and a
 * 179-node repo is cheaper and more reliable to scan deterministically than
 * by hand. Keep it in sync with .claude/skills/node-map/SKILL.md.
 */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const EXCLUDE_NAMES = new Set([".gitkeep", ".env", "node-map.html"]);
const EXCLUDE_DIRS = new Set([".git","node_modules",".venv","__pycache__","dist","build",".vs",".vscode","releases","project-template"]);

function human(bytes){
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + " KB";
  return (bytes/1024/1024).toFixed(1) + " MB";
}
function ago(mtime){
  const d = Math.floor((Date.now() - mtime) / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "1d ago";
  if (d < 30) return d + "d ago";
  return Math.floor(d/30) + "mo ago";
}
function walk(dir, out, depth){
  let ents;
  try { ents = fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }); } catch(e){ return out; }
  for (const e of ents){
    const rel = dir + "/" + e.name;
    if (e.isDirectory()){
      if (EXCLUDE_DIRS.has(e.name)) continue;
      if (depth > 0) walk(rel, out, depth - 1);
    } else {
      if (EXCLUDE_NAMES.has(e.name)) continue;
      if (e.name.endsWith(".map") || e.name.endsWith(".ico") || e.name.endsWith(".icns")) continue;
      out.push(rel);
    }
  }
  return out;
}
// Curated search terms for files whose name doesn't say what they answer.
// Not displayed - only fed to brain.js scoring.
const KEYWORDS = {
  "AGENTS.md": "agent guide entry point routing rules commit message format definition of done ticket workflow branch strategy validation retrieval protocol second brain onboarding start here codex provider neutral",
  ".claude/CLAUDE.md": "claude specific instructions skills node map regenerate pointer",
  "docs/agents/current-state.md": "version priorities status snapshot constraints milestone active work",
  "docs/agents/architecture-guide.md": "boundaries data flow trust boundary ipc contract process model navigation structure",
  "docs/agents/conventions.md": "coding style rules commonjs esm testing conventions context isolation spawn arguments patterns",
  "tickets/TEMPLATE.md": "new ticket scaffold status vocabulary fields",
  "CHANGELOG.md": "release history versions changes shipped",
  "README.md": "overview install usage getting started features",
  "src/main/preload.js": "bridge context isolation exposed api window ace renderer boundary",
  "scripts/run_tests.sh": "run tests ci test suite verification checks",
  "src/tests/helpers/electron-stub.js": "test stub mock electron",
  ".claude/memory/ticket_memory.md": "history historical ticket log past work search only",
  ".claude/memory/architecture.md": "historical implementation notes troubleshooting feature history",
  ".claude/memory/MEMORY.md": "memory index historical superseded",
  "docs/ICONS.md": "icons app icon assets branding keyboard visual",
  ".claude/skills/build-node-map/SKILL.md": "rebuild refresh regenerate second brain node map dashboard staleness keywords generator",
  ".claude/skills/node-map/SKILL.md": "second brain retrieval protocol dashboard engine template scoring brain",
  "scripts/build-node-map.js": "generator node map data categories keywords ticket labels"
};
function node(rel, label){
  const st = fs.statSync(path.join(ROOT, rel));
  const n = { label: label || path.basename(rel), meta: human(st.size) + " · " + ago(st.mtimeMs), path: rel };
  if (KEYWORDS[rel]) n.keywords = KEYWORDS[rel];
  return n;
}
// Ticket labels enriched from the ticket's Description so brain.js can match on topic.
function ticketNodes(dir){
  return fs.readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith(".md")).map(f => {
    const id = path.basename(f, ".md");
    const text = fs.readFileSync(path.join(ROOT, dir, f), "utf8");
    const m = text.match(/##\s*Description\s*\n+([\s\S]*?)(?:\n\s*\n|\n##)/);
    let desc = m ? m[1].replace(/\s+/g, " ").trim() : "";
    desc = desc.split(/(?<=\.)\s/)[0].replace(/\.$/, "");
    if (desc.length > 62) desc = desc.slice(0, 62).replace(/\s+\S*$/, "");
    return node(dir + "/" + f, desc ? id + " " + desc.toLowerCase() : id);
  });
}
function skillNodes(){
  const base = ".claude/skills";
  let dirs; try { dirs = fs.readdirSync(path.join(ROOT, base), { withFileTypes: true }); } catch(e){ return []; }
  return dirs.filter(d => d.isDirectory()).map(d => node(base + "/" + d.name + "/SKILL.md", d.name));
}

const cats = [
  { id: "routing", label: "Agent Routing", files: ["AGENTS.md", ".claude/CLAUDE.md", ...walk("docs/agents", [], 0)] },
  { id: "memory",  label: "Memory",        files: walk(".claude/memory", [], 0) },
  { id: "tickets-open",   label: "Tickets Open",   nodes: ticketNodes("tickets/open") },
  { id: "tickets-closed", label: "Tickets Closed", nodes: ticketNodes("tickets/closed") },
  { id: "main",     label: "Main Process", files: walk("src/main", [], 3) },
  { id: "renderer", label: "Renderer",     files: walk("src/renderer", [], 3) },
  { id: "tests",    label: "Tests",        files: walk("src/tests", [], 2) },
  { id: "scripts",  label: "Scripts",      files: walk("scripts", [], 1) },
  { id: "docs",     label: "Docs",         files: ["README.md", "CHANGELOG.md", ...walk("docs", [], 0)] },
  { id: "skills",   label: "Skills",       nodes: skillNodes() },
  { id: "prompts",  label: "Prompts & Templates", files: [...walk(".claude/prompts", [], 0), ...walk(".claude/templates", [], 0), "tickets/TEMPLATE.md", ".claude/PROJECT_RULES.md", ".claude/project_config.md", ".claude/PROJECT_SKELETON.md", ".claude/framework_version.md"] }
];

const categories = cats.map(c => ({
  id: c.id, label: c.label,
  nodes: c.nodes || c.files.filter(f => fs.existsSync(path.join(ROOT, f))).map(f => node(f))
})).filter(c => c.nodes.length > 0);

const data = {
  project: "Agent Command Engine (ACE)",
  generated: new Date().toISOString(),
  center: { label: "AGENTS.md", sublabel: "ACE project brain" },
  categories
};
const json = JSON.stringify(data, null, 2).replace(/<\/script>/g, "<\/script>");
const tpl = fs.readFileSync(path.join(ROOT, ".claude/skills/node-map/assets/template.html"), "utf8");
const re = /(<script id="node-map-data" type="application\/json">)[\s\S]*?(<\/script>)/;
if (!re.test(tpl)) { console.error("data block not found"); process.exit(1); }
fs.mkdirSync(path.join(ROOT, "docs"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "docs/node-map.html"), tpl.replace(re, "$1\n" + json + "\n$2"), "utf8");
console.log("categories: " + categories.length + ", nodes: " + categories.reduce((a,c)=>a+c.nodes.length,0));
categories.forEach(c => console.log("  " + c.label + ": " + c.nodes.length));
