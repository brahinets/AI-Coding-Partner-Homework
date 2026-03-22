# Research Notes — Agent 2 Context7 Queries

> Note: context7 MCP is configured in `.mcp.json` (`@upstash/context7-mcp@latest`).
> Queries were performed against the context7 knowledge base.

## Query 1: decimal arithmetic for Node.js

- Search: `"decimal.js"`
- context7 library ID: `/mikemcl/decimal.js`
- Applied: Instantiate with string input to avoid IEEE-754 float imprecision: `new Decimal(message.data.amount)`. Use `.gt()`, `.isNaN()`, `.isPositive()` for validation. All comparisons use Decimal objects (e.g. `amt.gt(new Decimal('10000'))`). Never call `.toNumber()` for storage — keep as `.toString()` in JSON output.

```js
const Decimal = require('decimal.js');
const amt = new Decimal(message.data.amount); // always from string
if (amt.lte(new Decimal('0'))) reject('INVALID_AMOUNT');
if (amt.gt(new Decimal('10000'))) score += 3;
if (amt.gt(new Decimal('50000'))) score += 4;
```

## Query 2: Node.js async file I/O

- Search: `"Node.js fs promises"`
- context7 library ID: `/nodejs/node` (built-in `fs/promises`)
- Applied: Use `require('fs').promises` (CommonJS-compatible) for all file operations. `readFile(path, 'utf8')` + `JSON.parse()` for reading; `writeFile(path, JSON.stringify(obj, null, 2), 'utf8')` for writing. Use `readdir()` to enumerate result files in the reporting agent.

```js
const fs = require('fs');
// Read
const raw = await fs.promises.readFile(filePath, 'utf8');
const msg = JSON.parse(raw);
// Write
await fs.promises.writeFile(outPath, JSON.stringify(msg, null, 2), 'utf8');
// List
const files = await fs.promises.readdir(dir);
```
