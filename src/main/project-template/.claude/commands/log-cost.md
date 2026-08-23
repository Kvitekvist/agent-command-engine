# Log Cost — Token Usage Tracking

When `/log-cost` is invoked:

1. **Identify the ticket.** Look at the conversation context for any TICKET-#### references. If multiple tickets were worked on, ask which one to log against. If none found, ask the user for the ticket number.

2. **Get the cost data.** If `$ARGUMENTS` contains pasted `/cost` output, use that. Otherwise ask the user: "Please paste the output of `/cost` so I can record it on the ticket."

3. **Parse the cost data.** Extract from the pasted text:
   - Input tokens (number)
   - Output tokens (number)
   - Cache read tokens (number, may be 0 or absent)
   - Cache write tokens (number, may be 0 or absent)
   - Total cost in USD (dollar amount)

   The `/cost` output typically looks like:
   ```
   Total cost: $X.XX
   Total duration: ...
   Total tokens in: XXX.Xk, out: XX.Xk
     (cache: XX.Xk read, XX.Xk write)
   ```
   Be flexible with the format — extract whatever numeric values are present.

4. **Open the ticket file.** Find it in `tickets/open/` or `tickets/closed/` by the 4-digit number.

5. **Add or append to the `## Token Usage` section.** This section goes between `## Notes` and `## Closed` in the ticket. Use this table format:

   ```
   ## Token Usage

   | Session | Input | Output | Cache Read | Cache Write | Cost |
   |---------|-------|--------|------------|-------------|------|
   | 2026-07-27 | 150,000 | 30,000 | 80,000 | 20,000 | $2.50 |
   | **Total** | | | | | **$2.50** |
   ```

   - Use today's date for the Session column.
   - Format token counts with commas (e.g., 150,000).
   - If the section already exists with prior entries, append a new row and update the Total.
   - If only one session, still include the Total row.

6. **Confirm.** Tell the user what was logged and on which ticket.

Do NOT commit, push, or update any other files. This skill only updates the ticket file.
