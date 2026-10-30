# Profitlo: AI-based small-business profit planner

**Live app: https://notoriouskapil.github.io/profitlo/**

**B.Tech FLB Project.** Profitlo helps someone planning a small business estimate:

- how much money they need to start (one-time startup investment)
- what one product costs to make and sell
- a suggested selling price for a target margin
- expected monthly revenue, costs and profit or loss
- the break-even point and payback period

It also includes what-if scenarios and AI insights: a rule-based engine that scores the plan's health and suggests what to fix first.

All figures are **estimates** based on the user's inputs. They are not guaranteed results or financial advice.

---

## Tech stack

| Part | Used |
|---|---|
| Markup | Semantic HTML5, ARIA tabs, labelled form fields |
| Styling | CSS3 (custom properties, Grid, Flexbox), light and dark themes, print stylesheet |
| Logic | Plain JavaScript (ES2020), no framework, no build step |
| Charts | Hand-built SVG charts (no chart library, so they work offline) |
| AI insights | On-device rule-based expert system (`js/insights.js`) |
| Storage | `localStorage`, only in the user's own browser |
| Backend / API keys | None |

Fonts load from Google Fonts. Without internet the app falls back to system fonts and still works.

## How to run

For step-by-step instructions, including downloading from GitHub and troubleshooting, see **[HOW_TO_RUN.md](HOW_TO_RUN.md)**.

**Option 1: open the file.** Double-click `index.html`. It opens in any modern browser (Chrome, Edge, Firefox, Safari).

**Option 2: local server (recommended for demos).**

```bash
cd profitlo
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

**Run the calculation tests** (needs Node.js 16 or newer):

```bash
node tests/run-tests.js
```

## Project structure

```
profitlo/
├── index.html          # Page shell, navigation tabs, home page, planner layout
├── css/styles.css      # Theme tokens, layout, components, dark mode, print
├── js/calculator.js    # All formulas: pure functions, commented, unit-tested
├── js/samples.js       # 3 demo businesses (profit, loss, under-priced)
├── js/charts.js        # SVG charts: bars, break-even lines, donuts, cash flow, gauge
├── js/insights.js      # AI insights engine: health score + recommendations
├── js/app.js           # UI: tabs/routing, form, validation, rendering, scenarios
└── tests/run-tests.js  # 15 tests covering profit, loss, invalid and edge cases
```

## Tabs

1. **Home.** What the app does, plus one-click sample businesses.
2. **Planner.** A 4-step form (Business Setup, Product Costs, Monthly Expenses, Sales & Pricing) with hints, validation, a live estimate, and Reset and Calculate buttons.
3. **Dashboard.** Six key figures, a profit or loss banner, warnings, and these visuals:
   - revenue vs cost chart
   - break-even chart (hover to explore)
   - cost and investment breakdowns
   - 12-month cash position
   - a monthly P&L statement
4. **Scenarios.** Sliders for price, sales and costs. Also includes:
   - presets (pessimistic, optimistic, and others)
   - a plan vs scenario table
   - a price × sales sensitivity grid
   - saved scenarios
5. **AI Insights.** A health score from 0 to 100, how much capital to arrange, risks and recommendations, and which change helps profit most.
6. **How it works.** Every formula, worked through with the user's own numbers, plus a glossary.

## Formulas

| Result | Formula |
|---|---|
| Variable cost per unit | sum of per-unit costs (materials + packaging + labour + delivery + other) |
| Revenue | selling price × units sold |
| Monthly total cost | fixed costs + (variable cost per unit × units) + fees + tax (fees and tax are a % of revenue) |
| Monthly profit / loss | revenue − monthly total cost |
| Profit margin | profit ÷ revenue × 100 (only when revenue > 0) |
| Startup investment | one-time startup costs + initial inventory units × variable cost per unit |
| Break-even units | fixed costs ÷ (price − variable cost per unit − fees & tax per unit), rounded up |
| Suggested price | (variable cost + fixed ÷ units) ÷ (1 − fee% − tax% − target margin%) |
| Payback period | startup investment ÷ monthly profit |

With 0% fees and tax, break-even is exactly *fixed costs ÷ (price − variable cost)*.

**Safe handling of inputs:**

- Empty fields count as 0.
- Text, negative values and percentages above 100 are flagged next to the field.
- Nothing divides by zero. Margin shows "—" when revenue is 0, and break-even shows "Not reachable" when a sale doesn't cover its own cost.
- If the price is below the cost per unit, the dashboard shows a clear warning.
