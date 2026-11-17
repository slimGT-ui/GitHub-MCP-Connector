# GitHub MCP Connector for Claude

A remote Model Context Protocol (MCP) server that gives Claude controlled, read-only access to GitHub.

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
- Vitest

## Requirements

- Node.js 20 or newer
- A GitHub fine-grained personal access token with read-only repository metadata and contents permissions
- A long random secret for `MCP_AUTH_TOKEN`

## Run locally

```bash
npm install
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

The MCP endpoint is `http://localhost:3000/mcp`. It requires:

```
Authorization: Bearer <MCP_AUTH_TOKEN>
```

## Claude Web deployment

Claude Web requires a public HTTPS endpoint reachable on port 443. Deploy this service to a Node-compatible host, configure the two environment secrets, and expose the MCP endpoint at:

```
https://YOUR-HOST/mcp
```

When adding the custom connector in Claude, configure the fixed request header:

- Header: `Authorization`
- Value: `Bearer YOUR_MCP_AUTH_TOKEN`

Do not put the GitHub token in Claude. It stays on the server.

## Security

- Keep `.env` out of Git.
- Never expose the GitHub token to the MCP client.
- Use a fine-grained token with the minimum required read-only permissions.
- The shared MCP bearer secret protects the endpoint from anonymous access.
- Do not add write permissions to the GitHub token for this MVP.

## Scripts

- `npm run dev` — development server with reload
- `npm run build` — TypeScript type-check and build
- `npm test` — run tests
- `npm start` — run the compiled server
