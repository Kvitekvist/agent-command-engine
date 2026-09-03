# Agent Command Engine — Privacy Policy

_Last updated: 2026-09-03_

Agent Command Engine ("ACE", "the app") is a desktop application for managing
Claude Code and OpenAI Codex agent sessions across local projects. This policy
describes what the app does with your data.

## Summary

ACE runs entirely on your computer. It has no servers, no accounts, and no
analytics or telemetry. It does not send your data anywhere.

## What the app stores, and where

All of it stays on your machine:

- **Local application data** — the list of projects you add, per-agent names
  and session titles, permission-mode choices, and token-usage figures read
  from the `tokscale` tool. Held in a SQLite database in the app's per-user
  data folder (`%APPDATA%\agent-command-engine` on Windows).
- **Files in your projects** — ACE reads and writes files only inside the
  project directories you register, and only when you tell it to (opening a
  file in the editor, running a build, saving a screenshot). Screenshots are
  written into the relevant project folder.
- **Agent hook state** — small status files the app writes to its per-user
  data folder to drive the Running/Waiting badges.

You can delete all of it by removing the app's per-user data folder and any
screenshots it saved into your projects.

## What the app sends

Nothing. ACE makes no network requests of its own.

## Third-party tools it launches

ACE starts the **Claude Code** and **OpenAI Codex** command-line tools as
separate processes on your machine. Those tools talk to their providers'
services and are governed by their own terms and privacy policies:

- Anthropic (Claude Code): https://www.anthropic.com/legal/privacy
- OpenAI (Codex): https://openai.com/policies/privacy-policy

ACE does not add to, intercept, or forward what those tools send. Any API keys
or credentials they use are managed by those tools, not by ACE.

## Children

The app is a developer tool and is not directed to children under 13.

## Changes

Updates to this policy will change the "Last updated" date above and be
published at the same URL.

## Contact

kvitekvist@gmail.com
