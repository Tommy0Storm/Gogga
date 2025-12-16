# RAG System Design

> **Last Updated:** December 16, 2025
> **Status:** 🔄 IN PROGRESS
> **Full Doc:** `docs/RAG_SYSTEM_DESIGN.md`

## Quick Reference

### Tier Access

| Feature | FREE | JIVE | JIGGA |
|---------|------|------|-------|
| **Session Docs (Chat)** | ❌ | ✅ 10 docs, 50MB | ✅ 10 docs, 50MB |
| **RAG Store** | ❌ | ✅ 1 doc, 5MB (enticement) | ✅ 200 docs, 250MB |
| **Keyword Search** | ❌ | ✅ | ✅ |
| **Semantic Search** | ❌ | ✅ | ✅ |
| **RAG Toggle** | ❌ | ✅ | ✅ |
| **Modes** | ❌ | Analysis only | Analysis / Authoritative |

> **JIVE Enticement:** 1 RAG doc lets users taste semantic search, then hit limit and upgrade.

### Document Types

- Session Docs = Temporary, current chat only (JIVE & JIGGA)
- RAG Docs = Persistent, semantic search (JIVE: 1 doc, JIGGA: 200 docs)

### Limits

| Type | JIVE | JIGGA |
|------|------|-------|
| RAG Docs | 1 doc, 5 MB, 5 MB/file | 200 docs, 250 MB, 25 MB/file |
| Session Docs | 10/session, 50 MB, 10 MB/file | 10/session, 50 MB, 10 MB/file |

### RAG Modes

| Mode | JIVE | JIGGA |
|------|------|-------|
| **Analysis** | ✅ (default) | ✅ (default) |
| **Authoritative** | ❌ (upgrade prompt) | ✅ |

## Test Plan Summary

**Total Tests:** 110

| Tier | Tests |
|------|-------|
| JIVE | 37 tests (upload, search, toggle, enticement) |
| JIGGA | 52 tests (full RAG, modes, cross-session) |
| Shared | 21 tests (session docs, errors, performance) |

See `docs/RAG_SYSTEM_DESIGN.md` for full test plan.

## Supported File Types

### Allowed
- Text: `.txt`, `.md`, `.csv`
- Documents: `.pdf`, `.docx`, `.pptx`
- Spreadsheets: `.xlsx`, `.xls`, `.ods`
- Data: `.json`, `.xml`, `.yaml`
- Code: `.js`, `.ts`, `.py`, `.java`, etc.
- Apple: `.pages`, `.numbers`, `.keynote`

### Blocked (Executables/Binaries)
`.exe`, `.dll`, `.bin`, `.bat`, `.sh`, `.zip`, `.mp3`, `.mp4`, `.jpg`, `.png`, etc.

## Key Files

| File | Purpose |
|------|---------|
| `lib/config/tierConfig.ts` | Tier limits, blocked extensions |
| `lib/ragManager.ts` | RAG retrieval, context building |
| `lib/embeddingEngine.ts` | E5-small-v2 embeddings |
| `lib/rxdb/schemas.ts` | Document & chunk schemas |
| `lib/rxdb/vectorCollection.ts` | Distance-to-Samples search |
| `docs/RAG_SYSTEM_DESIGN.md` | Full architecture doc + test plan |

## Prompt Templates

### Analysis Mode
```
[DOCUMENT CONTEXT]
Use these excerpts to inform your response.
You may also draw on general knowledge.
---
Source: {filename} (page {page})
"{content}"
---
[END DOCUMENT CONTEXT]
```

### Authoritative Mode (JIGGA Only)
```
[AUTHORITATIVE DOCUMENT CONTEXT]
CRITICAL: Base response ONLY on these documents.
No external knowledge. Always cite sources.
---
Source: {filename} (page {page})
"{content}"
---
[END AUTHORITATIVE DOCUMENT CONTEXT]
```

## Embedding Engine

- Model: `intfloat/e5-small-v2` (via Xenova/TransformersJS)
- Dimensions: 384
- Backend: WASM
- Display name: "VCB-AI Micro"

## RxDB Vector Search

Uses Distance-to-Samples indexing:
1. 5 sample vectors (idx0-idx4)
2. Store distance to each sample
3. Query by similar distances + cosine refinement
4. ~88ms vs ~765ms full scan
