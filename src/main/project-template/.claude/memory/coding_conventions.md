# Coding Conventions

This document defines the coding standards for the project.

Claude should follow these conventions unless the user explicitly requests otherwise.

---

# General Principles

* Prioritize readability over cleverness.
* Keep code simple.
* Avoid unnecessary abstractions.
* Minimize duplication.
* Refactor before copying code.
* Remove dead code when encountered.
* Keep the codebase consistent.

---

# Naming Conventions

## Files

Use descriptive names.

Examples:

```
inventory_manager.py
settings_window.cpp
player_controller.cs
```

Avoid:

```
temp.py
test2.cs
newfile.cpp
```

---

## Variables

Use meaningful names.

Good:

```
playerHealth
inventoryItems
connectionTimeout
```

Avoid:

```
a
temp
value1
```

---

## Functions

Function names should describe what they do.

Examples:

```
LoadConfiguration()

CreatePlayer()

SaveProject()

GenerateReport()
```

Avoid generic names such as:

```
DoStuff()

Process()

Run()

Execute()
```

---

## Classes

Use PascalCase.

Examples:

```
InventoryManager

SettingsWindow

DatabaseConnection
```

---

## Constants

Use ALL_CAPS where appropriate.

Example

```
MAX_RETRIES

DEFAULT_TIMEOUT

APP_VERSION
```

---

# Function Design

Functions should:

* Have one responsibility.
* Be reasonably short.
* Return early when possible.
* Avoid deeply nested logic.
* Be easy to test.

---

# Comments

Comment **why**, not **what**.

Good:

```
// Prevent duplicate saves because autosave may still be running.
```

Avoid:

```
// Increment i
i++;
```

---

# Error Handling

* Fail gracefully.
* Log meaningful errors.
* Never silently ignore exceptions.
* Provide useful error messages.

---

# Logging

Log important events only.

Examples:

* Startup
* Shutdown
* Errors
* Warnings
* Important state changes

Avoid excessive debug logging unless requested.

---

# Folder Organization

Keep related files together.

Separate:

* UI
* Business logic
* Data
* Utilities
* Tests

---

# Imports

* Remove unused imports.
* Group standard libraries before third-party libraries.
* Keep imports organized.

---

# Testing

Whenever practical:

* Test new functionality.
* Test bug fixes.
* Verify no regressions.

---

# Refactoring

Refactor when:

* Duplicate logic appears.
* Code becomes difficult to understand.
* Large functions emerge.
* Responsibilities become unclear.

Do not refactor unrelated code during feature development unless it directly improves the requested work.

---

# Documentation

Whenever behavior changes:

Update the relevant documentation.

---

# AI Expectations

Claude should strive to leave the codebase in a cleaner, more maintainable state after every completed task.
