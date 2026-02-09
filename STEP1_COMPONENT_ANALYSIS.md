# Step 1: Component Analysis for tier3_horizontal.json ✅

## Configuration Overview
**Name:** Tier III Data Center - Horizontal Layout  
**Total Components:** 23 components  
**Simulation Duration:** 24 hours (86,400 seconds)

---

## Components Requiring CSV Data Columns

### 🔌 **GENERATION SOURCES** (7 components)

| ID | Component Name | Type | Rating | CSV Column Name | Data Type | Range/Behavior |
|----|----------------|------|--------|-----------------|-----------|----------------|
| comp-grid-1 | Utility Grid | utility-grid | 100 MW | `grid_power_mw` | Power (MW) | 0-100 MW, baseload with minor fluctuations |
| comp-gas-1 | Gas Gen 10MW #1 | gas-turbine-10mw | 10 MW | `gas1_power_mw` | Power (MW) | 0-10 MW, dispatchable (on-demand) |
| comp-gas-2 | Gas Gen 10MW #2 | gas-turbine-10mw | 10 MW | `gas2_power_mw` | Power (MW) | 0-10 MW, dispatchable (on-demand) |
| comp-gas-3 | Gas Gen 10MW #3 | gas-turbine-10mw | 10 MW | `gas3_power_mw` | Power (MW) | 0-10 MW, dispatchable (on-demand) |
| comp-wind-1 | Wind Type III | wind-turbine-type3 | 3 MW | `wind_power_mw` | Power (MW) | 0-3 MW, variable (weather-dependent) |
| comp-solar-1 | Solar PV | solar-pv | 2 MW | `solar_power_mw` | Power (MW) | 0-2 MW, solar curve (day/night) |
| comp-bess-1 | BESS | bess | 10 MWh | `bess_soc_percent` | State of Charge (%) | 20-100%, charges/discharges |
| comp-bess-1 | BESS | bess | 10 MW | `bess_power_mw` | Power (MW) | -10 to +10 MW, negative=charging |

### ⚡ **LOADS** (5 components)

| ID | Component Name | Type | Rating | CSV Column Name | Data Type | Range/Behavior |
|----|----------------|------|--------|-----------------|-----------|----------------|
| comp-critical-1 | Critical Load #1 | critical-load | 20 MW | `critical1_load_mw` | Power (MW) | 15-20 MW, high and stable |
| comp-critical-2 | Critical Load #2 | critical-load | 20 MW | `critical2_load_mw` | Power (MW) | 15-20 MW, high and stable |
| comp-hvac-1 | HVAC Load | hvac-load | 5 MW | `hvac_load_mw` | Power (MW) | 3-5 MW, varies with time of day |
| comp-aux-1 | Aux Loads | auxiliary-loads | 5 MW | `aux_load_mw` | Power (MW) | 2-4 MW, minor fluctuations |
| - | **Total Load** | (calculated) | 50 MW | `total_load_mw` | Power (MW) | Sum of all loads |

### 🔧 **INFRASTRUCTURE** (11 components - NO DATA)

These components are switches/breakers/buses - they don't generate data, they just pass power through:
- 1x HV Breaker (comp-hvbreaker-1)
- 8x LV Breakers (comp-lvbreaker-1 through comp-lvbreaker-8)
- 1x MV Bus (comp-mainbus-1)
- 2x UPS units (comp-ups-1, comp-ups-2)

**Note:** Breakers and buses will show binary state (open/closed) but don't need time-series CSV data.

---

## Proposed CSV Structure

### **File:** `tier3_horizontal.csv`

```csv
time_sec,grid_power_mw,gas1_power_mw,gas2_power_mw,gas3_power_mw,wind_power_mw,solar_power_mw,bess_soc_percent,bess_power_mw,critical1_load_mw,critical2_load_mw,hvac_load_mw,aux_load_mw,total_load_mw
0,15.2,8.5,8.5,0,1.2,0,85.0,-2.5,18.5,18.5,4.2,3.1,44.3
1,15.3,8.5,8.5,0,1.3,0,84.9,-2.4,18.5,18.6,4.2,3.1,44.4
...
86400,12.8,9.0,9.0,0,0.8,0,78.2,-1.8,19.2,19.1,3.8,2.9,45.0
```

### **Total Columns:** 14
- 1x Time column: `time_sec`
- 7x Generation columns: grid, gas1, gas2, gas3, wind, solar, bess_power
- 1x Storage column: bess_soc_percent
- 5x Load columns: critical1, critical2, hvac, aux, total

---

## Realistic Data Behavior Patterns

### **Time-of-Day Patterns:**

#### **Solar (solar_power_mw):**
- 00:00-06:00: 0 MW (night)
- 06:00-08:00: Ramp up 0 → 2 MW (sunrise)
- 08:00-16:00: 1.5-2.0 MW (peak daylight)
- 16:00-18:00: Ramp down 2 → 0 MW (sunset)
- 18:00-24:00: 0 MW (night)

#### **Wind (wind_power_mw):**
- Variable throughout day: 0.5-3.0 MW
- Higher at night: 1.5-2.5 MW
- Lower during day: 0.8-1.5 MW
- Random fluctuations every few minutes

#### **Grid (grid_power_mw):**
- Baseload: 10-20 MW constant
- Acts as "filler" to balance generation vs load
- Increases when renewables drop
- Decreases when renewables increase

#### **Gas Turbines (gas1/2/3_power_mw):**
- **Gas1:** Always on at 8-10 MW (primary)
- **Gas2:** Always on at 8-10 MW (primary)
- **Gas3:** On-demand 0-10 MW (peaker/backup)
- Quick ramp rates (can go 0→10 MW in seconds)

#### **BESS (bess_soc_percent, bess_power_mw):**
- **SOC:** 20-100%, starts at 85%
- **Charging (negative power):** When solar/wind high, load low
- **Discharging (positive power):** When solar/wind low, load high
- Rate: ±10 MW max

#### **Critical Loads (critical1/2_load_mw):**
- Very stable: 18-20 MW
- Small random fluctuations ±5%
- Never drops below 15 MW

#### **HVAC Load (hvac_load_mw):**
- Peak during day (hot): 4-5 MW (10:00-18:00)
- Lower at night (cool): 3-3.5 MW (22:00-06:00)
- Gradual transitions

#### **Aux Load (aux_load_mw):**
- Relatively constant: 2.5-3.5 MW
- Small random noise ±10%

### **Energy Balance:**
At all times: **Total Generation = Total Load**
```
(Grid + Gas1 + Gas2 + Gas3 + Wind + Solar + BESS) = Total Load
```

---

## Column Name Mapping for UI

When user selects components, we'll auto-suggest these columns:

| Component ID | Suggested Column |
|--------------|------------------|
| comp-grid-1 | grid_power_mw |
| comp-gas-1 | gas1_power_mw |
| comp-gas-2 | gas2_power_mw |
| comp-gas-3 | gas3_power_mw |
| comp-wind-1 | wind_power_mw |
| comp-solar-1 | solar_power_mw |
| comp-bess-1 | bess_soc_percent (primary) or bess_power_mw |
| comp-critical-1 | critical1_load_mw |
| comp-critical-2 | critical2_load_mw |
| comp-hvac-1 | hvac_load_mw |
| comp-aux-1 | aux_load_mw |

---

## Summary

✅ **Total Components:** 23  
✅ **Components with CSV data:** 12 (7 generation + 5 loads)  
✅ **CSV Columns:** 14 (1 time + 13 data columns)  
✅ **Simulation Duration:** 24 hours (86,400 seconds)  
✅ **Data Points per Column:** ~86,400 (1 per second) or ~1,440 (1 per minute)

**Recommendation:** Generate 1 data point per 10 seconds = 8,640 rows  
(Good balance between detail and file size)

---

## Next Step: Ready for Step 2

With this analysis complete, we can now proceed to **Step 2: Create Python Script** to generate the CSV with realistic data patterns.

**Would you like me to continue to Step 2?**
