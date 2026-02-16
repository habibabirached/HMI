"""
Generate configuration for LM2500-BESS-Integrated-Power-Node design.

This script creates the power system configuration matching the CSV data:
- 2x LM2500 Gas Turbines (25 MW each)
- 1x BESS (10 MWh)
- 1x MV Bus (13.8 kV)
- 1x Data Center Load (50 MW)
"""

import json
import os

def create_configuration():
    """Create the LM2500-BESS-Integrated-Power-Node configuration."""
    
    config = {
        "name": "LM2500-BESS-Integrated-Power-Node",
        "description": "One-quarter Meta data center power block: 2x LM2500 turbines, 1x BESS, 50MW load. Designed for torsional vibration analysis, LVRT testing, and small-signal perturbation studies.",
        "data": {
            "canvasComponents": [
                # Turbine 1 (left)
                {
                    "id": "comp-turbine-1",
                    "type": "gas-turbine-lm2500",
                    "name": "LM2500 #1",
                    "fullName": "Gas Turbine LM2500 #1",
                    "position": {"x": 150, "y": 250},
                    "status": "idle",
                    "properties": {
                        "rating": 25,
                        "voltage": 13.8,
                        "unit": "MW"
                    },
                    "state": {
                        "power": 0,
                        "voltage": 13.8,
                        "current": 0,
                        "frequency": 60
                    }
                },
                
                # Turbine 2 (left-center)
                {
                    "id": "comp-turbine-2",
                    "type": "gas-turbine-lm2500",
                    "name": "LM2500 #2",
                    "fullName": "Gas Turbine LM2500 #2",
                    "position": {"x": 150, "y": 400},
                    "status": "idle",
                    "properties": {
                        "rating": 25,
                        "voltage": 13.8,
                        "unit": "MW"
                    },
                    "state": {
                        "power": 0,
                        "voltage": 13.8,
                        "current": 0,
                        "frequency": 60
                    }
                },
                
                # BESS (bottom left)
                {
                    "id": "comp-bess-1",
                    "type": "bess",
                    "name": "BESS",
                    "fullName": "Battery Energy Storage System",
                    "position": {"x": 150, "y": 550},
                    "status": "idle",
                    "properties": {
                        "rating": 10,
                        "voltage": 0.8,
                        "unit": "MWh"
                    },
                    "state": {
                        "power": 0,
                        "voltage": 0.8,
                        "current": 0,
                        "frequency": 60,
                        "soc": 85  # State of charge
                    }
                },
                
                # MV Bus (center)
                {
                    "id": "comp-bus-1",
                    "type": "bus-mv",
                    "name": "13.8kV Bus",
                    "fullName": "Medium Voltage Bus 13.8kV",
                    "position": {"x": 500, "y": 350},
                    "status": "idle",
                    "properties": {
                        "rating": 0,
                        "voltage": 13.8,
                        "unit": "kV"
                    },
                    "state": {
                        "power": 0,
                        "voltage": 13.8,
                        "current": 0,
                        "frequency": 60
                    }
                },
                
                # Data Center Load (right)
                {
                    "id": "comp-load-1",
                    "type": "datacenter-load",
                    "name": "DC Load 50MW",
                    "fullName": "Data Center Load 50MW",
                    "position": {"x": 850, "y": 350},
                    "status": "idle",
                    "properties": {
                        "rating": 50,
                        "voltage": 13.8,
                        "unit": "MW"
                    },
                    "state": {
                        "power": 0,
                        "voltage": 13.8,
                        "current": 0,
                        "frequency": 60
                    }
                }
            ],
            
            "connections": [
                # Turbine 1 -> Bus
                {
                    "id": "conn-1",
                    "from": "comp-turbine-1",
                    "to": "comp-bus-1",
                    "type": "power",
                    "status": "idle"
                },
                
                # Turbine 2 -> Bus
                {
                    "id": "conn-2",
                    "from": "comp-turbine-2",
                    "to": "comp-bus-1",
                    "type": "power",
                    "status": "idle"
                },
                
                # BESS -> Bus
                {
                    "id": "conn-3",
                    "from": "comp-bess-1",
                    "to": "comp-bus-1",
                    "type": "power",
                    "status": "idle"
                },
                
                # Bus -> Load
                {
                    "id": "conn-4",
                    "from": "comp-bus-1",
                    "to": "comp-load-1",
                    "type": "power",
                    "status": "idle"
                }
            ],
            
            "systemState": {
                "simulationRunning": False,
                "zoom": 1.0,
                "pan": {"x": 0, "y": 0},
                "mode": "design"
            },
            
            "chartPanelState": {
                "openCharts": [],
                "panelHeight": 300
            }
        }
    }
    
    return config


def main():
    print("🔧 Generating LM2500-BESS-Integrated-Power-Node configuration...")
    print()
    
    # Create configuration
    config = create_configuration()
    
    # Save to designs directory (per-design structure)
    backend_dir = os.path.dirname(os.path.dirname(__file__))
    design_dir = "lm2500_bess_integrated_power_node"
    design_path = os.path.join(backend_dir, "designs", design_dir)
    os.makedirs(design_path, exist_ok=True)
    output_path = os.path.join(design_path, f"{design_dir}.conf.json")
    
    # .conf.json format: name, description, canvasComponents, connections, systemState at top level
    data = config.get("data", {})
    conf_data = {
        "name": config["name"],
        "description": config.get("description", ""),
        "canvasComponents": data.get("canvasComponents", []),
        "connections": data.get("connections", []),
        "systemState": data.get("systemState", {"simulationRunning": False, "zoom": 1, "pan": {"x": 0, "y": 0}}),
    }
    with open(output_path, "w") as f:
        json.dump(conf_data, f, indent=2)
    
    print(f"💾 Saved to: {output_path}")
    print()
    print("📊 Configuration Summary:")
    print(f"   Name: {config['name']}")
    print(f"   Components: {len(config['data']['canvasComponents'])}")
    print(f"   Connections: {len(config['data']['connections'])}")
    print()
    print("   Components list:")
    for comp in config['data']['canvasComponents']:
        print(f"      - {comp['name']} ({comp['type']}) @ ({comp['position']['x']}, {comp['position']['y']})")
    print()
    print("✨ Configuration generation complete!")


if __name__ == "__main__":
    main()
