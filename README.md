# GitHub MCP Connector for Claude

A remote Model Context Protocol (MCP) server that gives Claude controlled, read-only access to GitHub.

## What this project does

This project is an MCP server. It is **not** a Claude plugin that can install itself from a GitHub link.

The connection has three parts:

1. Claude Web connects to a publicly reachable HTTPS MCP endpoint.
2. This server authenticates Claude's requests and calls the GitHub API.
3. GitHub returns repository data, which the server passes back to Claude.

A repository URL by itself cannot establish this connection. Claude cannot deploy this server, create its secrets, or add a custom connector to the user's Claude account just by opening this README. Those are one-time setup steps.

## Quick start for Claude users

### One-time setup

Each user should run their own instance of this server and connect it to their own GitHub account:

1. Deploy this repository to a Node.js hosting provider that supports a persistent public HTTPS service.
2. Configure the server environment variables:
   - `GITHUB_TOKEN` — the user's own GitHub fine-grained personal access token, with only the read permissions needed for the repositories they want Claude to access.
   - `MCP_AUTH_TOKEN` — a private random secret of at least 32 characters.
3. Find the deployed MCP endpoint. It must end in `/mcp`, for example `https://YOUR-SERVICE.example.com/mcp`.
4. In Claude Web, open **Settings → Connectors** (the exact menu wording may vary), add a custom connector, and enter that MCP URL.
5. Configure the connector's request header:
   - Header name: `Authorization`
   - Header value: `Bearer YOUR_MCP_AUTH_TOKEN`
6. Save the connector and complete any connection/authorization prompt Claude displays.

After this one-time setup, the user does not need to repeat the connector configuration for every repository or chat. The server must remain deployed and reachable for Claude to use it.

### Everyday use

Once the connector is connected and enabled in Claude, the user can send Claude a repository link and a task, for example:

> Work with this repository using the GitHub MCP Connector: https://github.com/OWNER/REPOSITORY
>
> Inspect its structure, read the relevant files, explain how the project works, and help me with the requested changes. Before making any changes, tell me what you plan to do.

Claude can then call the connector's available tools to inspect the repository. The current MVP is **read-only**, so it can list repositories, inspect metadata, list files, read files, and search code. It cannot currently commit, edit files, create branches, or open pull requests.

If Claude says the connector is unavailable, the user should check that it is enabled in Claude, the deployed service is awake/reachable, and the MCP URL and bearer header are correct.

## Important: do not share one personal deployment

The current authentication model is designed for a **single user's personal instance**:

- The server uses one `GITHUB_TOKEN`, which determines which GitHub repositories it can access.
- The server uses one `MCP_AUTH_TOKEN` to protect its MCP endpoint.
- Anyone who receives that bearer secret can use the server with the GitHub permissions of the configured token.

Do not publish either secret, put them in this repository, or distribute one person's bearer secret to other users. For a public project, each user should deploy their own instance and use their own GitHub token. A shared multi-user service would require a separate per-user authentication and GitHub OAuth design; that is not implemented in this MVP.

## MVP tools

- `list_repositories` — list repositories available to the configured GitHub token
- `get_repository` — retrieve repository metadata
- `list_files` — list a repository directory
- `read_file` — read a UTF-8 file, optionally by line range
- `search_code` — search GitHub code

The first release is read-only. Write operations will be added only after the read-only workflow is tested.

## Stack

- TypeScript / Node.js 20+
- MCP TypeScript SDK with Streamable HTTP
- Octokit (GitHub REST API)
- Express
- Node.js built-in test runner (`node:test`)

## Requirements

- Node.js 20 or newer
- A GitHub fine-grained personal access token with read-only repository metadata and contents permissions
- A long random secret for `MCP_AUTH_TOKEN`

## Run locally

```bash
npm ci
cp .env.example .env
```

Set `GITHUB_TOKEN` and `MCP_AUTH_TOKEN` in `.env`, then:

```bash
npm run dev
```

Health check:

```bash
curl http://localhost:3000/health
```

The local MCP endpoint is `http://localhost:3000/mcp`. It requires:

```
Authorization: Bearer <MCP_AUTH_TOKEN>
```

## Deployment notes

Claude Web requires a public HTTPS endpoint. Deploy this service to a Node-compatible host, configure `GITHUB_TOKEN` and `MCP_AUTH_TOKEN` as private environment variables in the hosting provider, and expose the MCP endpoint at:

```
https://YOUR-HOST/mcp
```

Do not put the GitHub token in Claude. It stays on the server. Hosting providers may have free-tier limits, including sleeping/idle behavior, usage caps, or cold starts; check the provider's current terms before deploying.

## Security

- Keep `.env` out of Git.
- Never expose the GitHub token to the MCP client.
- Use a fine-grained token with the minimum required read-only permissions.
- Keep the MCP bearer secret private; it grants access to the configured GitHub account through this server.
- Do not add write permissions to the GitHub token for this MVP.

## Scripts

- `npm run dev` — development server with reload
- `npm run build` — TypeScript type-check and build
- `npm test` — run tests
- `npm start` — run the compiled server
