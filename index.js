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
async function api(method, path, body, blog) {
  const url = `${API_URL}${path}`;
  const headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  if (blog) headers["X-Blog"] = blog;

  const options = { method, headers };
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
  version: "1.2.0",
});

// --- Tools ---

server.tool(
  "list_blogs",
  "List all blogs accessible with this API key. Use this first to see which blogs you can manage.",
  {},
  async () => {
    const result = await api("GET", "/blogs");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "create_post",
  "Create a new blog post. Requires title and content (HTML). If the API key has access to multiple blogs, specify the blog subdomain.",
  {
    title: z.string().describe("Post title"),
    content: z.string().describe("Post content in HTML format"),
    blog: z.string().optional().describe("Blog subdomain (required if API key has access to multiple blogs)"),
    excerpt: z.string().optional().describe("Short summary of the post"),
    slug: z.string().optional().describe("URL slug (auto-generated from title if omitted)"),
    category: z.string().optional().describe("Category name or slug"),
    tags: z.array(z.string()).optional().describe("List of tag names (created automatically if new)"),
    status: z.enum(["draft", "published"]).optional().default("draft").describe("Publish status"),
    image: z.string().optional().describe("Featured image URL"),
  },
  async ({ blog, ...params }) => {
    const result = await api("POST", "/posts", params, blog);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "list_posts",
  "List blog posts. Filter by status (draft/published). Returns paginated results.",
  {
    blog: z.string().optional().describe("Blog subdomain (required if API key has access to multiple blogs)"),
    status: z.enum(["draft", "published"]).optional().describe("Filter by publish status"),
    page: z.number().optional().default(1).describe("Page number"),
    limit: z.number().optional().default(20).describe("Posts per page (max 100)"),
  },
  async ({ blog, ...params }) => {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    const result = await api("GET", `/posts${qs ? `?${qs}` : ""}`, null, blog);
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
    blog: z.string().optional().describe("Blog subdomain"),
  },
  async ({ slug, blog }) => {
    const result = await api("GET", `/posts/${encodeURIComponent(slug)}`, null, blog);
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
    blog: z.string().optional().describe("Blog subdomain"),
    title: z.string().optional().describe("New title"),
    content: z.string().optional().describe("New content in HTML format"),
    excerpt: z.string().optional().describe("New excerpt"),
    category: z.string().optional().describe("New category name or slug"),
    tags: z.array(z.string()).optional().describe("New list of tags (replaces existing)"),
    status: z.enum(["draft", "published"]).optional().describe("New publish status"),
    image: z.string().optional().describe("New featured image URL"),
  },
  async ({ slug, blog, ...updates }) => {
    const result = await api("PATCH", `/posts/${encodeURIComponent(slug)}`, updates, blog);
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
    blog: z.string().optional().describe("Blog subdomain"),
  },
  async ({ slug, blog }) => {
    const result = await api("DELETE", `/posts/${encodeURIComponent(slug)}`, null, blog);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "upload_image",
  "Upload an image to the blog's media library from a public URL. The MCP downloads the image locally and uploads it to the API as multipart. Returns the hosted image URL that can be used as a featured image in create_post or update_post.",
  {
    url: z.string().describe("Public URL of the image to upload"),
    filename: z.string().optional().describe("Optional filename (defaults to URL basename)"),
    blog: z.string().optional().describe("Blog subdomain (required if API key has access to multiple blogs)"),
  },
  async ({ url: imageUrl, filename, blog }) => {
    // Download image locally (MCP runs on user's machine, avoids geo-blocking)
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      throw new Error(`Failed to download image: ${imgRes.status} ${imgRes.statusText}`);
    }
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const fname = filename || new URL(imageUrl).pathname.split("/").pop() || "image.jpg";

    // Build multipart form data
    const boundary = `----TaitaMCP${Date.now()}`;
    const parts = [];

    // image file part
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="image"; filename="${fname}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`
    );
    parts.push(buffer);
    parts.push("\r\n");

    // entityType part
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="entityType"\r\n\r\n` +
      `general\r\n`
    );

    parts.push(`--${boundary}--\r\n`);

    // Combine into a single buffer
    const body = Buffer.concat(parts.map(p => typeof p === "string" ? Buffer.from(p) : p));

    const uploadUrl = `${API_URL}/media/upload`;
    const headers = {
      "X-API-Key": API_KEY,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    };
    if (blog) headers["X-Blog"] = blog;

    const res = await fetch(uploadUrl, { method: "POST", headers, body });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || data.error || `Upload failed: ${res.status}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

server.tool(
  "list_media",
  "List media files in the blog's library. Returns URLs and metadata.",
  {
    blog: z.string().optional().describe("Blog subdomain"),
    page: z.number().optional().default(1).describe("Page number"),
    limit: z.number().optional().default(20).describe("Items per page"),
  },
  async ({ blog, ...params }) => {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    const result = await api("GET", `/media${qs ? `?${qs}` : ""}`, null, blog);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "list_categories",
  "List all blog categories with their post counts.",
  {
    blog: z.string().optional().describe("Blog subdomain"),
  },
  async ({ blog }) => {
    const result = await api("GET", "/categories", null, blog);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "list_tags",
  "List all blog tags with their post counts.",
  {
    blog: z.string().optional().describe("Blog subdomain"),
  },
  async ({ blog }) => {
    const result = await api("GET", "/tags", null, blog);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
