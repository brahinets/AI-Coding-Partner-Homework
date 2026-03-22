"""
Custom MCP Server — Homework 5, Task 4
Built with FastMCP.

Concepts:
- Resources are URIs that Claude can read from (e.g., files, APIs).
  They are identified by a URI and can accept parameters via URI templates.
- Tools are actions Claude can call to perform operations (e.g., reading a file,
  running a command). They appear as callable functions in Claude's tool list.
"""

from pathlib import Path

from fastmcp import FastMCP

mcp = FastMCP("yaroslav-custom-mcp")

LOREM_IPSUM_PATH = Path(__file__).parent / "lorem-ipsum.md"


def _read_words(word_count: int) -> str:
    """Read exactly `word_count` words from lorem-ipsum.md."""
    text = LOREM_IPSUM_PATH.read_text(encoding="utf-8")
    # Strip markdown heading lines (starting with #) and flatten to words
    words = [
        word
        for line in text.splitlines()
        if not line.strip().startswith("#")
        for word in line.split()
    ]
    return " ".join(words[:word_count])


@mcp.resource("lorem-ipsum://{word_count}")
def lorem_ipsum_resource(word_count: int = 30) -> str:
    """
    Resource URI: lorem-ipsum://{word_count}

    Returns exactly `word_count` words from lorem-ipsum.md.
    Default word_count is 30.

    Example URIs:
      lorem-ipsum://30   → first 30 words
      lorem-ipsum://100  → first 100 words
    """
    return _read_words(word_count)


@mcp.tool()
def read(word_count: int = 30) -> str:
    """
    Read content from the lorem-ipsum resource.

    Args:
        word_count: Number of words to return (default: 30).

    Returns:
        A string containing exactly `word_count` words from lorem-ipsum.md.
    """
    return _read_words(word_count)


if __name__ == "__main__":
    mcp.run()