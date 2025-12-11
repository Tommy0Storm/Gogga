# GOGGA Data Visualization & Math Tools System

> **Project**: GOGGA - South African AI Assistant  
> **Version**: 2.0  
> **Created**: December 8, 2025  
> **Status**: Implementation Phase

---

## 📋 Executive Summary

This document outlines the comprehensive Data Visualization and Math Tools system for GOGGA. The system provides interactive charts, mathematical analysis tools, and multiple display view types for presenting data to users.

---

## 🎯 System Goals

1. **Interactive Charts** - 13+ chart types with HD quality rendering
2. **Math Tool** - Statistics, fraud analysis, financial formulas
3. **Display Views** - 10 specialized view types for different data presentations
4. **CSV Support** - Upload, preview, and visualize user data
5. **Export Options** - PNG, SVG, PDF, CSV, JSON exports

---

## 📊 PHASE 1: Chart System Enhancement

### 1.1 Current Implementation (Completed ✅)

| Component | File | Status |
|-----------|------|--------|
| ChartRenderer | `gogga-frontend/src/components/ChartRenderer.tsx` | ✅ Created |
| Tool Handler | `gogga-frontend/src/lib/toolHandler.ts` | ✅ Updated |
| ChatClient Integration | `gogga-frontend/src/app/ChatClient.tsx` | ✅ Integrated |

**Current Chart Types (10):**
- Bar Chart
- Line Chart
- Pie Chart
- Area Chart
- Scatter Plot
- Radar Chart
- Radial Bar Chart
- Composed Chart
- Funnel Chart
- Treemap Chart

### 1.2 UI Improvements (Pending)

#### Task #1: Fix Legend Placements
```
Priority: HIGH
Dependencies: None
Files: ChartRenderer.tsx

Requirements:
- Place legends on RIGHT side for pie/donut charts
- Place legends on BOTTOM for bar/line/area charts
- Responsive positioning based on container width
- No overlapping with chart elements
- Legend items should wrap on mobile
```

#### Task #2: HD Quality Charts
```
Priority: HIGH
Dependencies: None
Files: ChartRenderer.tsx

Requirements:
- Expanded view height: 500px (currently ~350px)
- Retina support using devicePixelRatio
- Improved font sizing (labels, legends)
- Crisp edges on all SVG elements
- Anti-aliased text rendering
```

#### Task #3: Proper Chart Header
```
Priority: MEDIUM
Dependencies: None
Files: ChartRenderer.tsx

Requirements:
- Styled header component with:
  - Title (main heading)
  - Subtitle (optional description)
  - Chart type badge (e.g., "Bar Chart")
  - Data point count (e.g., "12 items")
  - Timestamp (optional)
  - Action buttons (export, expand, switch type)
```

#### Task #4: Chart Type Switcher
```
Priority: MEDIUM
Dependencies: Task #3
Files: ChartRenderer.tsx

Requirements:
- Dropdown/button group in header
- Compatible type groups:
  - Bar ↔ Line ↔ Area
  - Pie ↔ Donut (RadialBar)
  - Scatter ↔ Line
  - Stacked variants within each group
- Preserve data when switching
- Smooth transition animation
```

### 1.3 New Chart Types (Pending)

#### Task #5: Stacked Bar Chart
```
Priority: MEDIUM
Dependencies: Task #13 (Enhanced Interface)
Files: ChartRenderer.tsx

Requirements:
- Multiple data series stacking
- Vertical stacking (default)
- Horizontal stacking option
- Color palette for up to 8 series
- Hover shows individual + cumulative values
```

#### Task #6: Stacked Line Chart
```
Priority: MEDIUM
Dependencies: Task #13 (Enhanced Interface)
Files: ChartRenderer.tsx

Requirements:
- Multi-series line chart
- Area fills between lines
- Support 2-8 data series
- Individual series toggle (click legend)
- Gradient fills per series
```

#### Task #7: Multi-Area Chart
```
Priority: LOW
Dependencies: Task #13 (Enhanced Interface)
Files: ChartRenderer.tsx

Requirements:
- Overlapping area charts
- Adjustable opacity per series
- Gradient fills (top to bottom)
- Interactive legend toggling
- Smooth curve interpolation
```

### 1.4 CSV Integration (Pending)

#### Task #8: CSV Upload Support
```
Priority: HIGH
Dependencies: Task #16 (Install Dependencies)
Files: ChartRenderer.tsx, new CSVUploader component

Requirements:
- Upload button in chart UI
- PapaParse for CSV parsing
- Auto-detect:
  - Headers (first row)
  - Data types (string, number, date)
  - Delimiter (comma, semicolon, tab)
- Max file size: 5MB
- Supported formats: .csv, .tsv
```

#### Task #9: CSV Data Preview
```
Priority: MEDIUM
Dependencies: Task #8
Files: New CSVPreview component

Requirements:
- Data table preview modal
- First 50 rows displayed
- Column selection UI:
  - X-axis dropdown
  - Y-axis dropdown (multi-select for series)
  - Series grouping column
- Data type override per column
- "Generate Chart" button
```

### 1.5 Technical Infrastructure (Pending)

#### Task #13: Enhanced ChartData Interface
```
Priority: CRITICAL (Blocking)
Dependencies: None
Files: types/chart.ts (new), ChartRenderer.tsx

New Interface:
interface ChartData {
  // Basic
  type: ChartType;
  title: string;
  subtitle?: string;
  data: DataPoint[];
  
  // Multi-series
  series?: SeriesConfig[];
  stackMode?: 'vertical' | 'horizontal' | 'none';
  
  // Appearance
  legendPosition?: 'top' | 'bottom' | 'left' | 'right' | 'none';
  colorPalette?: string[];
  
  // Axis
  xAxisLabel?: string;
  yAxisLabel?: string;
  xAxisFormat?: 'number' | 'date' | 'category';
  yAxisFormat?: 'number' | 'currency' | 'percent';
  
  // Grid & Animation
  showGrid?: boolean;
  gridStyle?: 'solid' | 'dashed' | 'dotted';
  animate?: boolean;
  animationDuration?: number;
}

type ChartType = 
  | 'bar' | 'stackedBar' | 'horizontalBar'
  | 'line' | 'stackedLine' | 'smoothLine'
  | 'area' | 'stackedArea' | 'multiArea'
  | 'pie' | 'donut'
  | 'scatter' | 'radar' | 'radialBar'
  | 'composed' | 'funnel' | 'treemap'
  | 'heatmap' | 'gauge';
```

#### Task #14: Export Options
```
Priority: MEDIUM
Dependencies: Task #16 (Install Dependencies)
Files: ChartRenderer.tsx, new ExportService

Export Formats:
- PNG (html2canvas) - High resolution
- SVG (native Recharts export)
- PDF (with chart + data table)
- CSV (data with metadata header)
- JSON (full ChartData object)

UI:
- Export dropdown in chart header
- Quality selection for PNG (1x, 2x, 4x)
- Include/exclude data table option
```

#### Task #15: Update Tool Definitions
```
Priority: HIGH
Dependencies: Task #13
Files: gogga-backend/app/tools/definitions.py

Updates:
- Add new chart types to enum
- Add series configuration schema
- Add appearance options
- Update examples in docstring
```

#### Task #16: Install Dependencies
```
Priority: CRITICAL (Blocking)
Dependencies: None

Frontend (pnpm add):
- papaparse (CSV parsing)
- @types/papaparse
- html2canvas (image export)
- mathjs (calculations)
- katex (formula rendering)
- @types/katex

Backend (pip install):
- pandas (data analysis)
- scipy (statistical functions)
- numpy (numerical operations)
```

---

## 🔢 PHASE 2: Math Tool Implementation

### 2.1 Tool Architecture

```
Frontend Request → Backend Math Tool → Computation Engine → Display View
                                              ↓
                                    mathjs / scipy / numpy
```

### 2.2 Statistics Module (Task #10)

#### Descriptive Statistics
| Function | Description | Output |
|----------|-------------|--------|
| `mean(data)` | Average | Single value |
| `median(data)` | Middle value | Single value |
| `mode(data)` | Most frequent | Value(s) + count |
| `std(data)` | Standard deviation | Value + interpretation |
| `variance(data)` | Variance | Value |
| `range(data)` | Min to Max | Min, Max, Range |
| `quartiles(data)` | Q1, Q2, Q3, IQR | Five-number summary |
| `skewness(data)` | Distribution shape | Value + interpretation |
| `kurtosis(data)` | Tail weight | Value + interpretation |
| `summary(data)` | All descriptive stats | Stat card grid |

#### Inferential Statistics
| Function | Description | Output |
|----------|-------------|--------|
| `t_test(a, b)` | Compare means | t-statistic, p-value, conclusion |
| `chi_square(observed, expected)` | Categorical test | χ², p-value, df |
| `anova(groups)` | Multi-group comparison | F-statistic, p-value |
| `confidence_interval(data, level)` | CI calculation | Lower, Upper, Level |
| `z_score(value, mean, std)` | Standardize | Z-score, percentile |

#### Regression Analysis
| Function | Description | Output |
|----------|-------------|--------|
| `linear_regression(x, y)` | Line fit | Equation, R², scatter plot |
| `multiple_regression(X, y)` | Multi-variable | Coefficients, R², residuals |
| `polynomial_regression(x, y, degree)` | Curve fit | Equation, R² |
| `correlation(x, y)` | Pearson r | Value, p-value, interpretation |
| `covariance(x, y)` | Covariance | Value, interpretation |

#### Time Series
| Function | Description | Output |
|----------|-------------|--------|
| `moving_average(data, window)` | Smoothing | Line chart overlay |
| `trend_analysis(data)` | Trend detection | Direction, strength, chart |
| `seasonality(data, period)` | Cycle detection | Pattern description |
| `forecast(data, periods)` | Prediction | Future values + confidence |

#### Probability
| Function | Description | Output |
|----------|-------------|--------|
| `binomial(n, k, p)` | Binomial probability | P(X=k), chart |
| `normal(x, μ, σ)` | Normal distribution | P(X<x), Z-score |
| `poisson(k, λ)` | Rare events | P(X=k), cumulative |
| `permutations(n, r)` | Arrangements | Count, formula |
| `combinations(n, r)` | Selections | Count, formula |

### 2.3 Fraud Analysis Module (Task #11)

#### Benford's Law Analysis
```python
benford_analysis(data: List[float]) -> {
    "first_digits": {1: count, 2: count, ...},
    "expected": {1: 30.1%, 2: 17.6%, ...},
    "chi_square": float,
    "p_value": float,
    "conclusion": "Data follows/deviates from Benford's Law",
    "chart": {type: "bar", data: comparison},
    "flagged_digits": [4, 9]  # if significant deviation
}
```

#### Anomaly Detection
| Method | Description | Flags |
|--------|-------------|-------|
| Z-Score | Values > 3σ from mean | Individual outliers |
| IQR | Values outside 1.5×IQR | Moderate outliers |
| Isolation Forest | ML-based | Complex patterns |
| DBSCAN | Density-based clustering | Groups of anomalies |

#### Financial Red Flags
```python
red_flags = {
    "round_numbers": count > threshold,  # Too many R1000.00 exactly
    "just_below_threshold": count,       # R9,999 patterns
    "duplicate_amounts": list,           # Exact amount repetition
    "sequential_numbers": list,          # Invoice 001, 002, 003...
    "weekend_transactions": count,       # Unusual timing
    "even_amount_bias": percentage,      # Too many .00 endings
}
```

#### Network Analysis
- **Circular transactions**: A→B→C→A patterns
- **Shell company indicators**: Many connections, little substance
- **Relationship mapping**: Graph visualization of entity connections

### 2.4 Financial Formulas Module (Task #12)

#### Core Financial
| Formula | Function | Inputs | Output |
|---------|----------|--------|--------|
| Compound Interest | `compound_interest()` | P, r, n, t | Future Value |
| Present Value | `present_value()` | FV, r, n | PV |
| NPV | `npv()` | rate, cashflows[] | Net Present Value |
| IRR | `irr()` | cashflows[] | Internal Rate of Return |
| PMT | `pmt()` | PV, r, n | Monthly Payment |
| Amortization | `amortization()` | loan, rate, term | Full schedule |

#### SA Tax Calculations (2024/25)
```python
sa_income_tax(annual_income: float, age: int) -> {
    "bracket": "R237,101 – R370,500",
    "marginal_rate": 26%,
    "tax_before_rebates": float,
    "primary_rebate": R17,235,
    "secondary_rebate": R9,444,  # if age >= 65
    "tertiary_rebate": R3,145,  # if age >= 75
    "medical_credits": float,
    "final_tax": float,
    "effective_rate": percentage
}
```

#### Accounting Ratios
| Category | Ratios |
|----------|--------|
| Liquidity | Current Ratio, Quick Ratio, Cash Ratio |
| Profitability | Gross Margin, Net Margin, ROE, ROA, ROIC |
| Leverage | Debt/Equity, Interest Coverage, Debt Ratio |
| Efficiency | Asset Turnover, Inventory Turnover, DSO, DPO |
| Valuation | P/E, P/B, EV/EBITDA, Dividend Yield |

#### Risk Metrics
| Metric | Description |
|--------|-------------|
| VaR | Value at Risk (95%, 99%) |
| Sharpe Ratio | Risk-adjusted return |
| Sortino Ratio | Downside risk-adjusted |
| Beta | Market correlation |
| Alpha | Excess return |
| Max Drawdown | Worst peak-to-trough |

### 2.5 Math Tool Use Cases (Task #18)

#### Students
- Homework calculations with step-by-step solutions
- Statistics problems with formula explanations
- Graphing functions and datasets
- Probability exercises

#### Business
- Financial statement analysis
- Ratio comparisons
- Break-even analysis
- Cash flow projections
- Variance analysis

#### Personal Finance
- Loan comparisons (car, home)
- Retirement planning
- Investment growth projections
- Budget analysis
- Tax estimation (SARS)

#### Data Analysts
- CSV data exploration
- Statistical summaries
- Correlation analysis
- Trend detection
- Anomaly identification

#### Forensic Accounting
- Benford's Law testing
- Transaction pattern analysis
- Red flag detection
- Audit sampling
- Network visualization

---

## 🖥️ PHASE 3: Display View Components

### 3.1 View Architecture

```
Math Tool Result → View Router → Appropriate Component
                       ↓
         Based on result.displayType
```

### 3.2 Display View Components

#### Task #19: Terminal View
```typescript
interface TerminalViewProps {
  lines: TerminalLine[];
  title?: string;
  showLineNumbers?: boolean;
  collapsible?: boolean;
}

interface TerminalLine {
  type: 'command' | 'output' | 'error' | 'info';
  content: string;
  timestamp?: string;
}

Features:
- Monospace font (JetBrains Mono / Fira Code)
- Syntax highlighting (Prism.js or highlight.js)
- Command prompt style ($ prefix)
- Copy button (individual line + all)
- Line numbers toggle
- Scrollable output container
- Collapsible sections (for long output)
- Dark/light theme support

Use Cases:
- Code execution output
- Step-by-step calculations
- Raw data dumps
- API response logs
- Shell command results
```

#### Task #20: Data Table
```typescript
interface DataTableProps {
  columns: ColumnDef[];
  data: Record<string, any>[];
  pagination?: boolean;
  pageSize?: number;
  sortable?: boolean;
  filterable?: boolean;
  exportable?: boolean;
}

Features:
- Sortable columns (click header)
- Pagination (10, 25, 50, 100 per page)
- Global search/filter input
- Column-specific filters
- Row highlighting on hover
- Sticky header on scroll
- Export button (CSV, Excel)
- Cell formatting:
  - Currency (R 1,234.56)
  - Percentage (12.34%)
  - Dates (relative: "2 days ago")
  - Numbers (thousand separators)
  - Status badges

Use Cases:
- CSV data display
- Query results
- Financial data tables
- Comparison matrices
- Audit logs
```

#### Task #21: Stat Cards
```typescript
interface StatCardGridProps {
  cards: StatCard[];
  columns?: 2 | 3 | 4;
}

interface StatCard {
  label: string;
  value: string | number;
  format?: 'number' | 'currency' | 'percent';
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  sparklineData?: number[];
  status?: 'success' | 'warning' | 'danger' | 'info';
  icon?: string;
}

Features:
- Grid layout (2-4 columns, responsive)
- Large number display
- Trend arrows (↑ green, ↓ red, → grey)
- Trend percentage/value
- Optional sparkline mini-chart
- Color-coded status borders/badges
- Icon badges (optional)
- Hover effects

Use Cases:
- Summary statistics (mean, median, etc.)
- KPI dashboards
- Financial summaries
- Performance metrics
- Health check results
```

#### Task #22: Formula/Math View
```typescript
interface FormulaViewProps {
  formula: string;  // LaTeX string
  steps?: FormulaStep[];
  variables?: Variable[];
  interactive?: boolean;
}

interface FormulaStep {
  description: string;
  formula: string;
  result?: string;
}

Features:
- KaTeX rendering (LaTeX math)
- Step-by-step derivation display
- Variable highlighting (different colors)
- Copy as LaTeX button
- Interactive variable inputs (sliders/fields)
- Real-time recalculation
- Responsive sizing
- Dark/light theme support

Use Cases:
- Mathematical proofs
- Formula explanations
- Step-by-step solutions
- Physics/chemistry equations
- Financial formula breakdowns
```

#### Task #23: Comparison View
```typescript
interface ComparisonViewProps {
  items: ComparisonItem[];
  metrics: MetricDef[];
  highlightBest?: boolean;
}

interface ComparisonItem {
  name: string;
  values: Record<string, any>;
}

Features:
- Side-by-side columns
- Diff highlighting (green better, red worse)
- Winner indicators (✓ badge)
- Percentage difference display
- Best value highlighting (bold/border)
- Responsive (stacks on mobile)
- Sticky first column
- Row grouping by category

Use Cases:
- Product comparison
- Before/after analysis
- A vs B scenarios
- Loan option comparison
- Investment alternatives
```

#### Task #24: Timeline View
```typescript
interface TimelineViewProps {
  events: TimelineEvent[];
  orientation?: 'vertical' | 'horizontal';
  showConnectors?: boolean;
}

interface TimelineEvent {
  date: string;
  title: string;
  description?: string;
  status?: 'completed' | 'current' | 'pending' | 'error';
  icon?: string;
  collapsible?: boolean;
}

Features:
- Vertical layout (default)
- Horizontal layout option
- Date/time markers
- Event cards with title + description
- Collapsible details (expand on click)
- Status indicators (colored dots)
- Connecting lines between events
- Responsive design

Use Cases:
- Historical data
- Project phases
- Audit trails
- Process tracking
- Event sequences
```

#### Task #25: Heatmap/Matrix View
```typescript
interface HeatmapViewProps {
  data: number[][];
  rowLabels: string[];
  colLabels: string[];
  colorScale?: 'sequential' | 'diverging';
  showValues?: boolean;
}

Features:
- Color-coded cells (gradient)
- Row/column labels
- Legend scale (min to max)
- Hover tooltips (value + coordinates)
- Zoom capability (large matrices)
- Cell click handler
- Color scale options:
  - Sequential (white → grey → black)
  - Diverging (red ← white → green)

Use Cases:
- Correlation matrices
- Confusion matrices
- Risk heat maps
- Activity patterns
- Portfolio exposure
```

#### Task #26: Alert Cards
```typescript
interface AlertCardProps {
  alerts: Alert[];
}

interface Alert {
  type: 'warning' | 'success' | 'info' | 'danger';
  title: string;
  message: string;
  severity?: 1 | 2 | 3;  // Low, Medium, High
  dismissible?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

Features:
- Colored borders/backgrounds by type
- Icon badges (⚠️ ✅ ℹ️ ❌)
- Dismissible (X button)
- Action buttons
- Severity levels (visual differentiation)
- Stacked layout
- Animation on appearance

Use Cases:
- Fraud detection alerts
- Validation results
- Recommendations
- Error summaries
- Compliance warnings
```

#### Task #27: Tree View
```typescript
interface TreeViewProps {
  nodes: TreeNode[];
  searchable?: boolean;
  defaultExpanded?: boolean;
}

interface TreeNode {
  id: string;
  label: string;
  icon?: string;
  children?: TreeNode[];
  metadata?: Record<string, any>;
}

Features:
- Collapsible tree nodes (▶/▼)
- Indent levels (visual hierarchy)
- Connecting lines (optional)
- Icons per node type
- Search within tree
- Expand all / Collapse all buttons
- Node click handler
- Lazy loading for large trees

Use Cases:
- Organizational charts
- File/folder structures
- Decision trees
- Category breakdowns
- Dependency graphs
```

#### Task #28: Progress/Gauge View
```typescript
interface ProgressViewProps {
  gauges: GaugeConfig[];
}

interface GaugeConfig {
  label: string;
  value: number;
  max: number;
  type: 'circular' | 'linear';
  showValue?: boolean;
  goal?: number;
  status?: 'success' | 'warning' | 'danger';
}

Features:
- Circular gauge (pie-style)
- Linear progress bar
- Goal indicator line
- Percentage label (center for circular)
- Animated fill on load
- Color by status/value ranges
- Responsive sizing
- Multiple gauges in grid

Use Cases:
- Completion percentages
- Scores/ratings
- Target achievement
- Health metrics
- Budget utilization
```

---

## 📁 File Structure (New/Modified)

```
gogga-frontend/src/
├── components/
│   ├── ChartRenderer.tsx           # Enhanced (existing)
│   ├── CSVUploader.tsx             # NEW
│   ├── CSVPreview.tsx              # NEW
│   └── display/                    # NEW folder
│       ├── index.ts                # Export all views
│       ├── TerminalView.tsx        # Task #19
│       ├── DataTable.tsx           # Task #20
│       ├── StatCards.tsx           # Task #21
│       ├── FormulaView.tsx         # Task #22
│       ├── ComparisonView.tsx      # Task #23
│       ├── TimelineView.tsx        # Task #24
│       ├── HeatmapView.tsx         # Task #25
│       ├── AlertCards.tsx          # Task #26
│       ├── TreeView.tsx            # Task #27
│       └── ProgressView.tsx        # Task #28
├── types/
│   ├── chart.ts                    # NEW - ChartData interface
│   └── display.ts                  # NEW - Display view types
└── lib/
    ├── toolHandler.ts              # Modified
    └── mathService.ts              # NEW - Math calculations

gogga-backend/app/
├── tools/
│   ├── definitions.py              # Modified
│   ├── executor.py                 # Modified
│   └── math_tool.py                # NEW
└── services/
    └── math_service.py             # NEW
```

---

## 🚀 Implementation Order

### Critical Path (Dependencies)

```
Task #16 (Dependencies)
    ↓
Task #13 (Enhanced Interface)
    ↓
┌───────────┼───────────┐
↓           ↓           ↓
#1-3        #5-7        #8-9
(UI Fixes)  (Charts)    (CSV)
    ↓           ↓           ↓
    └───────────┴───────────┘
                ↓
            Task #4 (Switcher)
                ↓
            Task #14 (Export)
                ↓
            Task #15 (Backend)
                ↓
┌───────────────┼───────────────┐
↓               ↓               ↓
#10-12          #19-21          #22-28
(Math Tool)     (Core Views)    (Advanced Views)
                ↓
            Task #17 (Memory)
                ↓
            Task #18 (Docs)
```

### Recommended Phase Sequence

| Phase | Tasks | Estimated Time | Deliverable |
|-------|-------|----------------|-------------|
| **1** | #16, #13 | 1 hour | Dependencies + Interface |
| **2** | #1, #2, #3 | 2 hours | Chart UI polish |
| **3** | #5, #6, #7 | 2 hours | New chart types |
| **4** | #4 | 1 hour | Type switcher |
| **5** | #8, #9 | 2 hours | CSV support |
| **6** | #14, #15 | 2 hours | Export + Backend |
| **7** | #10, #11, #12 | 4 hours | Math tool |
| **8** | #19, #20, #21 | 3 hours | Core display views |
| **9** | #22, #23, #24 | 3 hours | Advanced views |
| **10** | #25, #26, #27, #28 | 3 hours | Specialized views |
| **11** | #17, #18 | 1 hour | Documentation |

**Total Estimated Time**: ~24 hours

---

## 🎨 Design System (Monochrome)

### Colors
```css
--bg-primary: #ffffff;
--bg-secondary: #f5f5f5;
--bg-tertiary: #e5e5e5;
--text-primary: #1a1a1a;
--text-secondary: #666666;
--border: #d4d4d4;
--accent: #404040;

/* Status Colors (sparingly used) */
--success: #22c55e;
--warning: #eab308;
--danger: #ef4444;
--info: #3b82f6;
```

### Typography
```css
--font-display: 'Quicksand', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
--font-weight-normal: 400;
--font-weight-bold: 700;
```

### Spacing
```css
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;
--spacing-xl: 32px;
```

---

## ✅ Task Checklist

### Phase 1: Charts
- [ ] #1 - Fix Legend Placements
- [ ] #2 - HD Quality Charts
- [ ] #3 - Proper Chart Header
- [ ] #4 - Chart Type Switcher
- [ ] #5 - Add Stacked Bar Chart
- [ ] #6 - Add Stacked Line Chart
- [ ] #7 - Add Multi-Area Chart
- [ ] #8 - CSV Upload Support
- [ ] #9 - CSV Data Preview
- [ ] #13 - Enhanced ChartData Interface
- [ ] #14 - Export Options
- [ ] #15 - Update Tool Definitions
- [ ] #16 - Install Dependencies

### Phase 2: Math Tool
- [ ] #10 - Math Tool - Statistics
- [ ] #11 - Math Tool - Fraud Analysis
- [ ] #12 - Math Tool - Financial Formulas
- [ ] #18 - Math Tool Use Cases

### Phase 3: Display Views
- [ ] #19 - Display - Terminal View
- [ ] #20 - Display - Data Table
- [ ] #21 - Display - Stat Cards
- [ ] #22 - Display - Formula/Math
- [ ] #23 - Display - Comparison View
- [ ] #24 - Display - Timeline
- [ ] #25 - Display - Heatmap/Matrix
- [ ] #26 - Display - Alert Cards
- [ ] #27 - Display - Tree View
- [ ] #28 - Display - Progress/Gauge

### Phase 4: Documentation
- [ ] #17 - Write Memory Update

---

## 📝 Notes

### Tier Availability
- **FREE**: Charts (read-only, no CSV upload)
- **JIVE**: Charts + CSV upload + basic Math
- **JIGGA**: Full Math Tool + All Display Views + Export

### Performance Considerations
- Lazy load display components
- Virtualize large data tables (>1000 rows)
- Debounce interactive inputs
- Cache KaTeX renders
- Progressive chart rendering for large datasets

### Accessibility
- Keyboard navigation for all components
- Screen reader labels
- Sufficient color contrast
- Focus indicators
- ARIA roles and labels

---

*Document generated by GOGGA Development Team*  
*Last Updated: December 8, 2025*
