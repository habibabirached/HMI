# Designs Directory (Preferred Structure)

Each design has one directory. The directory name is the sanitized design name (lowercase, underscores).

## Structure
```
designs/
  {design_dir}/
    {design_dir}.conf.json     # Design config (canvas, connections)
    {SimName}.sim.json         # Per-simulation config (charts, event_markers)
    {SimName}.data.csv         # Per-simulation data
```

## File Naming
- Design config: `designname.conf.json`
- Sim config: `LowVoltageRideThrough.sim.json` (use display name, no spaces)
- Sim data: `LowVoltageRideThrough.data.csv`

All files for a design live in one directory.

## Replenish Database from Designs

To wipe the database and repopulate it from design directories:

```bash
cd dcs-backend
python scripts/replenish_from_design.py
```

This wipes all tables and creates Configuration records from `designs/lm2500_bess_integrated_power_node/`.

To replenish from a specific design dir:
```bash
python scripts/replenish_from_design.py lm2500_bess_integrated_power_node
```

To replenish from all design dirs:
```bash
python scripts/replenish_from_design.py .
```

To add designs without wiping (keep existing data):
```bash
python scripts/replenish_from_design.py lm2500_bess_integrated_power_node --no-wipe
```

**Via Docker** (if running backend in containers):
```bash
docker compose -f docker-compose-dev.yml exec dcs-backend python scripts/replenish_from_design.py
```
