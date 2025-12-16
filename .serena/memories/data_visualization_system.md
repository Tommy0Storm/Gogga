# GOGGA Data Visualization & Math Tools System

## Last Updated: December 13, 2025 - Recharts 3.x Migration + React 19.2

## Recharts 3.x Key Changes (from v2)

### Breaking Changes
- **No more CategoricalChartState** - Use hooks like `useActiveTooltipLabel` instead
- **Customized no longer receives extra props** - Use hooks to access internal state
- **Removed internal props** - `activeIndex`, Scatter `points`, Area `points`, Legend `payload` props removed
- **Z-Index** - Determined by render order (SVG has no z-index concept) - render Tooltip below Legend in JSX
- **accessibilityLayer now true by default** - Disable with `accessibilityLayer={false}`
- **New minimum requirements** - React 16.8+, TypeScript 5.x+, Node.js v18+

### New Features
- **Custom components support** - Wrap axes/charts in custom React components, no Customized needed
- **Tooltip portal** - `portal` prop to render tooltip anywhere in DOM
- **Multiple axes in Polar charts** - Radar charts now support multiple axes
- **Auto width Y-axis** - Set `width="auto"` for auto-calculated width
- **symlog scale type** - New scale type for large value ranges

### Best Practices
- Keep dataKey functions stable with `useCallback` or define outside component
- Isolate frequently changing components to prevent full chart re-render
- Use `React.memo` for expensive child components
- Debounce mouse handlers for smoother interactions

### Example Patterns
```tsx
// ✅ Direct custom component (v3.0)
const MyAxes = () => (
  <>
    <XAxis dataKey="name" />
    <YAxis tickCount={7} />
  </>
)
<BarChart data={data}>
  <Bar dataKey="uv" />
  <MyAxes />
</BarChart>

// ✅ Stable dataKey (performance)
const dataKey = useCallback((entry) => entry.value, [])
<Line dataKey={dataKey} />

// ✅ Auto-width Y-axis (v3.0)
<YAxis width="auto" />
```


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
| TerminalView | **ENHANCED** Live verbose execution logs WITH full calculation steps | `display/TerminalView.tsx` |
| PythonTerminalView | **IMPLEMENTED** Python 3.14 code execution display with syntax highlighting | `display/PythonTerminalView.tsx` |
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
- **Phase 2: Math Tools** ✅ COMPLETE (All Phases + December 2025 Enhancement)
  - `math_router.py` - Intent classification (7 categories)
  - `math_definitions.py` - 4 tool schemas (statistics, financial, tax, fraud)
  - `math_service.py` - Full calculation engine (~1300 lines)
  - Display components: StatCards, AlertCards, DataTable, FormulaView, MathResultDisplay
  - Router integration: tools added to `definitions.py` and `executor.py`
  - Unit tests: 36 tests passing in `test_math_service.py`
  - Documentation: `docs/MathTooling.md`
  
  **December 2025 Enhancement: Step-by-Step Calculation Display**
  - Added `calculation_steps` to all major math operations:
    - `_compound_interest()` - 8 steps showing formula breakdown
    - `_simple_interest()` - 5 steps
    - `_pmt()` (loan payment) - 10 steps with intermediate values
    - `_summary_stats()` - 11 steps for statistical analysis
    - `_npv()` - Dynamic steps showing each period's present value
    - `calculate_sa_tax()` - 11+ steps for full tax calculation breakdown
  - Frontend `toolHandler.ts` updated to parse `calculation_steps` and add to execution logs
  - `MathResultDisplay` now shows logs expanded by default when calculation_steps present
  - Uses Python 3.14 `Decimal.from_number()` for precision in calculations
  - Added `to_decimal()` and `to_fraction()` helper functions for Python 3.14 compatibility
  - Imports: `from decimal import Decimal, ROUND_HALF_UP` and `from fractions import Fraction`

  **December 2025: SymPy Integration for Sophisticated Formulas**
  - Added SymPy 1.14+ to `python_executor.py` ALLOWED_MODULES
  - Pre-imported in sandbox: Symbol, symbols, solve, simplify, expand, factor, diff, integrate, limit, series, summation, product, Eq, Matrix, det, latex, pretty, sin, cos, tan, exp, log, sqrt, pi, E, I, oo
  - Capabilities: Algebraic solving, system of equations, calculus, differential equations, matrix operations, LaTeX output
  - Example: `solve(x**2 - 5*x + 6, x)` → `[2, 3]`
  - Example: `dsolve(y''-2y'+y=0)` → `y = (C1 + C2*x)*exp(x)`

  **December 2025: Sequential Thinking Tool**
  - Added `sequential_think` tool for multi-step reasoning
  - Schema: step_number, thought, calculation, intermediate_result, needs_more_steps, next_step_plan
  - Returns calculation_steps for frontend display
  - Available on JIVE and JIGGA tiers
  - Enables LLM to break complex problems into visible reasoning steps

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
