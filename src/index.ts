import "dotenv/config";
import cors from "cors";
import { isValidBearerToken } from "./security.js";
import express, { type Request, type Response } from "express";
import { Octokit } from "@octokit/rest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const requiredEnv = ["GITHUB_TOKEN", "MCP_AUTH_TOKEN"] as const;
for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const github = new Octokit({ auth: process.env.GITHUB_TOKEN });
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: false, methods: ["GET", "POST", "DELETE"], allowedHeaders: ["content-type", "mcp-session-id", "authorization"] }));

function isAuthorized(req: Request): boolean {
  return isValidBearerToken(req.header("authorization"), process.env.MCP_AUTH_TOKEN ?? "");
}

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "github-mcp-connector",
    version: "0.1.0"
  });

  server.registerTool(
    "list_repositories",
    {
      title: "List GitHub repositories",
      description: "List repositories accessible to the connected GitHub account. Supports pagination and optional owner filtering.",
      inputSchema: {
        page: z.number().int().min(1).default(1).describe("Page number, starting at 1"),
        per_page: z.number().int().min(1).max(100).default(30).describe("Number of repositories to return"),
        owner: z.string().min(1).optional().describe("Optional repository owner login")
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ page, per_page, owner }) => {
      const response = owner
        ? await github.rest.repos.listForUser({ username: owner, page, per_page, sort: "updated" })
        : await github.rest.repos.listForAuthenticatedUser({ page, per_page, sort: "updated", affiliation: "owner,collaborator,organization_member" });

      const repositories = response.data.map((repo) => ({
        full_name: repo.full_name,
        description: repo.description,
        private: repo.private,
        default_branch: repo.default_branch,
        html_url: repo.html_url,
        updated_at: repo.updated_at
      }));
      return { content: [{ type: "text", text: JSON.stringify(repositories, null, 2) }] };
    }
  );

  server.registerTool(
    "get_repository",
    {
      title: "Get repository details",
      description: "Get metadata for a GitHub repository by owner and repository name.",
      inputSchema: {
        owner: z.string().min(1),
        repo: z.string().min(1)
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ owner, repo }) => {
      const { data } = await github.rest.repos.get({ owner, repo });
      const details = {
        full_name: data.full_name,
        description: data.description,
        private: data.private,
        default_branch: data.default_branch,
        html_url: data.html_url,
        clone_url: data.clone_url,
        language: data.language,
        topics: data.topics,
        archived: data.archived,
        permissions: data.permissions
      };
      return { content: [{ type: "text", text: JSON.stringify(details, null, 2) }] };
    }
  );

  server.registerTool(
    "list_files",
    {
      title: "List repository files",
      description: "List files and directories at a repository path. Use an empty path for the repository root. Set ref to a branch, tag, or commit SHA.",
      inputSchema: {
        owner: z.string().min(1),
        repo: z.string().min(1),
        path: z.string().default(""),
        ref: z.string().optional()
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ owner, repo, path, ref }) => {
      const { data } = await github.rest.repos.getContent({ owner, repo, path, ...(ref ? { ref } : {}) });
      if (!Array.isArray(data)) {
        const item = data as { name: string; path: string; type: string; size: number; html_url?: string };
        return { content: [{ type: "text", text: JSON.stringify({ name: item.name, path: item.path, type: item.type, size: item.size, html_url: item.html_url }, null, 2) }] };
      }
      const entries = data.map((item) => ({
        name: item.name,
        path: item.path,
        type: item.type,
        size: item.size,
        html_url: item.html_url
      }));
      return { content: [{ type: "text", text: JSON.stringify(entries, null, 2) }] };
    }
  );

  server.registerTool(
    "read_file",
    {
      title: "Read a repository file",
      description: "Read a UTF-8 text file from a GitHub repository. Large files can be limited with start_line and end_line.",
      inputSchema: {
        owner: z.string().min(1),
        repo: z.string().min(1),
        path: z.string().min(1),
        ref: z.string().optional(),
        start_line: z.number().int().min(1).optional(),
        end_line: z.number().int().min(1).optional()
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ owner, repo, path, ref, start_line, end_line }) => {
      const { data } = await github.rest.repos.getContent({ owner, repo, path, ...(ref ? { ref } : {}) });
      if (Array.isArray(data) || data.type !== "file") {
        throw new Error("The requested path is not a file.");
      }
      if (data.size > 500_000) {
        throw new Error("File is larger than the 500 KB safety limit.");
      }
      if (!data.content || data.encoding !== "base64") {
        throw new Error("GitHub did not return a supported text file.");
      }

      const decoded = Buffer.from(data.content, "base64").toString("utf8");
      const lines = decoded.split(/\r?\n/);
      const from = start_line ? start_line - 1 : 0;
      const to = end_line ? Math.min(end_line, lines.length) : lines.length;
      if (from >= lines.length || to <= from) {
        throw new Error("Requested line range is outside the file or empty.");
      }
      const numbered = lines.slice(from, to).map((line, index) => `${from + index + 1}: ${line}`).join("\n");
      return { content: [{ type: "text", text: `File: ${owner}/${repo}/${path}\nRef: ${ref ?? "default branch"}\n\n${numbered}` }] };
    }
  );

  server.registerTool(
    "search_code",
    {
      title: "Search GitHub code",
      description: "Search code in repositories accessible to the GitHub account. GitHub code search requires a repository-qualified query for reliable results, for example 'TODO repo:owner/name'.",
      inputSchema: {
        query: z.string().min(1).max(256).describe("GitHub code search query, such as 'TODO repo:owner/name'"),
        per_page: z.number().int().min(1).max(100).default(20)
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ query, per_page }) => {
      const { data } = await github.rest.search.code({ q: query, per_page });
      const matches = data.items.map((item) => ({
        name: item.name,
        path: item.path,
        repository: item.repository.full_name,
        html_url: item.html_url
      }));
      return { content: [{ type: "text", text: JSON.stringify({ total_count: data.total_count, items: matches }, null, 2) }] };
    }
  );

  return server;
}

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "github-mcp-connector" });
});

app.all("/mcp", async (req: Request, res: Response) => {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });
  const server = createMcpServer();

  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP request failed:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
app.listen(port, host, () => {
  console.log(`GitHub MCP Connector listening on http://${host}:${port}`);
});
