# Implementation Plan — Bug API-404

**Planned by**: Bug Planner Agent
**Date**: 2026-03-16
**Based on**: `context/bugs/API-404/research/verified-research.md`

---

## Overview

Fix the type mismatch bug in `getUserById` where `req.params.id` (a string) is compared with strict equality against numeric user IDs.

---

## Changes

### Change 1 — Fix type comparison in `getUserById`

**File**: `demo-bug-fix/src/controllers/userController.js`

**Location**: Line 23

**Before**:
```javascript
  const user = users.find(u => u.id === userId);
```

**After**:
```javascript
  const user = users.find(u => u.id === parseInt(userId, 10));
```

**Rationale**: `req.params.id` is always a string. `parseInt(userId, 10)` converts it to a base-10 integer, allowing strict equality with the numeric IDs in the users array. Using `parseInt` with an explicit radix of 10 is safer than loose equality (`==`) because it makes the intent explicit and avoids unexpected coercions.

---

## Test Command

```bash
cd demo-bug-fix && npm test
```

(Jest must be installed. See package.json update below.)

---

## Required Setup

Add Jest to `demo-bug-fix/package.json`:

```json
"scripts": {
  "test": "jest"
},
"devDependencies": {
  "jest": "^29.0.0"
}
```

---

## Verification Steps

1. Start the server: `node demo-bug-fix/server.js`
2. Run: `curl http://localhost:3000/api/users/123`
3. Expected response:
   ```json
   {"id": 123, "name": "Alice Smith", "email": "alice@example.com"}
   ```
4. Run: `curl http://localhost:3000/api/users/999`
5. Expected response (404):
   ```json
   {"error": "User not found"}
   ```
6. Run: `curl http://localhost:3000/api/users`
7. Expected: All three users returned (regression check)

---

## Risk Assessment

- **Risk**: Low
- **Lines changed**: 1
- **Side effects**: None — only affects ID lookup, not the users array or route definitions
- **Regression risk**: Minimal — `getAllUsers` is unchanged
