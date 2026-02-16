"""
Migrate LM2500-BESS-Integrated-Power-Node to per-design directory structure.

Creates designs/lm2500_bess_integrated_power_node/ with:
- Per-simulation .data.csv files (no simulation column)
- Per-simulation .sim.json files
- design config from existing config if present

Run from dcs-backend: python3 scripts/migrate_lm2500_to_design_dir.py
"""

import importlib.util
import json
import os
import sys

# Load generator module (filename has hyphens, can't use normal import)
_script_dir = os.path.dirname(os.path.abspath(__file__))
_gen_path = os.path.join(_script_dir, "generate_csv_for_LM2500-BESS-Integrated-Power-Node.py")
_spec = importlib.util.spec_from_file_location("csv_gen", _gen_path)
_gen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_gen)
generate_torsional_scenario = _gen.generate_torsional_scenario
generate_lvrt_scenario = _gen.generate_lvrt_scenario
generate_small_signal_scenario = _gen.generate_small_signal_scenario

# Sim ID -> filename (no spaces, for file storage)
SIM_TO_FILENAME = {
    "sim_Torsional": "TorsionalVibration",
    "sim_LVRT": "LowVoltageRideThrough",
    "sim_SmallSignal": "SmallSignalPerturbation",
}

DESIGN_DIR = "lm2500_bess_integrated_power_node"
DESIGNS_ROOT = "designs"


def main():
    backend_dir = os.path.dirname(os.path.dirname(__file__))
    design_path = os.path.join(backend_dir, DESIGNS_ROOT, DESIGN_DIR)
    os.makedirs(design_path, exist_ok=True)
    print(f"📁 Design directory: {design_path}")
    print()

    # Load existing sim config to extract per-sim configs
    sim_config_path = os.path.join(backend_dir, "saved_sim", "lm2500-bess-integrated-power-node.json")
    sim_configs = {}
    if os.path.isfile(sim_config_path):
        with open(sim_config_path, "r") as f:
            full_config = json.load(f)
        sim_configs = full_config.get("simulations", {})
        print(f"✅ Loaded sim config from {sim_config_path}")
    else:
        print(f"⚠️  No sim config at {sim_config_path}, using minimal configs")
        for sid in SIM_TO_FILENAME:
            sim_configs[sid] = {
                "display_name": sid.replace("sim_", "").replace("_", " ").title(),
                "description": "",
                "charts_to_display": [],
                "event_markers": {},
            }

    # Generate and save per-sim data
    dfs = {
        "sim_Torsional": generate_torsional_scenario(),
        "sim_LVRT": generate_lvrt_scenario(),
        "sim_SmallSignal": generate_small_signal_scenario(),
    }

    for sim_id, df in dfs.items():
        filename = SIM_TO_FILENAME[sim_id]
        # Drop simulation column (each file is for one sim)
        if "simulation" in df.columns:
            df = df.drop(columns=["simulation"])
        csv_path = os.path.join(design_path, f"{filename}.data.csv")
        df.to_csv(csv_path, index=False)
        print(f"   💾 {filename}.data.csv ({len(df)} rows)")

        # Write .sim.json
        cfg = sim_configs.get(sim_id, {})
        sim_json = {
            "display_name": cfg.get("display_name", filename),
            "description": cfg.get("description", ""),
            "charts_to_display": cfg.get("charts_to_display", []),
            "event_markers": cfg.get("event_markers", {}),
        }
        sim_path = os.path.join(design_path, f"{filename}.sim.json")
        with open(sim_path, "w") as f:
            json.dump(sim_json, f, indent=2)
        print(f"   💾 {filename}.sim.json")

    # Create design config if it doesn't exist
    config_path = os.path.join(design_path, f"{DESIGN_DIR}.conf.json")
    if not os.path.isfile(config_path):
        conf_data = {
            "name": "LM2500-BESS-Integrated-Power-Node",
            "description": "Migrated design",
            "canvasComponents": [],
            "connections": [],
            "systemState": {"simulationRunning": False, "zoom": 1, "pan": {"x": 0, "y": 0}},
        }
        with open(config_path, "w") as f:
            json.dump(conf_data, f, indent=2)
        print(f"   💾 {DESIGN_DIR}.conf.json (minimal)")
    else:
        print(f"   ℹ️  {DESIGN_DIR}.conf.json (exists)")

    print()
    print("✨ Migration complete!")
    print(f"   Design dir: {design_path}")
    print(f"   Simulations: {list(SIM_TO_FILENAME.values())}")


if __name__ == "__main__":
    main()
