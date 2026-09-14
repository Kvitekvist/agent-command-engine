# Project Notes

`.ace/notes.txt` is UTF-8 JSON Lines. Each physical line is one object:

```json
{"id":"unique-stable-id","timestamp":"2026-09-14T04:00:00.000Z","text":"First line\n---\nSecond line"}
```

Use a fresh UUID for each entry. Escape body newlines through `JSON.stringify`;
do not put raw multiline JSON in the file. LF and CRLF line separators work.
Keep existing IDs when editing, and do not duplicate them. Append a newline
after each object. Agents can append these records without calling ACE.

ACE reads the older timestamp/body/separator format and migrates it on the next
successful mutation. It only treats a legacy horizontal rule followed by an
ISO timestamp as an entry boundary. Old bodies containing that exact pattern
are inherently ambiguous; inspect those files before migration. JSON Lines has
no such delimiter ambiguity and preserves Markdown, code blocks and Unicode.

Main re-reads before each mutation. Editing/deleting requires the selected
entry's ID and previous body; unrelated entries survive. Invalid or unreadable
files are errors, not empty notes. A failed write keeps the draft. Safe replacement
also rechecks disk content immediately before rename, but external writers do
not participate in an OS-wide transaction: a concurrent write in that final
check/rename interval remains a limitation. Avoid simultaneous in-place writes;
retry after a reported conflict.

Project Notes works without agents. Insertion into an agent is a paste, not a
submitted turn, and is refused until the terminal enables bracketed paste.
