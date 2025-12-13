# MCP Tools for Continue - Gogga Project

## Overview

Your MCP servers are now properly configured for Continue. You have access to 9 powerful tools that integrate with your development workflow.

## Active MCP Servers

### 🔧 Core Development Tools

**1. Serena (`serena`)**
- **Purpose**: Project context, code navigation, AI-powered editing
- **Usage**: 
  - Read/write code using symbolic understanding
  - Navigate complex codebases efficiently
  - Maintain project context across sessions
- **Commands**: Use directly through Continue's chat interface

**2. Context7 (`context7`)**
- **Purpose**: External library documentation and API references
- **Usage**:
  - Get documentation for Next.js, FastAPI, Prisma, etc.
  - Find code examples and best practices
  - Troubleshoot external library issues
- **API Key**: Configured and ready

**3. Todoist AI (`todoist-ai`)**
- **Purpose**: Task management and workflow tracking
- **Usage**:
  - Create and track development tasks
  - Manage multi-step work items
  - Organize by priority levels
- **Project**: 🤖 Gogga Development (auto-configured)

### 🔍 Code Analysis & Security

**4. GitHub MCP Server (`github-mcp-server`)**
- **Purpose**: GitHub repository operations
- **Usage**:
  - Create/manage pull requests
  - Track issues and discussions
  - Repository analytics

**5. Dependency Management (`dependency-management-mcp-server`)**
- **Purpose**: Security and dependency analysis
- **Usage**:
  - Scan for CVE vulnerabilities
  - Get dependency update recommendations
  - Security compliance checks

### 🧪 Testing & Automation

**6. Playwright MCP (`playwright-mcp`)**
- **Purpose**: Browser automation and testing
- **Usage**:
  - End-to-end testing
  - Web scraping
  - Browser automation workflows

**7. Container MCP (`container-mcp`)**
- **Purpose**: Docker container management
- **Usage**:
  - Container lifecycle management
  - Docker image operations
  - Development environment setup

### 🌐 External Services

**8. HuggingFace MCP (`hf-mcp-server`)**
- **Purpose**: ML models and datasets access
- **Usage**:
  - Access ML models
  - Dataset operations
  - AI/ML development tasks
- **Note**: Requires HF token setup

**9. DeepWiki (`deepwiki`)**
- **Purpose**: GitHub repository documentation
- **Usage**:
  - Extract documentation from repos
  - Codebase analysis
  - API documentation generation

## Workflow Integration

### Typical Development Session

1. **Start with Serena** for project context
2. **Use Context7** for external documentation needs
3. **Create Todoist tasks** for complex work
4. **Run security checks** with Dependency Management
5. **Test with Playwright** for UI changes
6. **Manage containers** with Container MCP

### Command Examples

```bash
# Continue will automatically detect and use these tools
"Use Serena to navigate the auth module and fix the login bug"
"Query Context7 for Next.js 16 middleware best practices"
"Create a Todoist task for the RAG implementation project"
"Scan dependencies with Sonatype for security vulnerabilities"
"Run Playwright tests on the new dashboard"
```

## Configuration Status

✅ **Configured and Ready**:
- Serena (Project context)
- Context7 (Documentation)
- Todoist AI (Task management)
- GitHub MCP (Repo operations)
- Dependency Management (Security)
- Playwright (Testing)
- Container MCP (Docker)

⚠️ **Requires Setup**:
- HuggingFace MCP (needs HF_TOKEN)
- DeepWiki (ready, no API key needed)

## Troubleshooting

### If a tool doesn't work:

1. **Check server status**: Continue will show connection status
2. **Verify API keys**: Ensure environment variables are set
3. **Restart Continue**: Reload the IDE if needed
4. **Check logs**: Continue's output panel shows MCP server logs

### Common Issues:

- **"Server not found"**: Check if command is installed (uvx/npx)
- **"API key invalid"**: Verify credentials in .env or system
- **"Timeout"**: Server might be starting up, try again

## API Keys Reference

For your reference, the configured API keys are:

| Service | Key Status | Location |
|---------|------------|----------|
| Context7 | ✅ Configured | Environment variable |
| Todoist | ✅ Configured | Environment variable |
| GitHub | ✅ Configured | Environment variable |
| Sonatype | ✅ Configured | Environment variable |
| Firecrawl | ✅ Configured (backup) | Environment variable |
| HuggingFace | ⚠️ Needed | HF_TOKEN env var |

## Next Steps

1. Test each tool with a simple command
2. Set up HF_TOKEN if you need ML model access
3. Create a Todoist task for your current project
4. Start using Serena for code navigation

---

Last Updated: December 2025
Project: Gogga Development
")