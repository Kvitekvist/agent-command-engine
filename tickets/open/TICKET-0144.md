# TICKET-0144: Readable secondary text and controls

**Status**

Open

**Type**

Bug / Feature

**Priority**

High

**Created**

2026-09-13

## Description

AUDIT-37, from the ACE audit of 2026-09-13.

## Implementation Plan

Increase dark-theme contrast, keyboard focus visibility and compact control hit areas.

## Files Modified

tailwind.config.js; renderer/styles/globals.css; renderer/views/TokenView.jsx; renderer/components/NotesPanel.jsx.

## Testing

Muted contrast is 7.81:1 on surface, 6.96:1 on panel and 5.66:1 on border. Reviewed 100% UI and 200% compact Notes captures. Production build passes. Remaining: live long-card/disabled-control layout review.

## Result

Muted text is #a1a7b3, chart labels at least 12px, visible focus outlines and larger button targets retain the dark theme.

## Closed

Pending.
