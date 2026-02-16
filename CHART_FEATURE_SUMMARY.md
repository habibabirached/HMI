# Real-Time 2D Plotting Feature - Implementation Summary

## Current Design-Dir Flow

Charts and simulation data live in the design directory:

- **Per-simulation config:** `{SimName}.sim.json` defines charts, event markers
- **Per-simulation data:** `{SimName}.data.csv` holds time-series data
- **Upload:** Use the 📤 button next to a simulation to upload CSV data for that simulation
- **Persistence:** Charts are stored in `.sim.json`; no database tables for CSV or chart associations

## Completed Features

### Chart Display
- Right-click context menu on components for chart types
- Chart buttons on components (2D, Histogram, Pie, etc.)
- Resizable bottom chart panel
- Multiple charts per component
- Event markers from simulation config
- Charts defined in design dir `.sim.json` files

### Design Dir Structure
- Each design has `designs/{dir}/` with `.conf.json`, `.sim.json`, `.data.csv`
- Load design → config + available simulations from design dir
- Run simulation → load `.sim.json` + `.data.csv` for that sim

### User Experience
- Professional HMI dark theme
- Smooth animations
- Resizable chart panel

---

**Status**: Design-dir flow complete. All data in `designs/`.

**Date**: February 2026
