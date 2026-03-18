# The Formula Calculator: A User's Guide

*How to create computed columns from your simulation data—and where everything lives.*

---

## The Story

Imagine you're analyzing a data center power simulation. Your CSV has columns like `Pload_1 (MW)`, `P_BESS (MW)`, and `P_g1 (MW)`. You want to plot **load plus BESS power** as a single curve—but that's not a raw column. It's a *formula*: `Pload_1 (MW) + P_BESS (MW)`.

Before the Formula Calculator, you could only pick existing columns. Now you can **build formulas** that combine, transform, or compute new values from your data—and use them in charts just like any other column.

---

## Where Things Live

### 1. The Raw Data (CSV)

Your simulation produces a `.data.csv` file, for example:

```
dcs-backend/designs/halfblock/HalfBlock.data.csv
```

This file has one row per time step and one column per variable. Example columns:

| Time (s) | Pload_1 (MW) | P_BESS (MW) | P_g1 (MW) | ... |
|----------|--------------|-------------|-----------|-----|
| 0.0      | 15.21        | -0.03       | 7.61      | ... |
| 0.001    | 15.29        | 0.02        | 7.64      | ... |

**The CSV is never modified.** Formulas are computed in memory when you load the simulation.

---

### 2. The Configuration (`.sim.json`)

Each design has a `.sim.json` file that stores chart settings *and* your formulas:

```
dcs-backend/designs/halfblock/HalfBlock.sim.json
```

Formulas live under `derived_variables`:

```json
{
  "display_name": "Halfblock",
  "derived_variables": [
    {
      "name": "Comp_L_B",
      "formula": "Pload_1 (MW) + P_BESS (MW)"
    },
    {
      "name": "C2",
      "formula": "Pload_1 (MW) +  P_BESS (MW)"
    }
  ],
  "charts_to_display": [ ... ]
}
```

- **`name`**: The label you give your formula (e.g. `Comp_L_B`, `Total Power`).
- **`formula`**: The expression, using column names exactly as they appear in the CSV.

When you add a formula, it's saved here. When you load a configuration, these formulas are read and applied.

---

### 3. The UI: Simulation Chart Builder

When you load a simulation and open the chart builder, you see:

1. **Columns** (left): All available columns—both raw CSV columns and your derived variables.
2. **Plot types** (right): 2D Plot, nD Plot, Stacked nD, Histogram, etc.
3. **Formula Builder** button (ƒ): Opens the calculator to create a new formula.

Derived variables are marked with a **ƒ** badge and show their formula on hover.

---

## How to Use the Formula Calculator

### Step 1: Open the Calculator

1. Load a simulation (e.g. HalfBlock).
2. In the chart builder, pick a plot type: **2D Plot**, **nD Plot**, or **Stacked nD**.
3. Click **ƒ Formula Builder**.

A modal opens with a calculator-style interface.

---

### Step 2: Build Your Formula

You can type directly in the formula field or use the buttons:

| Input | How |
|-------|-----|
| **Numbers** | Click 0–9 or type |
| **Operators** | +, −, ×, ÷, ^ (power) |
| **Parentheses** | ( ) |
| **Functions** | sqrt, abs, sin, cos, log, exp, min, max |
| **Variables** | Click a column name (e.g. `Pload_1 (MW)`) to insert it |

**Example:** To compute load plus BESS power:

1. Click `Pload_1 (MW)` → it appears in the formula.
2. Click `+`.
3. Click `P_BESS (MW)`.

Result: `Pload_1 (MW) + P_BESS (MW)`.

**Another example:** Square root of load:

1. Click `sqrt`.
2. Click `Pload_1 (MW)`.
3. The cursor lands between the parentheses: `sqrt(|)` → type or click the variable.

Result: `sqrt(Pload_1 (MW))`.

---

### Step 3: Name Your Variable

1. Click **Done**.
2. A second step asks for a **name** (e.g. `Comp_L_B`, `Total Power`, `Load+BESS`).
3. Enter a name and click **Add variable**.

The formula is saved, and the new variable appears in the column list with a ƒ badge.

---

### Step 4: Use It in a Chart

Your derived variable is now a normal column. Pick it as X or Y when building a chart:

- **2D Plot**: X = Time (s), Y = Comp_L_B.
- **nD Plot**: X = Time (s), Y = Pload_1, P_BESS, Comp_L_B.
- **Stacked nD**: Same idea—add it to the Y columns.

---

## Supported Formula Syntax

| Element | Example |
|---------|---------|
| Column names | `Pload_1 (MW)`, `P_BESS (MW)` |
| Arithmetic | `+`, `-`, `*`, `/`, `^` (power) |
| Functions | `sqrt(x)`, `abs(x)`, `sin(x)`, `cos(x)`, `log(x)`, `exp(x)`, `min(a,b)`, `max(a,b)` |
| Parentheses | `( ... )` |

Column names must match the CSV headers exactly (including spaces and units).

---

## The Journey of Data

```
┌─────────────────────────────────────────────────────────────────────────┐
│  1. CSV on disk                                                           │
│     HalfBlock.data.csv                                                    │
│     Columns: Time (s), Pload_1 (MW), P_BESS (MW), ...                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  2. Load simulation                                                       │
│     App reads CSV + HalfBlock.sim.json                                    │
│     derived_variables: [{ name: "Comp_L_B", formula: "Pload_1 + P_BESS" }]│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  3. Augment rows (formulaEvaluator.js)                                    │
│     For each row: evaluate formula using row values                       │
│     Row: { "Pload_1 (MW)": 15.21, "P_BESS (MW)": -0.03 }                 │
│     → Comp_L_B = 15.21 + (-0.03) = 15.18                                 │
│     Augmented row: { ..., "Comp_L_B": 15.18 }                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  4. Charts receive augmented data                                        │
│     Comp_L_B is just another column—plot it like any other               │
└─────────────────────────────────────────────────────────────────────────┘
```

**When you add a new formula:**

1. You build it in the Formula Calculator.
2. You name it (e.g. `Comp_L_B`).
3. `handleAddDerivedVariable` in App.js:
   - Appends it to `derived_variables`.
   - Re-augments `simulationData` with the new column.
   - Persists to `.sim.json` via `persistChartsToSimJson`.

---

## File Reference

| File | Role |
|------|------|
| `dcs-ui/src/components/FormulaCalculator/FormulaCalculator.jsx` | Calculator modal UI |
| `dcs-ui/src/components/SimulationChartBuilder/SimulationChartBuilder.jsx` | Chart builder; shows ƒ button, column list, opens calculator |
| `dcs-ui/src/utils/formulaEvaluator.js` | Evaluates formulas row-by-row; `augmentRowsWithDerived()` |
| `dcs-ui/src/App.js` | Loads `derived_variables`, augments data, `handleAddDerivedVariable`, persists to backend |
| `dcs-backend/designs/<design>/<Design>.sim.json` | Stores `derived_variables` and chart config |
| `dcs-backend/designs/<design>/<Design>.data.csv` | Raw simulation data (never modified) |

---

## Tips

- **Exact names**: Use column names exactly as in the CSV (e.g. `Pload_1 (MW)` with the space and units).
- **Hover for formula**: In the column list, hover over a ƒ variable to see its formula.
- **Reuse**: Once saved, a formula is available for all chart types in that configuration.
- **Persistence**: Formulas are stored in `.sim.json` and survive reloads and configuration switches.
