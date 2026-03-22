# Homework 5: MCP Servers

**Author:** Yaroslav Brahinets

## Overview

This homework covers installing and configuring MCP (Model Context Protocol) servers to extend Claude's capabilities with external tools and data sources.

## Tasks Completed

| Task | Description | Status | Screenshot |
|------|-------------|--------|------------|
| Task 1 | GitHub MCP — list pull requests | ✅ Done | `docs/screenshots/github mcp.png` |
| Task 2 | Filesystem MCP — directory summary | ✅ Done | `docs/screenshots/file system mcp.png` |
| Task 3 | Jira MCP — fetch project tickets (project `KAN`) | ✅ Done | `docs/screenshots/atlassian mcp.png` |
| Task 4 | Custom MCP Server with FastMCP | ✅ Done | `docs/screenshots/custom mcp.png` |

## Task 4: Custom MCP Server

Built a custom MCP server using [FastMCP](https://github.com/jlowin/fastmcp) that exposes:

- **Resource** `lorem-ipsum://{word_count}` — reads exactly `word_count` words from `lorem-ipsum.md`
- **Tool** `read(word_count=30)` — Claude-callable action that returns the word-limited content

### Key Concepts

**Resources** are URIs that Claude can read from. They represent data sources (files, APIs, databases) and are identified by a URI template. Claude pulls content from them passively.

**Tools** are actions Claude can invoke. They appear as callable functions in Claude's tool list and allow Claude to perform operations on demand.

### Project Structure

```
homework-5/
├── README.md
├── HOWTORUN.md
├── TASKS.md
├── custom-mcp-server/
│   ├── server.py
│   ├── lorem-ipsum.md
│   └── requirements.txt
└── docs/
    └── screenshots/
        ├── github mcp.png
        ├── file system mcp.png
        ├── atlassian mcp.png
        └── custom mcp.png
```

## How to Run

See [HOWTORUN.md](./HOWTORUN.md) for full setup and usage instructions.
