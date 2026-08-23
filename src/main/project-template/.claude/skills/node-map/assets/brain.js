#!/usr/bin/env node
/*
 * brain.js - deterministic retrieval over a node-map dashboard's data.
 *
 * Scores candidate files against a query using filenames, paths, category
 * labels, and optional curated keywords - no file content is opened, no
 * model call is made. The
 * point is to replace an open-ended Grep/Glob sweep with a ranked shortlist
 * so an agent reads only the file(s) that actually matter.
 *
 * Usage:
 *   node brain.js "<query>" [path/to/node-map.html] [--json] [--top N]
 *
 * Exit codes: 0 if any match found, 1 if no match (caller should fall back
 * to normal search), 2 on usage/read errors.
 */
"use strict";

var fs = require("fs");
var path = require("path");

var STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "do", "does", "for",
  "from", "how", "in", "into", "is", "it", "of", "on", "or", "our", "that",
  "the", "this", "to", "us", "use", "used", "we", "what", "where", "which",
  "who", "why", "with", "you", "your"
]);

function parseArgs(argv) {
  var args = { query: null, file: "docs/node-map.html", json: false, top: 5 };
  var positional = [];
  for (var i = 0; i < argv.length; i++) {
    var a = argv[i];
    if (a === "--json") args.json = true;
    else if (a === "--top") { args.top = parseInt(argv[++i], 10) || 5; }
    else positional.push(a);
  }
  if (positional.length >= 1) args.query = positional[0];
  if (positional.length >= 2) args.file = positional[1];
  return args;
}

function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(function (t) { return t.length > 1 && !STOPWORDS.has(t); });
}

function loadEntries(filePath) {
  var html;
  try {
    html = fs.readFileSync(filePath, "utf8");
  } catch (e) {
    process.stderr.write("brain.js: cannot read " + filePath + " - " + e.message + "\n");
    process.stderr.write("brain.js: generate it first with the node-map skill (/node-map)\n");
    process.exit(2);
  }
  var m = html.match(/<script id="node-map-data" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) {
    process.stderr.write("brain.js: no node-map data block found in " + filePath + "\n");
    process.exit(2);
  }
  var data = JSON.parse(m[1]);
  var entries = [];
  function collect(nodes, cat, label) {
    (nodes || []).forEach(function (f) {
      if (!f.path) return; // skip synthetic "+N more" nodes - nothing to open
      entries.push({
        label: f.label, path: f.path, meta: f.meta || "",
        // Optional extra search terms that are NOT displayed anywhere. Names
        // alone can't answer a conceptual question - nothing in this repo is
        // called "definition-of-done.md" - so a node may carry the terms a
        // person would actually type. Absent on most nodes; scored below.
        keywords: f.keywords || "",
        category: label, categoryId: cat.id
      });
    });
  }
  (data.categories || []).forEach(function (cat) {
    collect(cat.nodes, cat, cat.label);
    // Subcategories (e.g. tickets split by features/bugs/...) hold files too;
    // skipping them would make every ticket invisible to retrieval.
    (cat.subcategories || []).forEach(function (sub) {
      collect(sub.nodes, cat, cat.label + " / " + sub.label);
    });
  });
  return { project: data.project || "", entries: entries };
}

function entryTokens(entry) {
  return {
    label: tokenize(entry.label + " " + path.basename(entry.label, path.extname(entry.label))),
    path: tokenize(entry.path),
    category: tokenize(entry.category),
    keywords: tokenize(entry.keywords)
  };
}

// How many entries a token appears in, across the whole project - used to
// down-weight generic words. In a project called "Flowgrid" whose main
// process is literally an Electron *app*, "app" appears in dozens of
// filenames and carries almost no information about which one you want;
// "duckdb" or "distribution" appear in a handful and are far more telling.
// Without this, an exact match on a common word can outscore a partial
// match on a rare, specific one - which is backwards.
function buildDocFrequency(entries) {
  var df = {};
  entries.forEach(function (e) {
    var seen = new Set(e._tokens.label.concat(
      e._tokens.path, e._tokens.category, e._tokens.keywords));
    seen.forEach(function (t) { df[t] = (df[t] || 0) + 1; });
  });
  return df;
}

function idfWeight(df, n, token) {
  // A token absent from the corpus verbatim (e.g. "set", which only ever
  // appears as part of "setup") is treated as rarer than the rarest token
  // actually present, not as zero - it still deserves a strong weight when
  // it partially matches something.
  var d = df[token] || 0.5;
  return Math.log(1 + n / d);
}

// Exact token matches score full weight. Partial (substring) matches score
// less, and only count when the shorter of the two strings makes up at
// least half the length of the longer one - "set" substring-matching
// "setup" (3/5 = 60%) is a meaningful stem match worth keeping, but "app"
// substring-matching "approval" (3/8 = 37%) is exactly the kind of
// coincidental noise that buried a real result under false positives. (A
// bare length cutoff - "reject anything under 4 chars" - was tried first
// and wrongly rejected "set"→"setup" along with "app"→"approval"; the
// ratio is what actually distinguishes a real stem from a coincidence.)
function fieldScore(tokens, qt) {
  if (tokens.indexOf(qt) !== -1) return 1;
  var partial = tokens.some(function (t) {
    if (t.indexOf(qt) === -1 && qt.indexOf(t) === -1) return false;
    var shorter = Math.min(t.length, qt.length);
    var longer = Math.max(t.length, qt.length);
    return shorter >= 3 && shorter / longer >= 0.5;
  });
  return partial ? 0.7 : 0;
}

function score(entry, queryTokens, df, n) {
  var tk = entry._tokens;
  var s = 0;
  queryTokens.forEach(function (qt) {
    var w = idfWeight(df, n, qt);
    s += fieldScore(tk.label, qt) * 3 * w;
    // Curated keywords outrank an incidental path match but stay below a
    // real filename match, so they surface concept queries without letting a
    // long keyword list bury the file actually named after the thing.
    s += fieldScore(tk.keywords, qt) * 2 * w;
    s += fieldScore(tk.path, qt) * 1 * w;
    s += fieldScore(tk.category, qt) * 1 * w;
  });
  return Math.round(s * 10) / 10;
}

function main() {
  var args = parseArgs(process.argv.slice(2));
  if (!args.query) {
    process.stderr.write("usage: node brain.js \"<query>\" [path/to/node-map.html] [--json] [--top N]\n");
    process.exit(2);
  }

  var loaded = loadEntries(args.file);
  var queryTokens = tokenize(args.query);
  if (!queryTokens.length) {
    process.stderr.write("brain.js: query had no meaningful terms after stripping stopwords\n");
    process.exit(2);
  }

  loaded.entries.forEach(function (e) { e._tokens = entryTokens(e); });
  var df = buildDocFrequency(loaded.entries);
  var n = loaded.entries.length;

  var ranked = loaded.entries
    .map(function (e) { return { entry: e, score: score(e, queryTokens, df, n) }; })
    .filter(function (r) { return r.score > 0; })
    .sort(function (a, b) { return b.score - a.score; })
    .slice(0, args.top);

  var topScore = ranked.length ? ranked[0].score : 0;
  var tiedAtTop = ranked.filter(function (r) { return r.score === topScore; }).length;
  var lowConfidence = ranked.length > 0 && tiedAtTop >= 3;

  if (args.json) {
    process.stdout.write(JSON.stringify({
      lowConfidence: lowConfidence,
      results: ranked.map(function (r) {
        return { path: r.entry.path, score: r.score, category: r.entry.category, meta: r.entry.meta };
      })
    }, null, 2) + "\n");
  } else if (ranked.length === 0) {
    process.stdout.write("brain.js: no candidates matched \"" + args.query + "\" in " + loaded.project + " - fall back to Grep/Glob\n");
  } else {
    process.stdout.write("brain.js: top matches for \"" + args.query + "\" in " + loaded.project + "\n");
    ranked.forEach(function (r, i) {
      process.stdout.write(
        "  " + (i + 1) + ". [" + r.score + "] " + r.entry.path +
        "  (" + r.entry.category + (r.entry.meta ? ", " + r.entry.meta : "") + ")\n"
      );
    });
    if (lowConfidence) {
      process.stderr.write(
        "brain.js: " + tiedAtTop + " results tied at the top score (" + topScore + ") - " +
        "low confidence. A filename match alone doesn't confirm relevance (brain.js has no " +
        "content awareness) - skim the actual top few candidates before trusting one over " +
        "the others, especially if their names are only loosely related to the query.\n"
      );
    }
  }
  process.exit(ranked.length ? 0 : 1);
}

main();
