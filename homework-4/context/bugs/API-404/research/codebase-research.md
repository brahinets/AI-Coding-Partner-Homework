# Codebase Research — Bug API-404

**Bug**: GET /api/users/:id returns 404 for valid user IDs
**Researcher**: Bug Researcher Agent
**Date**: 2026-03-16

---

## Summary

The `GET /api/users/:id` endpoint consistently returns 404 even when the requested user ID exists in the in-memory database. The root cause is a strict equality comparison between a string (from URL params) and numeric IDs in the users array.

---

## File Analysis

### `src/controllers/userController.js` — Primary Bug Location

**Line 19** — `userId` is assigned from `req.params.id`:
```javascript
const userId = req.params.id;
```
`req.params.id` is always a **string** (e.g., `"123"`), as Express URL parameters are always strings.

**Line 7–11** — The users array contains **numeric** IDs:
```javascript
const users = [
  { id: 123, name: 'Alice Smith', email: 'alice@example.com' },
  { id: 456, name: 'Bob Johnson', email: 'bob@example.com' },
  { id: 789, name: 'Charlie Brown', email: 'charlie@example.com' }
];
```

**Line 23** — The comparison uses strict equality (`===`):
```javascript
const user = users.find(u => u.id === userId);
```

**Root Cause**: `"123" === 123` evaluates to `false` in JavaScript because strict equality does not perform type coercion. The `find` call always returns `undefined`, so the 404 branch is always taken.

The comment on line 21-22 in the source even documents this bug:
```javascript
// BUG: req.params.id returns a string, but users array uses numeric IDs
// Strict equality (===) comparison will always fail: "123" !== 123
```

---

### `src/routes/users.js` — Route Definition

**Line 14** — Route is correctly defined:
```javascript
router.get('/api/users/:id', userController.getUserById);
```
No issue here. The route correctly delegates to `getUserById`.

---

### `server.js` — Entry Point

**Line 16** — Routes are mounted correctly:
```javascript
app.use(userRoutes);
```
No issue here.

---

## Working Endpoint Comparison

`GET /api/users` (line 37–39 in userController.js) works correctly because `getAllUsers` returns the entire array with no filtering:
```javascript
async function getAllUsers(req, res) {
  res.json(users);
}
```

---

## Impact Assessment

- **Severity**: High
- **Affected**: 100% of requests to `GET /api/users/:id`
- **Workaround**: None — the endpoint is completely broken for all IDs

---

## Proposed Fix Direction

Convert `userId` to a number before comparison:
```javascript
const user = users.find(u => u.id === parseInt(userId, 10));
```

Or use loose equality (less preferred):
```javascript
const user = users.find(u => u.id == userId);
```

`parseInt(userId, 10)` is preferred as it is explicit and handles edge cases (e.g., `"123abc"` → `123`).
