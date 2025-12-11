# MCP Server Configuration - Gogga Project

## Active Servers (10 total)

### Tier 1: Always Warm (Every Prompt)

| Server | Purpose | Transport |
|--------|---------|-----------|
| **oraios/serena** | Project context, symbol navigation, code editing | stdio (uvx) |
| **io.github.upstash/context7** | Library docs, API references | stdio (npx) |
| **doist/todoist-ai** | Task tracking, multi-step work | HTTP (ai.todoist.net) |

### Tier 2: Active (Work Hours)

| Server | Purpose | Transport |
|--------|---------|-----------|
| **github/github-mcp-server** | PRs, issues, repo operations | HTTP |
| **copilot-extensions/container-mcp** | Docker container management | Docker |
| **com.sonatype** | Dependency security analysis | HTTP |

### Tier 3: Cold (On-Demand)

| Server | Purpose | Transport |
|--------|---------|-----------|
| **microsoft/playwright-mcp** | Browser automation, snapshots | stdio (npx) |
| **huggingface/hf-mcp-server** | ML models, datasets, image gen | HTTP OAuth |
| **firecrawl-mcp** | Web scraping, crawling | stdio (npx) |
| **cognitionai/deepwiki** | GitHub repo documentation | HTTP |

## API Keys Reference

```
Context7:   ctx7sk-dd6ec951-5020-4ee3-bb8d-6c3186629af8
Firecrawl:  fc-29c1b6c35f544cf2990b8f36c30f700b
Todoist:    cb35b23b75b6ceac2ad67b6afb74def3718a4f3b (SDK only)
GitHub PAT: github_pat_11BJRCXUA0ju7IoUlcHGBK_fgF...
Cerebras:   csk-t3d4j5emv8349r56xhvtyd4mypee23p2pw3kp3d6wrmkxrd8
Sonatype:   nmznBteml3vYx8zOk4iaWYzTpusezG4RDCplivAYryyzCMne
```

## Todoist Task Management

**CRITICAL**: All Copilot tasks go to dedicated project to avoid overwriting user's personal tasks!

| Property | Value |
|----------|-------|
| Project Name | 🤖 Gogga Development |
| Project ID | `6fV5cCccq3m4PRgw` |
| Required Label | `copilot-generated` |

### Priority Sections

| Section | ID |
|---------|-----|
| 🔴 Priority 1 (Critical) | `6fV5cFHchRvvqj9w` |
| 🟠 Priority 2 (High) | `6fV5cFHXr63whF2w` |
| 🟡 Priority 3 (Medium) | `6fV5cFGjCp6PRFQw` |
| 🟢 Priority 4 (Low) | `6fV5cFJP5X3Q8p8P` |

## Gogga-Specific Workflows

### Frontend Development

```
Context7 → Next.js docs → Serena edits → Playwright tests
```

### Backend Development

```
Context7 → FastAPI docs → Serena edits
```

### Dependency Updates

```
Sonatype scan → CVE check → Context7 migration guide → Serena apply
```

### RAG System Work

```
HuggingFace → E5 embeddings → Serena edit ragManager.ts
```

## Config Locations

| Config | Path |
|--------|------|
| MCP Servers | `~/.vscode-server/data/User/mcp.json` |
| Full Reference | `/home/ubuntu/Dev-Projects/Gogga/.vscode/MCP_PIPELINE.md` |

## Quick Reference

- Check Serena memories first for project context
- Use Context7 for external library documentation
- Track multi-step work in Todoist (🤖 Gogga Development project)
- Sonatype for dependency security analysis
- Playwright for browser automation testing
- Container MCP for Docker operations

## Last Updated

December 11, 2025
