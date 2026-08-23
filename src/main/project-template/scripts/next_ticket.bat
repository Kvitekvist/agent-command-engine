@echo off
REM Prints the next free ticket number, checking both local tickets/ and
REM origin/main to avoid the ID-collision class documented in
REM project_memory.md (TICKET-0129/0131, TICKET-0365-0369).
node "%~dp0next_ticket.js" %*
