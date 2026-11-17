# GitHub MCP Connector for Claude

A remote Model Context Protocol (MCP) server that lets Claude access GitHub repositories through a controlled set of tools.

## Project status

**Stage:** 1 — project bootstrap  
**Status:** Planning and initial implementation

## Initial MVP

The first release will provide read-only GitHub tools:

- List repositories available to the authenticated GitHub account
- Get repository metadata
- List files and directories
- Read file contents
- Search code

Write operations (branches, commits, file updates, pull requests) are intentionally deferred until the read-only workflow is tested.

## Planned stack

- TypeScript
- Model Context Protocol SDK
- GitHub REST API via Octokit
- Streamable HTTP transport
- Vitest

## Deployment target

A public HTTPS endpoint is required because Claude Web connects to remote MCP servers from Anthropic's infrastructure.

## Security principles

- GitHub credentials are stored only as server-side environment secrets.
- Never commit access tokens or other secrets.
- Start with read-only permissions and add write scopes only when needed.
- Validate repository names, paths, refs, and search inputs.
- Do not expose arbitrary GitHub API proxying.

## Development

Implementation and deployment instructions will be added as the MVP takes shape.
