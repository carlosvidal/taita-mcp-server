# Taita MCP Server

MCP server for the [Taita Blog](https://taita.blog) API. Manage blog posts from Claude Desktop, Claude Code, or any MCP-compatible client.

## Setup

### 1. Get an API Key

Create one from the Taita CMS or via the API:

```bash
curl -X POST https://backend.taita.blog/api/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Claude Agent"}'
```

### 2. Install

```bash
cd taita-mcp-server
npm install
```

### 3. Configure

#### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "taita": {
      "command": "node",
      "args": ["/absolute/path/to/taita-mcp-server/index.js"],
      "env": {
        "TAITA_API_KEY": "tb_live_your_key_here",
        "TAITA_API_URL": "https://backend.taita.blog/api/v1"
      }
    }
  }
}
```

#### Claude Code

Add to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "taita": {
      "command": "node",
      "args": ["/absolute/path/to/taita-mcp-server/index.js"],
      "env": {
        "TAITA_API_KEY": "tb_live_your_key_here",
        "TAITA_API_URL": "https://backend.taita.blog/api/v1"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
| --- | --- |
| `create_post` | Create a new blog post (title, content, category, tags, status) |
| `list_posts` | List posts with optional status filter and pagination |
| `get_post` | Get a single post by slug (includes full content) |
| `update_post` | Update an existing post's title, content, status, tags, etc. |
| `delete_post` | Permanently delete a post by slug |
| `list_categories` | List all blog categories |
| `list_tags` | List all blog tags |

## Example Usage

Once configured, you can ask Claude:

- "Create a blog post about the future of AI in education"
- "List all my published posts"
- "Update the post 'my-first-post' to published status"
- "What categories do I have?"

## Environment Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `TAITA_API_KEY` | Yes | - | Your Taita Blog API key (`tb_live_...`) |
| `TAITA_API_URL` | No | `https://backend.taita.blog/api/v1` | API base URL |

## License

MIT
