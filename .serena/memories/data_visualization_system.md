# GOGGA Data Visualization & Math Tools System

## Last Updated: December 8, 2025 - Phase 2 + Router Integration Complete


## Overview
Comprehensive system for interactive charts, mathematical analysis tools, and display views for presenting data to users.

## Documentation
Full project document: `docs/DATA_VISUALIZATION_SYSTEM.md`

## Quick Reference

### Current Chart Types (10)
bar, line, pie, area, scatter, radar, radialBar, composed, funnel, treemap

### Planned Chart Types (3 new)
stackedBar, stackedLine, multiArea

### Math Tool Modules
1. **Statistics**: Descriptive, Inferential, Regression, Time Series, Probability
2. **Fraud Analysis**: Benford's Law, Anomaly Detection, Red Flags, Network Analysis
3. **Financial Formulas**: Compound Interest, NPV, IRR, SA Tax, Accounting Ratios

### Display View Components (10)
| Component | Purpose | File |
|-----------|---------|------|
| TerminalView | **IMPLEMENTED** Live verbose execution logs | `display/TerminalView.tsx` |
| DataTable | CSV data, query results | `display/DataTable.tsx` |
| StatCards | KPIs, summary stats | `display/StatCards.tsx` |
| FormulaView | LaTeX equations, proofs | `display/FormulaView.tsx` |
| ComparisonView | A vs B, before/after | `display/ComparisonView.tsx` |
| TimelineView | History, audit trails | `display/TimelineView.tsx` |
| HeatmapView | Correlation matrices | `display/HeatmapView.tsx` |
| AlertCards | Fraud alerts, warnings | `display/AlertCards.tsx` |
| TreeView | Hierarchies, org charts | `display/TreeView.tsx` |
| ProgressView | Gauges, completion % | `display/ProgressView.tsx` |

### Key Files
| Component | Location |
|-----------|----------|
| ChartRenderer | `gogga-frontend/src/components/ChartRenderer.tsx` |
| Tool Handler | `gogga-frontend/src/lib/toolHandler.ts` |
| Tool Definitions | `gogga-backend/app/tools/definitions.py` |
| Display Components | `gogga-frontend/src/components/display/` |
| Chart Types | `gogga-frontend/src/types/chart.ts` |

### Dependencies to Install
**Frontend (pnpm):**
- papaparse, @types/papaparse
- html2canvas
- mathjs
- katex, @types/katex

**Backend (pip):**
- pandas, scipy, numpy

### Implementation Status
- **Phase 1: Charts** ✅ COMPLETE (13 tasks)
  - ChartRenderer enhanced, 13+ chart types, stacked variants, exports
- **Phase 2: Math Tools** ✅ COMPLETE (All Phases)
  - `math_router.py` - Intent classification (7 categories)
  - `math_definitions.py` - 4 tool schemas (statistics, financial, tax, fraud)
  - `math_service.py` - Full calculation engine (~400 lines)
  - Display components: StatCards, AlertCards, DataTable, FormulaView, MathResultDisplay
  - Router integration: tools added to `definitions.py` and `executor.py`
  - Unit tests: 36 tests passing in `test_math_service.py`
  - Documentation: `docs/MathTooling.md`
- **Phase 3: Display Views** - PENDING
- **Phase 4: Documentation** - COMPLETE (TIERS.md updated)

### Tier Availability
| Feature | FREE | JIVE | JIGGA |
|---------|------|------|-------|
| Charts | View only | Full | Full |
| CSV Upload | ❌ | ✅ | ✅ |
| Math Tool | ❌ | Basic | Full |
| Display Views | Basic | Most | All |
| Export | ❌ | PNG/CSV | All formats |
