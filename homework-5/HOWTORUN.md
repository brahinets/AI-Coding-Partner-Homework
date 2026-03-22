# How to Run — Custom MCP Server (Homework 5, Task 4)

## Prerequisites

- Python 3.10+
- pip

---

## 1. Install Dependencies

```bash
cd homework-5/custom-mcp-server
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

---

## 2. Run the Server (standalone test)

```bash
.venv/bin/python server.py
```

The server will start and listen for MCP messages via stdio.

---

## 3. Connect via MCP Configuration

Add the following entry to your `.mcp.json` (at the project root or your Claude Code config):

```json
{
  "mcpServers": {
    "lorem-ipsum": {
      "type": "stdio",
      "command": "/absolute/path/to/homework-5/custom-mcp-server/.venv/bin/python",
      "args": ["/absolute/path/to/homework-5/custom-mcp-server/server.py"]
    }
  }
}
```

Replace `/absolute/path/to/` with the actual path on your machine.

---

## 4. Use / Test the `read` Tool

Once connected, ask Claude:

> "Call the `read` tool with word_count=50"

Or read the resource directly:

> "Read the resource lorem-ipsum://50"

**Expected output:** the first 50 words from `lorem-ipsum.md`.

---

## Concepts Explained

| Concept | Description |
|---------|-------------|
| **Resource** | A URI that Claude can read from. Identified by a URI template (`lorem-ipsum://{word_count}`). Returns data passively — Claude pulls content from it. |
| **Tool** | An action Claude can invoke. Appears as a callable function (`read`). Claude decides when and how to call it based on context. |

In this server, the `read` tool and the `lorem-ipsum://` resource both serve the same content — the tool is the primary interface Claude will use, while the resource URI is the underlying data source.
