#!/usr/bin/env python3
"""
Replenish database from a design directory.

Wipes the database (all tables) and repopulates it with Configuration records
built from design directories under designs/. The design dir must have:
  designs/{design_dir}/{design_dir}.conf.json

Simulation data (.sim.json, .data.csv) stays on disk in the design dir;
the app reads it via /api/designs/{name}/simulations/... endpoints.

Usage:
  cd dcs-backend
  python scripts/replenish_from_design.py [design_dir]

  design_dir: Optional. Defaults to "lm2500_bess_integrated_power_node".
              Use "." to replenish from ALL design dirs that have a .conf.json.

Examples:
  python scripts/replenish_from_design.py
  python scripts/replenish_from_design.py lm2500_bess_integrated_power_node
  python scripts/replenish_from_design.py .
"""

import argparse
import json
import os
import sys

# Ensure we can import from dcs-backend (parent of scripts/)
_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _backend_dir)

from database import SessionLocal
from models import Configuration

DESIGNS_ROOT = os.path.join(_backend_dir, "designs")


def build_config_data_from_conf(conf: dict) -> dict:
    """Build the 'data' dict for Configuration from a design .conf.json."""
    return {
        "canvasComponents": conf.get("canvasComponents", []),
        "connections": conf.get("connections", []),
        "systemState": conf.get("systemState", {"simulationRunning": False, "zoom": 1, "pan": {"x": 0, "y": 0}}),
    }


def wipe_database(db):
    """Delete all records from Configuration table."""
    db.query(Configuration).delete()
    db.commit()
    print("🗑️  Database wiped (Configuration table cleared)")


def replenish_from_design_dir(db, design_dir: str) -> int:
    """
    Load one design dir into the database. Returns 1 if ok, 0 if skipped/failed.
    """
    conf_path = os.path.join(DESIGNS_ROOT, design_dir, f"{design_dir}.conf.json")
    if not os.path.isfile(conf_path):
        return 0

    with open(conf_path, "r") as f:
        conf = json.load(f)

    name = conf.get("name")
    if not name:
        name = design_dir.replace("_", " ").replace("-", " ").title()

    description = conf.get("description", "")
    data = build_config_data_from_conf(conf)

    # Check if already exists (by name) - we wiped, so usually not
    existing = db.query(Configuration).filter(Configuration.name == name).first()
    if existing:
        existing.description = description
        existing.data = json.dumps(data)
        print(f"   🔄 Updated: '{name}'")
    else:
        new_config = Configuration(
            name=name,
            description=description,
            data=json.dumps(data),
        )
        db.add(new_config)
        print(f"   ➕ Created: '{name}'")
    return 1


def main():
    parser = argparse.ArgumentParser(description="Replenish DB from design directory")
    parser.add_argument(
        "design_dir",
        nargs="?",
        default="lm2500_bess_integrated_power_node",
        help="Design dir name (e.g. lm2500_bess_integrated_power_node), or '.' for all",
    )
    parser.add_argument(
        "--no-wipe",
        action="store_true",
        help="Do not wipe the database; only add/update designs",
    )
    args = parser.parse_args()

    if not os.path.isdir(DESIGNS_ROOT):
        print(f"❌ Designs root not found: {DESIGNS_ROOT}")
        sys.exit(1)

    db = SessionLocal()

    try:
        if not args.no_wipe:
            wipe_database(db)
        else:
            print("ℹ️  Skipping wipe (--no-wipe)")

        count = 0
        if args.design_dir == ".":
            # All design dirs that have a .conf.json
            for d in sorted(os.listdir(DESIGNS_ROOT)):
                path = os.path.join(DESIGNS_ROOT, d)
                if os.path.isdir(path) and not d.startswith("."):
                    c = replenish_from_design_dir(db, d)
                    count += c
        else:
            count = replenish_from_design_dir(db, args.design_dir)

        db.commit()
        print()
        print(f"✅ Replenished {count} configuration(s) from designs/")
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
