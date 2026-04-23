#!/usr/bin/env python3
"""
Import every designs/<leaf>/*.data.csv (except under archive/) into the simulation CSV tables.
Intended to run in the dcs-backend container so DATABASE_URL points at the same SQLite file as the API.
"""

from __future__ import annotations

import argparse
import os
import sys

ROOT = os.path.realpath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

DATA_SUFFIX = ".data.csv"


def _iter_data_csvs(designs_root: str) -> list[tuple[str, str, str]]:
    """
    Yields (catalog_rel, sim_name, absolute_path) for each scenario CSV
    in a top-level design folder (not archive).
    """
    base = os.path.realpath(designs_root)
    if not os.path.isdir(base):
        raise FileNotFoundError(f"Designs root is not a directory: {base}")
    out: list[tuple[str, str, str]] = []
    for name in sorted(os.listdir(base)):
        if name == "archive":
            continue
        leaf_dir = os.path.join(base, name)
        if not os.path.isdir(leaf_dir):
            continue
        for fn in sorted(os.listdir(leaf_dir)):
            if not fn.endswith(DATA_SUFFIX) or not os.path.isfile(
                os.path.join(leaf_dir, fn)
            ):
                continue
            sim_name = fn[: -len(DATA_SUFFIX)]
            path = os.path.join(leaf_dir, fn)
            out.append((name, sim_name, path))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Load simulation *.data.csv files from designs/ into the SQLite database."
    )
    ap.add_argument(
        "--designs-root",
        default="designs",
        help="Path to the designs directory (default: designs, relative to current working directory). In the container, use /app/designs or run from /app.",
    )
    ap.add_argument(
        "--force",
        action="store_true",
        help="Re-import even if the file size and mtime already match a stored import.",
    )
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="List files that would be imported; do not write to the database.",
    )
    ap.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Print each file as it is processed.",
    )
    args = ap.parse_args()

    designs_root = os.path.realpath(
        args.designs_root
        if os.path.isabs(args.designs_root)
        else os.path.join(os.getcwd(), args.designs_root)
    )
    try:
        jobs = _iter_data_csvs(designs_root)
    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    if not jobs:
        print("No *.data.csv files found under top-level design folders (archive skipped).")
        return 0

    if args.dry_run:
        for catalog_rel, sim_name, path in jobs:
            print(f"would import: {catalog_rel}/{sim_name}.data.csv -> {path}")
        return 0

    from database import SessionLocal, init_db
    from simulation_data_store import import_simulation_csv

    init_db()
    session = SessionLocal()
    n_skipped = 0
    n_imported = 0
    n_error = 0
    try:
        for catalog_rel, sim_name, path in jobs:
            if args.verbose:
                print(f"… {catalog_rel} / {sim_name}.data.csv", flush=True)
            try:
                status, nrows = import_simulation_csv(
                    session, catalog_rel, sim_name, path, force=args.force
                )
            except Exception as e:
                session.rollback()
                n_error += 1
                print(
                    f"Error importing {catalog_rel}/{sim_name}.data.csv: {e}",
                    file=sys.stderr,
                )
                continue
            if status == "skipped":
                n_skipped += 1
            else:
                n_imported += 1
            if args.verbose:
                print(f"  {status} ({nrows} data rows)", flush=True)
    finally:
        session.close()

    print(
        f"Done. Imported or refreshed: {n_imported} file(s). Skipped (already current): {n_skipped} file(s). Errors: {n_error} file(s)."
    )
    return 1 if n_error else 0


if __name__ == "__main__":
    raise SystemExit(main())
