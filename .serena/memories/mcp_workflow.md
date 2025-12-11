# MCP Workflow - Mandatory Tool Usage

## Always Use These Tools (Every Prompt)

### 1. Serena (#oraios/serena)

- **Read memories first** when starting a task
- Use symbolic navigation for code exploration
- Use `find_symbol`, `get_symbols_overview` before reading full files
- Write memories for important discoveries
- Update memories as code evolves

### 2. Context7 (#context7)

- Use for library/framework documentation
- Use for API references and examples
- Use for troubleshooting errors
- Especially useful for: Next.js, FastAPI, Prisma, Dexie, Tailwind

### 3. Todoist (#doist/todoist-ai)

- Track complex multi-step tasks
- Create todos for work visibility
- **ALWAYS** use project `6fV5cCccq3m4PRgw` (🤖 Gogga Development)
- **ALWAYS** add label `copilot-generated`
- Use priority sections for organization

## Workflow Order

1. **Check Serena memories** - Understand project context
2. **Create Todoist tasks** - For multi-step work visibility
3. **Use Serena symbols** - Navigate code efficiently
4. **Query Context7** - Get external library docs when needed
5. **Make changes** - Use Serena's symbolic editing
6. **Update Todoist** - Mark tasks complete
7. **Update memories** - Document important changes

## When to Use Context7

| Scenario | Use Context7? |
|----------|---------------|
| Next.js 16 API changes | ✅ Yes |
| Prisma schema syntax | ✅ Yes |
| FastAPI endpoint patterns | ✅ Yes |
| Project-specific logic | ❌ No (use Serena) |
| Internal component behavior | ❌ No (use Serena) |
| External library errors | ✅ Yes |

## Todoist Task Template

```json
{
  "projectId": "6fV5cCccq3m4PRgw",
  "sectionId": "<priority section>",
  "labels": ["copilot-generated"],
  "content": "Task title",
  "description": "Details..."
}
```

## Priority Sections

| Priority | Section ID | Use For |
|----------|------------|---------|
| P1 Critical | `6fV5cFHchRvvqj9w` | Blockers, breaking bugs |
| P2 High | `6fV5cFHXr63whF2w` | Important features |
| P3 Medium | `6fV5cFGjCp6PRFQw` | Standard tasks |
| P4 Low | `6fV5cFJP5X3Q8p8P` | Nice-to-haves |

## Last Updated

December 11, 2025
