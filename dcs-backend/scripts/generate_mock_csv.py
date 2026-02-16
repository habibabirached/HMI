"""
MOCK CSV DATA GENERATOR

Generates realistic 24-hour time-series data for:
1. Solar power output (correlated with time of day)
2. Wind power output (stochastic with persistence)
3. Data center load (diurnal pattern with variations)

These CSVs simulate what would come from real PSCAD simulations or SCADA systems.
"""

import csv
import math
import os
import random

# Output to designs/mock_data/ (one "design" with solar, wind, load sims)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
MOCK_DESIGN_DIR = os.path.join(BACKEND_DIR, "designs", "mock_data")
os.makedirs(MOCK_DESIGN_DIR, exist_ok=True)

# Configuration
HOURS_PER_DAY = 24
SECONDS_PER_HOUR = 3600
TIME_STEP = 10  # seconds (10-second resolution)
TOTAL_SECONDS = HOURS_PER_DAY * SECONDS_PER_HOUR
NUM_POINTS = TOTAL_SECONDS // TIME_STEP  # 8,640 data points

print(f"📊 Generating mock CSV data...")
print(f"   Resolution: {TIME_STEP} seconds")
print(f"   Duration: {HOURS_PER_DAY} hours")
print(f"   Data points: {NUM_POINTS:,}")
print()

# ============================================================================
# 1. SOLAR POWER - Realistic day/night cycle
# ============================================================================

def generate_solar_power(time_sec):
    """
    Generate realistic solar power output.
    
    Pattern:
    - Nighttime (0-6h, 18-24h): 0 MW (no sun)
    - Sunrise (6-10h): Gradual increase 0 → 10 MW
    - Midday (10-14h): Peak ~10 MW
    - Sunset (14-18h): Gradual decrease 10 → 0 MW
    
    Includes:
    - Cloud cover (random dips)
    - Atmospheric effects (slight variations)
    """
    hour = (time_sec / SECONDS_PER_HOUR) % 24
    
    # No sun at night
    if hour < 6 or hour >= 18:
        return 0.0, 0.0
    
    # Daytime: sine wave centered at noon (12h)
    # Map 6h-18h to 0-π for smooth sunrise/sunset
    daylight_progress = (hour - 6) / 12  # 0 to 1 from sunrise to sunset
    base_power = math.sin(daylight_progress * math.pi) * 10.0  # 0-10 MW
    
    # Add cloud cover (random dips, more frequent in afternoon)
    cloud_probability = 0.15 if hour < 12 else 0.25
    if random.random() < cloud_probability:
        cloud_reduction = random.uniform(0.1, 0.4)  # 10-40% reduction
        base_power *= (1 - cloud_reduction)
    
    # Add small atmospheric variations
    atmospheric_noise = random.gauss(0, 0.1)  # ±0.1 MW noise
    
    power = max(0, base_power + atmospheric_noise)
    
    # Add irradiance estimate (W/m²)
    irradiance = power * 100 if power > 0 else 0  # Rough conversion
    
    return power, irradiance


solar_data = []
print("☀️  Generating solar_24hr_realistic.csv...")

with open(os.path.join(MOCK_DESIGN_DIR, 'Solar.data.csv'), 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['time_sec', 'hour_of_day', 'power_mw', 'irradiance_w_m2'])
    
    for i in range(NUM_POINTS):
        time_sec = i * TIME_STEP
        hour = (time_sec / SECONDS_PER_HOUR) % 24
        power, irradiance = generate_solar_power(time_sec)
        
        writer.writerow([
            time_sec,
            round(hour, 2),
            round(power, 3),
            round(irradiance, 1)
        ])
        solar_data.append(power)

print(f"   ✅ Generated {NUM_POINTS:,} solar data points")
print(f"   📈 Peak power: {max(solar_data):.2f} MW")
print()

# ============================================================================
# 2. WIND POWER - Stochastic with persistence
# ============================================================================

def generate_wind_power(prev_power, hour):
    """
    Generate realistic wind power output.
    
    Pattern:
    - Nighttime: Higher winds (8-14 MW)
    - Daytime: Lower winds (4-8 MW)
    - Random walk with mean reversion
    - Persistence (gradual changes, not jumpy)
    
    Wind is inversely correlated with solar (higher at night).
    """
    # Target power based on time of day
    if hour < 6 or hour >= 18:
        target = 11.0  # Night: higher winds
    elif 10 <= hour < 14:
        target = 5.5   # Midday: lower winds
    else:
        target = 8.0   # Morning/afternoon: medium winds
    
    # Random walk component
    change = random.gauss(0, 0.3)  # ±0.3 MW per step
    
    # Mean reversion (pull toward target)
    reversion_strength = 0.02
    reversion = (target - prev_power) * reversion_strength
    
    # Update power
    new_power = prev_power + change + reversion
    
    # Clamp to realistic limits (0-15 MW)
    new_power = max(0.0, min(15.0, new_power))
    
    # Wind speed estimate (mph) - rough conversion
    wind_speed = math.sqrt(new_power * 10) if new_power > 0 else 0
    
    return new_power, wind_speed


wind_data = []
print("💨 Generating wind_24hr_realistic.csv...")

wind_power = 7.5  # Start at medium power

with open(os.path.join(MOCK_DESIGN_DIR, 'Wind.data.csv'), 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['time_sec', 'hour_of_day', 'power_mw', 'wind_speed_mph'])
    
    for i in range(NUM_POINTS):
        time_sec = i * TIME_STEP
        hour = (time_sec / SECONDS_PER_HOUR) % 24
        wind_power, wind_speed = generate_wind_power(wind_power, hour)
        
        writer.writerow([
            time_sec,
            round(hour, 2),
            round(wind_power, 3),
            round(wind_speed, 2)
        ])
        wind_data.append(wind_power)

print(f"   ✅ Generated {NUM_POINTS:,} wind data points")
print(f"   📈 Average power: {sum(wind_data)/len(wind_data):.2f} MW")
print(f"   📈 Peak power: {max(wind_data):.2f} MW")
print()

# ============================================================================
# 3. DATA CENTER LOAD - Diurnal pattern with variations
# ============================================================================

def generate_datacenter_load(time_sec):
    """
    Generate realistic data center load.
    
    Pattern:
    - Base load: 40 MW (always present)
    - Nighttime: Lower (35-38 MW) - reduced workload
    - Business hours: Higher (42-45 MW) - peak workload
    - Smooth transitions
    - Small random variations (cooling, workload spikes)
    """
    hour = (time_sec / SECONDS_PER_HOUR) % 24
    
    # Base load
    base = 40.0
    
    # Diurnal pattern (business hours have higher load)
    if 8 <= hour < 18:
        # Business hours: higher load
        daily_variation = 4.0
    elif hour < 6 or hour >= 22:
        # Deep night: lower load
        daily_variation = -3.0
    else:
        # Transition hours
        if hour < 8:
            # Morning ramp-up
            progress = (hour - 6) / 2
            daily_variation = -3.0 + progress * 7.0
        else:
            # Evening ramp-down
            progress = (hour - 18) / 4
            daily_variation = 4.0 - progress * 7.0
    
    # Small random workload spikes
    workload_noise = random.gauss(0, 0.5)  # ±0.5 MW
    
    # Cooling load variations (correlated with outside temperature)
    # Assume temperature follows: hot at 3pm, cool at 3am
    temp_hour = hour - 15  # Peak heat at hour 15 (3pm)
    cooling_variation = math.sin((temp_hour / 24) * 2 * math.pi) * 1.0
    
    load = base + daily_variation + workload_noise + cooling_variation
    
    # Clamp to realistic limits
    load = max(30.0, min(50.0, load))
    
    # Utilization percentage (relative to 50 MW max capacity)
    utilization = (load / 50.0) * 100
    
    return load, utilization


load_data = []
print("💡 Generating load_24hr_datacenter.csv...")

with open(os.path.join(MOCK_DESIGN_DIR, 'Load.data.csv'), 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['time_sec', 'hour_of_day', 'load_mw', 'utilization_pct'])
    
    for i in range(NUM_POINTS):
        time_sec = i * TIME_STEP
        hour = (time_sec / SECONDS_PER_HOUR) % 24
        load, utilization = generate_datacenter_load(time_sec)
        
        writer.writerow([
            time_sec,
            round(hour, 2),
            round(load, 3),
            round(utilization, 1)
        ])
        load_data.append(load)

print(f"   ✅ Generated {NUM_POINTS:,} load data points")
print(f"   📈 Average load: {sum(load_data)/len(load_data):.2f} MW")
print(f"   📈 Peak load: {max(load_data):.2f} MW")
print()

# ============================================================================
# SUMMARY
# ============================================================================

print("=" * 60)
print("✅ Mock CSV generation complete!")
print("=" * 60)
print()
print("Generated files:")
print("  1. designs/mock_data/Solar.data.csv")
print("  2. designs/mock_data/Wind.data.csv")
print("  3. designs/mock_data/Load.data.csv")
print()
print("Key patterns:")
print("  ☀️  Solar: 0 MW at night, peak ~10 MW at noon")
print("  💨 Wind: Higher at night (8-14 MW), lower at noon (4-8 MW)")
print("  💡 Load: Lower at night (35-38 MW), higher during day (42-45 MW)")
print()
print("These files are ready to be imported into the database!")
print("=" * 60)
