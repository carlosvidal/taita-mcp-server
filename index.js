#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Configuration
const API_KEY = process.env.TAITA_API_KEY;
const API_URL = (process.env.TAITA_API_URL || "https://backend.taita.blog/api/v1").replace(/\/$/, "");

if (!API_KEY) {
  console.error("Error: TAITA_API_KEY environment variable is required");
  process.exit(1);
}

// HTTP helper
async function api(method, path, body) {
  const url = `${API_URL}${path}`;
  const options = {
    method,
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || data.error || `API error ${res.status}`);
  }
  return data;
}

// Create MCP server
const server = new McpServer({
  name: "taita-blog",
  version: "1.0.0",
});

// --- Tools ---

server.tool(
  "create_post",
  "Create a new blog post on Taita. Requires title and content (HTML). Optionally set category (by name or slug), tags (auto-created if new), status (draft/published), excerpt, and featured image URL.",
  {
    title: z.string().describe("Post title"),
    content: z.string().describe("Post content in HTML format"),
    excerpt: z.string().optional().describe("Short summary of the post"),
    slug: z.string().optional().describe("URL slug (auto-generated from title if omitted)"),
    category: z.string().optional().describe("Category name or slug"),
    tags: z.array(z.string()).optional().describe("List of tag names (created automatically if new)"),
    status: z.enum(["draft", "published"]).optional().default("draft").describe("Publish status"),
    image: z.string().optional().describe("Featured image URL"),
  },
  async (params) => {
    const result = await api("POST", "/posts", params);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "list_posts",
  "List blog posts. Filter by status (draft/published). Returns paginated results.",
  {
    status: z.enum(["draft", "published"]).optional().describe("Filter by publish status"),
    page: z.number().optional().default(1).describe("Page number"),
    limit: z.number().optional().default(20).describe("Posts per page (max 100)"),
  },
  async (params) => {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    const result = await api("GET", `/posts${qs ? `?${qs}` : ""}`);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "get_post",
  "Get a single blog post by its slug. Returns full content, metadata, category, tags, and author.",
  {
    slug: z.string().describe("The post's URL slug"),
  },
  async ({ slug }) => {
    const result = await api("GET", `/posts/${encodeURIComponent(slug)}`);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "update_post",
  "Update an existing blog post. Identify the post by slug, then provide any fields to update.",
  {
    slug: z.string().describe("The slug of the post to update"),
    title: z.string().optional().describe("New title"),
    content: z.string().optional().describe("New content in HTML format"),
    excerpt: z.string().optional().describe("New excerpt"),
    category: z.string().optional().describe("New category name or slug"),
    tags: z.array(z.string()).optional().describe("New list of tags (replaces existing)"),
    status: z.enum(["draft", "published"]).optional().describe("New publish status"),
    image: z.string().optional().describe("New featured image URL"),
  },
  async ({ slug, ...updates }) => {
    const result = await api("PATCH", `/posts/${encodeURIComponent(slug)}`, updates);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "delete_post",
  "Permanently delete a blog post by its slug.",
  {
    slug: z.string().describe("The slug of the post to delete"),
  },
  async ({ slug }) => {
    const result = await api("DELETE", `/posts/${encodeURIComponent(slug)}`);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "list_categories",
  "List all blog categories with their post counts.",
  {},
  async () => {
    const result = await api("GET", "/categories");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "list_tags",
  "List all blog tags with their post counts.",
  {},
  async () => {
    const result = await api("GET", "/tags");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
