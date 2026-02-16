# Design Restructure Plan – Per-Design Directories

## Story Summary

Restructure data storage so each design has **one directory** containing all its files.  
When loading a design, only the config is loaded.  
When the user clicks a simulation button, that simulation’s config and data are loaded.

---

## Target Structure

```
dcs-backend/
  designs/                           # Root for all design data
    design01/
      design01.conf.json              # Design config (canvas, connections)
      LowVoltageRideThrough.sim.json  # Sim config (charts, event_markers)
      LowVoltageRideThrough.data.csv  # Sim data (this sim only)
      TorsionalVibration.sim.json
      TorsionalVibration.data.csv
      SmallSignalPerturbation.sim.json
      SmallSignalPerturbation.data.csv
    lm2500_bess_integrated_power_node/
      lm2500_bess_integrated_power_node.conf.json
      LowVoltageRideThrough.sim.json
      LowVoltageRideThrough.data.csv
      ...
```

**Naming rules:**
- Design dir: sanitized design name (lowercase, spaces→underscores, e.g. `lm2500_bess_integrated_power_node`)
- Config: `{design_name}.conf.json`
- Sim config: `{SimDisplayName}.sim.json` (e.g. `LowVoltageRideThrough.sim.json`)
- Sim data: `{SimDisplayName}.data.csv`

**Behavior:**
1. Load design → load only `designname.conf.json` → show canvas, list simulation buttons (from dir or manifest)
2. Click sim button → load `SimName.sim.json` + `SimName.data.csv` → run simulation
3. Save → write config to design dir
4. Save As → copy full design dir to new name, duplicate config in DB

---

## Step Plan (Revise after Step 4 if needed)

| Step | Goal | Test |
|------|------|------|
| **1** | Document current data flow (save, load, CSV, sim_config) | None – documentation only |
| **2** | Document current DB schema and APIs | None – documentation only |
| **3** | Define new structure and DB schema | None – design doc only |
| **4** | Create `designs/` root and one design dir with placeholder files | ✅ Done – see Step 4 complete below |
| **5** | Add `design_dir` (or similar) to Configuration, update save to write to design dir | ✅ Done – save writes to designs/{dir}/{dir}.conf.json |
| **6** | API: List simulations for a design (from dir) | ✅ Done – GET /api/designs/{name}/simulations |
| **7** | API: Load simulation (design + sim name → .sim.json + .data.csv) | ✅ Done – GET /api/designs/{name}/simulations/{sim} |
| **8** | Split current unified CSV generator into per-sim CSVs | ✅ Done – migrate script |
| **9** | Migrate LM2500 design to new structure | ✅ Done – designs/lm2500_bess_integrated_power_node |
| **10** | Update Load Design API – config only when design dir | ✅ Done – csv_status.use_design_dir, available_simulations |
| **11** | Update frontend: Load design loads config only, discovers sims | ✅ Done – use available_simulations |
| **12** | Update frontend: Run simulation calls new API, uses per-sim data | ✅ Done – GET /api/designs/…/simulations/{id} |
| **13** | Save As: copy design dir + new config record | ✅ Done – source_name in save, copy_design_dir |
| **14** | Update CSV upload for per-sim flow (upload → assign to design+sim) | ✅ Done – POST .../simulations/{id}/data, 📤 button |
| **15** | designs/ is source of truth for all data | ✅ Done |
| **16** | End-to-end tests | ✅ Done – DESIGN_RESTRUCTURE_TEST_CHECKLIST.md |
| **17–20** | Edge cases, error handling, polish | ✅ Done – see below |

### Steps 17–20 Complete
- **Error handling:** CSV upload validates .csv extension, UTF-8; friendly 404 for missing design/sim
- **Polish:** Refetch simulations after upload; handle empty `available_simulations`; auto-create .sim.json when uploading data for new sim
- **Edge cases:** safe_sim fallback for empty; copy design dir skips conf.json (creates fresh)

---

## Step 3 Complete: New Structure Design

### Directory Layout (Final)
```
designs/
  {design_dir}/                    # e.g. lm2500_bess_integrated_power_node
    {design_dir}.conf.json         # Design config (canvas, connections)
    {SimName}.sim.json             # Per-sim config (charts, event_markers)
    {SimName}.data.csv             # Per-sim data (no simulation column needed)
```

### Naming Sanitization
- **Design name → dir:** lowercase, spaces→underscores, remove special chars → `lm2500_bess_integrated_power_node`
- **Sim display name → filename:** remove spaces, special chars → `LowVoltageRideThrough`

### DB Schema (Proposed – Minimal Change)
- **Keep** `Configuration` table
- **CSV and sim config:** Per-design files only (designs/{dir}/{sim}.sim.json, {sim}.data.csv); no DB storage

### New APIs (Proposed)
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/designs/{name}/config | Load config from design dir |
| GET | /api/designs/{name}/simulations | List sims (from *.sim.json in dir) |
| GET | /api/designs/{name}/simulations/{sim_name} | Load .sim.json + .data.csv |
| POST | /api/save | Save config to design dir |
| POST | /api/save-as | Copy design dir, new config record |

---

## Step 4 Complete: Directory Structure Created

**Created:**
```
dcs-backend/designs/
  README.md
  design01/
    design01.conf.json
    ExampleSimulation.sim.json
    ExampleSimulation.data.csv
```

**Changes:**
- `app.py` startup: creates `designs/` dir if missing
- `Dockerfile`: `RUN mkdir -p /app/designs`
- `design01` is a minimal test design for validation

**Test:** Run backend, confirm `designs/` and `designs/design01/` exist; list files.

---

## Step 5 Complete: Save Writes to Design Dir

**Added:**
- `sanitize_design_name(name)` → `lm2500_bess_integrated_power_node`
- `save_config_to_design_dir(name, description, data)` → writes to `designs/{dir}/{dir}.conf.json`
- Save endpoint (create + update) now calls `save_config_to_design_dir` after DB write

**File format:** `{ name, description, canvasComponents, connections, systemState }`

**Test:** Save a config (new or update) from UI, check `designs/{sanitized_name}/` exists with .conf.json.

---

## File Naming Reference

| Type | Example |
|------|---------|
| Design dir | `lm2500_bess_integrated_power_node` |
| Design config | `lm2500_bess_integrated_power_node.conf.json` |
| Sim config | `LowVoltageRideThrough.sim.json` |
| Sim data | `LowVoltageRideThrough.data.csv` |

**Sanitization:**
- Design name → dir: lowercase, replace spaces/special chars with `_`
- Sim display name → filename: remove spaces, special chars (e.g. `Low-Voltage Ride-Through` → `LowVoltageRideThrough`)

---

*Plan created: Feb 2026. Revise after Step 4 if code structure differs.*
