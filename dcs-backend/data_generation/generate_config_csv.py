#!/usr/bin/env python3
"""
Generate Unified CSV for Configuration

Creates a single CSV file with time-series data for all components in a configuration.
Each configuration JSON gets one corresponding CSV with realistic power system behavior.

Usage:
    python generate_config_csv.py <config_name>
    
Example:
    python generate_config_csv.py tier3_horizontal
    
This will:
    1. Read sample_configs/tier3_horizontal.json
    2. Generate realistic data for all components
    3. Save to saved_csv/tier3_horizontal.csv
"""

import json
import csv
import os
import sys
import math
import random
from datetime import datetime

# Configuration
SAMPLE_CONFIGS_DIR = "sample_configs"
SAVED_CSV_DIR = "saved_csv"
SIMULATION_DURATION = 86400  # 24 hours in seconds
TIME_STEP = 60  # 1 data point per minute (1440 points total)


def generate_solar_curve(time_sec):
    """
    Generate realistic solar power curve
    - Night (0-6am, 6-midnight): 0 MW
    - Dawn (6-8am): Ramp up
    - Day (8am-4pm): Peak
    - Dusk (4-6pm): Ramp down
    
    Returns: power in MW (0-2 MW for 2MW rated system)
    """
    hour = time_sec / 3600.0
    
    if hour < 6 or hour >= 18:
        return 0.0  # Night
    elif 6 <= hour < 8:
        # Dawn ramp: 0 -> 2 MW
        progress = (hour - 6) / 2.0
        return 2.0 * progress * (1 + random.uniform(-0.05, 0.05))
    elif 8 <= hour < 16:
        # Peak day with clouds
        base = 2.0
        cloud_effect = random.uniform(-0.15, 0.05)
        return max(1.5, base * (1 + cloud_effect))
    elif 16 <= hour < 18:
        # Dusk ramp: 2 -> 0 MW
        progress = 1 - ((hour - 16) / 2.0)
        return 2.0 * progress * (1 + random.uniform(-0.05, 0.05))
    
    return 0.0


def generate_wind_curve(time_sec, prev_wind):
    """
    Generate realistic wind power with variability
    - Higher at night
    - Random walk with smoothing
    - Limited ramp rates
    
    Returns: power in MW (0-3 MW for 3MW rated system)
    """
    hour = time_sec / 3600.0
    
    # Base wind pattern: higher at night
    if 0 <= hour < 6 or 20 <= hour < 24:
        base_wind = random.uniform(1.8, 2.8)
    elif 6 <= hour < 10:
        base_wind = random.uniform(1.0, 2.0)
    elif 10 <= hour < 16:
        base_wind = random.uniform(0.8, 1.5)
    else:  # 16-20
        base_wind = random.uniform(1.2, 2.2)
    
    # Add random walk from previous value (smooth transitions)
    if prev_wind is not None:
        max_ramp = 0.1  # Max change per minute
        change = random.uniform(-max_ramp, max_ramp)
        new_wind = prev_wind + change
        # Weighted average with base wind to prevent drift
        wind = 0.7 * new_wind + 0.3 * base_wind
    else:
        wind = base_wind
    
    # Clamp to rated capacity
    return max(0.0, min(3.0, wind))


def generate_load_profile(time_sec, load_type, rating):
    """
    Generate realistic load profiles
    
    Args:
        time_sec: Current simulation time
        load_type: 'critical', 'hvac', or 'aux'
        rating: Maximum load in MW
    
    Returns: load in MW
    """
    hour = time_sec / 3600.0
    
    if load_type == 'critical':
        # Critical loads: very stable, 90-95% of rating
        base = rating * 0.925
        noise = random.uniform(-0.025, 0.025) * rating
        return base + noise
    
    elif load_type == 'hvac':
        # HVAC: peaks during day (cooling), lower at night
        if 6 <= hour < 10:
            # Morning ramp up
            progress = (hour - 6) / 4.0
            load_factor = 0.65 + 0.30 * progress
        elif 10 <= hour < 18:
            # Peak cooling hours
            load_factor = random.uniform(0.92, 0.98)
        elif 18 <= hour < 22:
            # Evening ramp down
            progress = 1 - ((hour - 18) / 4.0)
            load_factor = 0.65 + 0.30 * progress
        else:
            # Night: minimal cooling
            load_factor = random.uniform(0.60, 0.68)
        
        return rating * load_factor
    
    elif load_type == 'aux':
        # Auxiliary: relatively constant with small variations
        load_factor = random.uniform(0.55, 0.75)
        return rating * load_factor
    
    return 0.0


def generate_bess_behavior(time_sec, solar, wind, total_load, prev_soc, prev_power):
    """
    Generate BESS (Battery) behavior based on supply/demand balance
    
    Strategy:
    - Charge (negative power) when renewables high and load low
    - Discharge (positive power) when renewables low and load high
    - Maintain SOC between 20-100%
    
    Returns: (soc_percent, power_mw)
    """
    # Calculate renewable generation
    renewable_gen = solar + wind
    
    # Determine if we should charge or discharge
    # If renewables > 40% of load, try to charge
    # If renewables < 20% of load, discharge to help
    renewable_ratio = renewable_gen / total_load if total_load > 0 else 0
    
    if prev_soc is None:
        prev_soc = 85.0  # Start at 85% SOC
    if prev_power is None:
        prev_power = 0.0
    
    # SOC limits
    if prev_soc > 95:
        # Nearly full - stop charging
        target_power = max(0, prev_power * 0.5)
    elif prev_soc < 25:
        # Nearly empty - stop discharging
        target_power = min(0, prev_power * 0.5)
    else:
        # Normal operation
        if renewable_ratio > 0.5:
            # Excess renewables - charge
            charge_rate = -5.0 * (renewable_ratio - 0.5)
            target_power = max(-10, charge_rate)
        elif renewable_ratio < 0.3:
            # Low renewables - discharge
            discharge_rate = 5.0 * (0.3 - renewable_ratio)
            target_power = min(10, discharge_rate)
        else:
            # Moderate renewables - idle or slow charge
            target_power = -2.0
    
    # Smooth power transition (ramp rate limit)
    max_ramp = 2.0  # MW per minute
    power_change = target_power - prev_power
    power_change = max(-max_ramp, min(max_ramp, power_change))
    power = prev_power + power_change
    
    # Update SOC based on power
    # 10 MWh capacity, power in MW, time step in minutes
    time_step_hours = TIME_STEP / 3600.0
    energy_change = -power * time_step_hours  # Negative power = charging = SOC increase
    soc_change = (energy_change / 10.0) * 100.0  # 10 MWh capacity
    
    new_soc = prev_soc + soc_change
    new_soc = max(20.0, min(100.0, new_soc))  # Clamp to safe range
    
    return new_soc, power


def generate_gas_dispatch(total_load, grid, solar, wind, bess_power):
    """
    Dispatch gas turbines to meet remaining load
    
    Strategy:
    - Gas 1 & 2: Always on at ~85% (base load)
    - Gas 3: Peaker unit, on-demand
    - Total gas output = Load - Grid - Solar - Wind - BESS
    
    Returns: (gas1_mw, gas2_mw, gas3_mw)
    """
    # Calculate how much power is needed from gas
    other_generation = grid + solar + wind + bess_power
    gas_needed = total_load - other_generation
    
    # Gas 1 & 2: Base load units (always on at 8.5 MW each)
    gas1 = 8.5
    gas2 = 8.5
    
    # Gas 3: Peaker (fills the gap)
    gas3 = gas_needed - gas1 - gas2
    gas3 = max(0.0, min(10.0, gas3))  # Clamp to 0-10 MW
    
    return gas1, gas2, gas3


def generate_grid_power(total_load, gas_total, solar, wind, bess_power):
    """
    Grid acts as balancing source to ensure generation = load
    
    Returns: grid power in MW
    """
    total_generation = gas_total + solar + wind + bess_power
    grid_needed = total_load - total_generation
    
    # Clamp to grid capacity (0-100 MW)
    grid = max(0.0, min(100.0, grid_needed))
    
    return grid


def generate_config_csv(config_name):
    """
    Main function to generate CSV for a configuration
    
    Args:
        config_name: Name of the config (e.g., 'tier3_horizontal' or exact config name)
    """
    print(f"🔧 Generating CSV for configuration: {config_name}")
    print(f"=" * 60)
    
    # Load configuration JSON
    config_path = os.path.join(SAMPLE_CONFIGS_DIR, f"{config_name}.json")
    if not os.path.exists(config_path):
        print(f"❌ Error: Configuration file not found: {config_path}")
        sys.exit(1)
    
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    # Use the exact configuration name from the JSON for the CSV filename
    exact_config_name = config.get('name', config_name)
    
    print(f"✅ Loaded configuration: {exact_config_name}")
    print(f"📊 Generating {SIMULATION_DURATION / 3600:.0f} hours of data...")
    print(f"⏱️  Time step: {TIME_STEP} seconds")
    print(f"📈 Data points: {SIMULATION_DURATION // TIME_STEP}")
    print()
    
    # Prepare output CSV - use exact config name
    csv_filename = f"{exact_config_name}.csv"
    csv_path = os.path.join(SAVED_CSV_DIR, csv_filename)
    
    # Ensure output directory exists
    os.makedirs(SAVED_CSV_DIR, exist_ok=True)
    
    # Define column headers
    headers = [
        'time_sec',
        'grid_power_mw',
        'gas1_power_mw',
        'gas2_power_mw',
        'gas3_power_mw',
        'wind_power_mw',
        'solar_power_mw',
        'bess_soc_percent',
        'bess_power_mw',
        'critical1_load_mw',
        'critical2_load_mw',
        'hvac_load_mw',
        'aux_load_mw',
        'total_load_mw'
    ]
    
    # Generate data
    rows = []
    
    # State variables for continuity
    prev_wind = None
    prev_bess_soc = None
    prev_bess_power = None
    
    for time_sec in range(0, SIMULATION_DURATION + TIME_STEP, TIME_STEP):
        # Generate loads first (independent)
        critical1 = generate_load_profile(time_sec, 'critical', 20.0)
        critical2 = generate_load_profile(time_sec, 'critical', 20.0)
        hvac = generate_load_profile(time_sec, 'hvac', 5.0)
        aux = generate_load_profile(time_sec, 'aux', 5.0)
        total_load = critical1 + critical2 + hvac + aux
        
        # Generate renewables
        solar = generate_solar_curve(time_sec)
        wind = generate_wind_curve(time_sec, prev_wind)
        prev_wind = wind
        
        # BESS behavior
        bess_soc, bess_power = generate_bess_behavior(
            time_sec, solar, wind, total_load, 
            prev_bess_soc, prev_bess_power
        )
        prev_bess_soc = bess_soc
        prev_bess_power = bess_power
        
        # Dispatch gas turbines
        # For initial calculation, assume grid provides some base amount
        initial_grid = 15.0
        gas1, gas2, gas3 = generate_gas_dispatch(
            total_load, initial_grid, solar, wind, bess_power
        )
        gas_total = gas1 + gas2 + gas3
        
        # Calculate actual grid power needed (balancing)
        grid = generate_grid_power(total_load, gas_total, solar, wind, bess_power)
        
        # Create row
        row = {
            'time_sec': time_sec,
            'grid_power_mw': round(grid, 2),
            'gas1_power_mw': round(gas1, 2),
            'gas2_power_mw': round(gas2, 2),
            'gas3_power_mw': round(gas3, 2),
            'wind_power_mw': round(wind, 2),
            'solar_power_mw': round(solar, 2),
            'bess_soc_percent': round(bess_soc, 1),
            'bess_power_mw': round(bess_power, 2),
            'critical1_load_mw': round(critical1, 2),
            'critical2_load_mw': round(critical2, 2),
            'hvac_load_mw': round(hvac, 2),
            'aux_load_mw': round(aux, 2),
            'total_load_mw': round(total_load, 2)
        }
        
        rows.append(row)
    
    # Write CSV
    with open(csv_path, 'w', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)
    
    print(f"✅ CSV generated successfully!")
    print(f"📁 File: {csv_path}")
    print(f"📊 Rows: {len(rows)}")
    print(f"💾 Size: {os.path.getsize(csv_path) / 1024:.1f} KB")
    print()
    
    # Print sample data
    print("📈 Sample data (first 5 rows):")
    print("-" * 60)
    for i, row in enumerate(rows[:5]):
        if i == 0:
            print(f"{'Time':<8} {'Grid':<8} {'Solar':<8} {'Wind':<8} {'Load':<8}")
        hour = row['time_sec'] / 3600
        print(f"{hour:>6.1f}h  {row['grid_power_mw']:>6.2f}  "
              f"{row['solar_power_mw']:>6.2f}  {row['wind_power_mw']:>6.2f}  "
              f"{row['total_load_mw']:>6.2f}")
    
    print()
    print("✅ Step 2 Complete!")
    print(f"🚀 Ready for Step 3: Auto-load CSV in backend")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python generate_config_csv.py <config_name>")
        print("Example: python generate_config_csv.py tier3_horizontal")
        sys.exit(1)
    
    config_name = sys.argv[1]
    generate_config_csv(config_name)
