"""
Generate per-simulation CSV files for LM2500-BESS-Integrated-Power-Node design.

This script creates realistic mock data for three simulation scenarios and writes
each to designs/lm2500_bess_integrated_power_node/{SimName}.data.csv
1. sim_Torsional: Steady-state with torsional vibration (with/without BESS)
2. sim_LVRT: Low-voltage ride-through on the bus
3. sim_SmallSignal: Small load perturbation analysis
"""

import pandas as pd
import numpy as np
import os

# Set random seed for reproducibility
np.random.seed(42)

def generate_torsional_scenario():
    """
    Scenario 1: Steady-state validation and torsional vibration analysis.
    
    Duration: 60 seconds
    - 0-30s: BESS connected, lower oscillations
    - 30-60s: BESS disconnected, higher oscillations and torque
    """
    duration = 60
    dt = 0.01  # 10ms time step
    time = np.arange(0, duration, dt)
    n_points = len(time)
    
    data = {
        'time_sec': time,
        'simulation': ['sim_Torsional'] * n_points,
    }
    
    # Event markers
    data['bess_connected'] = (time < 30).astype(int)
    data['lvrt_active'] = np.zeros(n_points, dtype=int)
    data['perturbation_active'] = np.zeros(n_points, dtype=int)
    
    # Base operating points
    turbine1_base_power = 25.0  # MW
    turbine2_base_power = 25.0  # MW
    load_power = 50.0  # MW
    base_torque = 500000.0  # N⋅m
    base_voltage = 13.8  # kV
    
    # Torsional oscillation parameters
    torsional_freq = 25.0  # Hz (typical for gas turbines)
    
    # With BESS (0-30s): Lower oscillations, well-damped
    bess_damping = 0.15
    with_bess_oscillation = 0.02  # 2% oscillation
    
    # Without BESS (30-60s): Higher oscillations, less damped
    no_bess_damping = 0.05
    without_bess_oscillation = 0.08  # 8% oscillation
    
    # Generate turbine torque with torsional oscillations
    turbine1_torque = np.zeros(n_points)
    turbine2_torque = np.zeros(n_points)
    
    for i, t in enumerate(time):
        if t < 30:  # BESS connected
            osc_amplitude = with_bess_oscillation * base_torque
            damping = bess_damping
        else:  # BESS disconnected (transition at 30s)
            osc_amplitude = without_bess_oscillation * base_torque
            damping = no_bess_damping
        
        # Torsional oscillation with damping
        decay = np.exp(-damping * (t - (30 if t >= 30 else 0)))
        oscillation = osc_amplitude * decay * np.sin(2 * np.pi * torsional_freq * t)
        
        # Add random noise
        noise = np.random.normal(0, base_torque * 0.005)
        
        turbine1_torque[i] = base_torque + oscillation + noise
        turbine2_torque[i] = base_torque + oscillation * 0.9 + noise  # Slightly different phase
    
    data['turbine1_torque_nm'] = turbine1_torque
    data['turbine2_torque_nm'] = turbine2_torque
    
    # Power output (proportional to torque with small variations)
    data['turbine1_power_mw'] = turbine1_base_power * (1 + (turbine1_torque - base_torque) / base_torque * 0.5)
    data['turbine2_power_mw'] = turbine2_base_power * (1 + (turbine2_torque - base_torque) / base_torque * 0.5)
    
    # Current (I = P / (sqrt(3) * V))
    data['turbine1_current_a'] = data['turbine1_power_mw'] * 1e6 / (np.sqrt(3) * base_voltage * 1e3)
    data['turbine2_current_a'] = data['turbine2_power_mw'] * 1e6 / (np.sqrt(3) * base_voltage * 1e3)
    
    # BESS data
    bess_power = np.where(time < 30, 2.0 + np.random.normal(0, 0.3, n_points), 0.0)  # Small support when connected
    data['bess_power_mw'] = np.clip(bess_power, 0, 10)
    data['bess_voltage_kv'] = np.where(time < 30, 0.8 + np.random.normal(0, 0.01, n_points), 0.0)
    data['bess_soc_percent'] = np.where(time < 30, 85 - time * 0.1, 85.0)  # Slow discharge when connected
    
    # Bus voltage (more stable with BESS)
    bus_voltage_variation = np.where(time < 30, 0.01, 0.03)  # Lower variation with BESS
    data['bus_voltage_kv'] = base_voltage * (1 + np.random.normal(0, bus_voltage_variation, n_points))
    data['bus_frequency_hz'] = 60.0 + np.random.normal(0, 0.01, n_points)
    
    # Load (constant)
    data['load_power_mw'] = load_power + np.random.normal(0, 0.5, n_points)
    data['load_current_a'] = data['load_power_mw'] * 1e6 / (np.sqrt(3) * base_voltage * 1e3)
    
    return pd.DataFrame(data)


def generate_lvrt_scenario():
    """
    Scenario 2: Low-voltage ride-through (LVRT) on the bus.
    
    Duration: 30 seconds
    - 0-10s: Normal operation
    - 10-12s: Voltage fault (sag to 50%)
    - 12-30s: Recovery and stabilization
    """
    duration = 30
    dt = 0.01
    time = np.arange(0, duration, dt)
    n_points = len(time)
    
    data = {
        'time_sec': time,
        'simulation': ['sim_LVRT'] * n_points,
    }
    
    # Event markers
    data['bess_connected'] = np.ones(n_points, dtype=int)  # BESS stays connected
    data['lvrt_active'] = ((time >= 10) & (time < 12)).astype(int)  # 2-second fault
    data['perturbation_active'] = np.zeros(n_points, dtype=int)
    
    # Base values
    turbine1_base_power = 25.0
    turbine2_base_power = 25.0
    load_power = 50.0
    base_torque = 500000.0
    base_voltage = 13.8
    
    # Bus voltage profile during LVRT
    bus_voltage = np.ones(n_points) * base_voltage
    
    for i, t in enumerate(time):
        if 10 <= t < 10.2:  # Fault initiation (200ms)
            progress = (t - 10) / 0.2
            bus_voltage[i] = base_voltage * (1 - 0.5 * progress)  # Drop to 50%
        elif 10.2 <= t < 12:  # Sustained fault
            bus_voltage[i] = base_voltage * 0.5 + np.random.normal(0, 0.1)
        elif 12 <= t < 12.5:  # Recovery (500ms)
            progress = (t - 12) / 0.5
            bus_voltage[i] = base_voltage * (0.5 + 0.5 * progress)
        elif 12.5 <= t < 15:  # Stabilization with oscillations
            overshoot = 0.05 * np.exp(-(t - 12.5) / 1.0) * np.sin(2 * np.pi * 2 * (t - 12.5))
            bus_voltage[i] = base_voltage * (1 + overshoot) + np.random.normal(0, 0.05)
        else:  # Normal operation
            bus_voltage[i] = base_voltage + np.random.normal(0, 0.02)
    
    data['bus_voltage_kv'] = bus_voltage
    data['bus_frequency_hz'] = 60.0 + np.random.normal(0, 0.02, n_points)
    
    # Turbine response during LVRT (current increases, power drops)
    voltage_ratio = bus_voltage / base_voltage
    
    # Turbines try to maintain power but are limited by voltage
    turbine1_power = turbine1_base_power * voltage_ratio + np.random.normal(0, 0.5, n_points)
    turbine2_power = turbine2_base_power * voltage_ratio + np.random.normal(0, 0.5, n_points)
    
    data['turbine1_power_mw'] = np.clip(turbine1_power, 0, 30)
    data['turbine2_power_mw'] = np.clip(turbine2_power, 0, 30)
    
    # Current increases during fault (trying to supply power at lower voltage)
    data['turbine1_current_a'] = data['turbine1_power_mw'] * 1e6 / (np.sqrt(3) * bus_voltage * 1e3)
    data['turbine2_current_a'] = data['turbine2_power_mw'] * 1e6 / (np.sqrt(3) * bus_voltage * 1e3)
    
    # Torque increases during fault
    data['turbine1_torque_nm'] = base_torque * (1 + (1 - voltage_ratio) * 0.3) + np.random.normal(0, base_torque * 0.01, n_points)
    data['turbine2_torque_nm'] = base_torque * (1 + (1 - voltage_ratio) * 0.3) + np.random.normal(0, base_torque * 0.01, n_points)
    
    # BESS responds by injecting power during fault
    bess_response = np.zeros(n_points)
    for i, t in enumerate(time):
        if 10 <= t < 12:  # During fault
            bess_response[i] = 8.0 + np.random.normal(0, 0.5)  # Inject 8 MW
        elif 12 <= t < 15:  # Recovery
            decay = np.exp(-(t - 12) / 2.0)
            bess_response[i] = 8.0 * decay + np.random.normal(0, 0.3)
        else:  # Normal
            bess_response[i] = 2.0 + np.random.normal(0, 0.2)
    
    data['bess_power_mw'] = np.clip(bess_response, 0, 10)
    data['bess_voltage_kv'] = 0.8 + np.random.normal(0, 0.01, n_points)
    data['bess_soc_percent'] = 85 - time * 0.15  # Faster discharge during response
    
    # Load (drops during voltage sag)
    data['load_power_mw'] = load_power * voltage_ratio + np.random.normal(0, 0.5, n_points)
    data['load_current_a'] = data['load_power_mw'] * 1e6 / (np.sqrt(3) * bus_voltage * 1e3)
    
    return pd.DataFrame(data)


def generate_small_signal_scenario():
    """
    Scenario 3: Small-signal perturbation analysis at the load.
    
    Duration: 40 seconds
    - 0-10s: Steady state
    - 10-30s: Small sinusoidal load perturbation
    - 30-40s: Observation of damped response
    """
    duration = 40
    dt = 0.01
    time = np.arange(0, duration, dt)
    n_points = len(time)
    
    data = {
        'time_sec': time,
        'simulation': ['sim_SmallSignal'] * n_points,
    }
    
    # Event markers
    data['bess_connected'] = np.ones(n_points, dtype=int)
    data['lvrt_active'] = np.zeros(n_points, dtype=int)
    data['perturbation_active'] = ((time >= 10) & (time < 30)).astype(int)
    
    # Base values
    turbine1_base_power = 25.0
    turbine2_base_power = 25.0
    load_base_power = 50.0
    base_torque = 500000.0
    base_voltage = 13.8
    
    # Small load perturbation (±2% at 0.5 Hz)
    perturbation_freq = 0.5  # Hz
    perturbation_amplitude = 0.02  # 2%
    
    load_power = np.ones(n_points) * load_base_power
    
    for i, t in enumerate(time):
        if 10 <= t < 30:  # Apply perturbation
            perturbation = perturbation_amplitude * load_base_power * np.sin(2 * np.pi * perturbation_freq * (t - 10))
            load_power[i] = load_base_power + perturbation + np.random.normal(0, 0.2)
        else:
            load_power[i] = load_base_power + np.random.normal(0, 0.2)
    
    data['load_power_mw'] = load_power
    
    # Turbine response (follows load with some damping and phase lag)
    turbine_damping = 0.3
    phase_lag = 0.1  # seconds
    
    turbine1_power = np.zeros(n_points)
    turbine2_power = np.zeros(n_points)
    
    for i, t in enumerate(time):
        # Response to load change with damping and lag
        if t >= phase_lag:
            lag_idx = int(phase_lag / dt)
            load_deviation = load_power[i - lag_idx] - load_base_power
            damped_response = load_deviation * 0.5 * (1 - turbine_damping)  # Each turbine supplies half
            turbine1_power[i] = turbine1_base_power + damped_response + np.random.normal(0, 0.3)
            turbine2_power[i] = turbine2_base_power + damped_response + np.random.normal(0, 0.3)
        else:
            turbine1_power[i] = turbine1_base_power + np.random.normal(0, 0.3)
            turbine2_power[i] = turbine2_base_power + np.random.normal(0, 0.3)
    
    data['turbine1_power_mw'] = turbine1_power
    data['turbine2_power_mw'] = turbine2_power
    
    # Torque oscillates with power
    data['turbine1_torque_nm'] = base_torque * (turbine1_power / turbine1_base_power) + np.random.normal(0, base_torque * 0.01, n_points)
    data['turbine2_torque_nm'] = base_torque * (turbine2_power / turbine2_base_power) + np.random.normal(0, base_torque * 0.01, n_points)
    
    # Current
    data['turbine1_current_a'] = turbine1_power * 1e6 / (np.sqrt(3) * base_voltage * 1e3)
    data['turbine2_current_a'] = turbine2_power * 1e6 / (np.sqrt(3) * base_voltage * 1e3)
    data['load_current_a'] = load_power * 1e6 / (np.sqrt(3) * base_voltage * 1e3)
    
    # BESS provides minor support
    data['bess_power_mw'] = 2.0 + np.random.normal(0, 0.2, n_points)
    data['bess_voltage_kv'] = 0.8 + np.random.normal(0, 0.01, n_points)
    data['bess_soc_percent'] = 85 - time * 0.05
    
    # Bus voltage (very stable)
    data['bus_voltage_kv'] = base_voltage + np.random.normal(0, 0.01, n_points)
    data['bus_frequency_hz'] = 60.0 + np.random.normal(0, 0.005, n_points)
    
    return pd.DataFrame(data)


def main():
    print("🔧 Generating unified simulation CSV...")
    print()
    
    # Generate each scenario
    print("📊 Scenario 1: Torsional Vibration Analysis...")
    df_torsional = generate_torsional_scenario()
    print(f"   ✅ Generated {len(df_torsional)} data points (0-60s)")
    
    print("📊 Scenario 2: Low-Voltage Ride-Through...")
    df_lvrt = generate_lvrt_scenario()
    print(f"   ✅ Generated {len(df_lvrt)} data points (0-30s)")
    
    print("📊 Scenario 3: Small-Signal Perturbation...")
    df_small_signal = generate_small_signal_scenario()
    print(f"   ✅ Generated {len(df_small_signal)} data points (0-40s)")
    
    # Column order (no simulation column - per-sim files don't need it)
    column_order = [
        'time_sec',
        'bess_connected',
        'lvrt_active',
        'perturbation_active',
        'turbine1_torque_nm',
        'turbine1_power_mw',
        'turbine1_current_a',
        'turbine2_torque_nm',
        'turbine2_power_mw',
        'turbine2_current_a',
        'bess_power_mw',
        'bess_voltage_kv',
        'bess_soc_percent',
        'bus_voltage_kv',
        'bus_frequency_hz',
        'load_power_mw',
        'load_current_a'
    ]

    # Map internal sim IDs to design-dir filenames
    sim_mapping = [
        (df_torsional, 'TorsionalVibration'),
        (df_lvrt, 'LowVoltageRideThrough'),
        (df_small_signal, 'SmallSignalPerturbation'),
    ]

    backend_dir = os.path.dirname(os.path.dirname(__file__))
    design_dir = os.path.join(backend_dir, 'designs', 'lm2500_bess_integrated_power_node')
    os.makedirs(design_dir, exist_ok=True)

    print()
    print("💾 Saving per-simulation CSVs to design dir...")
    for df, sim_name in sim_mapping:
        df_out = df.drop(columns=['simulation'], errors='ignore')[column_order]
        out_path = os.path.join(design_dir, f'{sim_name}.data.csv')
        df_out.to_csv(out_path, index=False)
        print(f"   ✅ {sim_name}.data.csv ({len(df_out)} rows)")

    print()
    print("✨ CSV generation complete!")


if __name__ == "__main__":
    main()
