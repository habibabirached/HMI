# Design Restructure – End-to-End Test Checklist

## Prerequisites
- Backend running (Docker or `uvicorn app:app --port 5000`)
- Frontend running (Docker or `npm start`)
- LM2500 design loaded in DB (from migration)

## 1. Load Design (Config Only)
- [ ] Load "LM2500-BESS-Integrated-Power-Node" from Load Design
- [ ] Canvas shows components
- [ ] Simulation Scenarios section shows 3 buttons: Torsional Vibration, Low-Voltage Ride-Through, Small-Signal Perturbation
- [ ] No data loaded yet (no alert about CSV)

## 2. Run Simulation (Per-Sim Data)
- [ ] Click "▶️ Low-Voltage Ride-Through"
- [ ] Charts appear (Bus Voltage, Bus Frequency, etc.)
- [ ] Data plays (Start Simulation, adjust speed)
- [ ] Event markers visible (red LVRT, green BESS)

## 3. Save As (Copy Design Dir)
- [ ] Load LM2500 design
- [ ] Click "Save As", enter new name e.g. "LM2500-Copy"
- [ ] Save succeeds
- [ ] Check `designs/lm2500_copy/` exists with .conf.json, .sim.json, .data.csv files
- [ ] Load "LM2500-Copy" – simulation buttons work, data plays

## 4. Upload Simulation Data (Design Dir)
- [ ] Load a design with design dir (e.g. LM2500)
- [ ] Click 📤 next to a simulation button
- [ ] Select a valid CSV file
- [ ] Upload succeeds, alert shows row count
- [ ] Run that simulation – new data appears

## API Smoke Tests (Optional)
```bash
# List simulations for LM2500
curl http://localhost:5000/api/designs/LM2500-BESS-Integrated-Power-Node/simulations

# Load simulation data
curl http://localhost:5000/api/designs/LM2500-BESS-Integrated-Power-Node/simulations/LowVoltageRideThrough
```
