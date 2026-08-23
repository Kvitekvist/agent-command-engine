# Ticket Decomposition Workflow

## When to Decompose

Decompose a large request into multiple tickets when:

* The request involves **3+ distinct features** or components
* The work spans **multiple architectural layers** (UI + backend + database)
* The request would take **5+ commits** to complete properly
* There are **clear dependency relationships** between parts
* The work could fail at different stages requiring **independent rollback**
* Parts could be **completed and tested independently**

## When NOT to Decompose

Keep as a single ticket when:

* The request is a single cohesive feature (even if large)
* All parts are tightly coupled and must be deployed together
* Decomposition would create artificial boundaries
* The user explicitly requests atomic implementation

---

## Decomposition Process

### Step 1: Analyze the Request

Read the user's request and identify:

* **Logical boundaries** - What are the natural divisions?
* **Dependencies** - What must be done before what?
* **Risk areas** - What could fail independently?
* **Testing boundaries** - What can be verified separately?

### Step 2: Propose Decomposition

Present to the user:

```
I recommend breaking this into [N] tickets:

TICKET-XXXX (Parent): [Overall goal]
├─ TICKET-YYYY: [Component 1] (no dependencies)
├─ TICKET-ZZZZ: [Component 2] (depends on TICKET-YYYY)
└─ TICKET-AAAA: [Component 3] (depends on TICKET-YYYY, TICKET-ZZZZ)

This allows us to:
- [Benefit 1]
- [Benefit 2]
- [Benefit 3]

Proceed with this breakdown?
```

### Step 3: Create Parent Ticket

If user approves, create the parent ticket:

* **Type**: Feature (usually)
* **Description**: The full user request
* **Child Tickets**: List all child ticket IDs
* **Implementation Plan**: High-level overview
* Keep parent ticket **open** until all children are closed

### Step 4: Create Child Tickets

For each component:

* **Parent Ticket**: Reference the parent
* **Dependencies**: List tickets that must complete first
* **Description**: Specific scope for this child
* **Implementation Plan**: Detailed steps for this component only
* **Testing**: How to verify this component in isolation

### Step 5: Execute in Order

* Work on tickets respecting dependencies
* Complete tickets with no dependencies first
* Mark each child as **Closed** when done
* Update parent ticket's progress
* Only close parent when all children are closed

---

## Dependency Rules

* **Blocked by**: This ticket cannot start until listed tickets are closed
* **Blocks**: Listed tickets cannot start until this one is closed
* Check dependencies before starting any ticket
* Never start a ticket with open dependencies

---

## Commit Strategy

Each child ticket gets:

* **One or more commits** with `[TICKET-####]` prefix
* Independent git commits (allows cherry-picking if needed)
* Separate push after each ticket closes (or batch if user prefers)

---

## Example Decomposition

**User Request**: "Add user authentication system with login, registration, password reset, and email verification"

**Analysis**:
- 4 distinct features
- Dependencies: registration → email verification, login → password reset
- Can be tested independently
- Different risk profiles

**Proposed Breakdown**:

```
TICKET-0100 (Parent): User Authentication System
├─ TICKET-0101: User registration with basic validation
├─ TICKET-0102: Email verification system (depends on TICKET-0101)
├─ TICKET-0103: User login with session management (depends on TICKET-0101)
└─ TICKET-0104: Password reset functionality (depends on TICKET-0103)
```

**Execution Order**:
1. TICKET-0101 (no deps)
2. TICKET-0102, TICKET-0103 (parallel, both depend on 0101)
3. TICKET-0104 (depends on 0103)
4. Close TICKET-0100 when all children closed

---

## Updating Parent Tickets

As child tickets complete, update the parent:

**Implementation Plan**:
```
* [x] TICKET-0101: User registration
* [x] TICKET-0102: Email verification
* [ ] TICKET-0103: User login
* [ ] TICKET-0104: Password reset
```

**Notes**:
```
Progress: 2/4 child tickets complete
Blockers: None
Next: TICKET-0103 ready to start
```

---

## Communication

Always inform the user:

* "Creating parent ticket TICKET-XXXX with [N] children"
* "Starting TICKET-YYYY ([1/N]): [description]"
* "Completed TICKET-YYYY ([1/N]), moving to TICKET-ZZZZ ([2/N])"
* "All child tickets complete, closing parent TICKET-XXXX"

---

## Remember

* Decomposition serves **maintainability**, not bureaucracy
* If in doubt about decomposing, **ask the user**
* Keep tickets **focused** - better to have 5 clear tickets than 2 vague ones
* **Dependencies matter** - respect the order
* Each ticket should be **independently testable**
