"""
Simulation scenario rows live in SQLite for paging/API speed.

Canonical on-disk backup for migration/Git: {sim_name}.data/manifest.json + column Parquet files
(see simulation_parquet_bundle.py). The API does not read *.data.csv at runtime.

Legacy *.data.csv may exist only for one-shot migration scripts that convert to Parquet bundles.
"""

from __future__ import annotations

import json
import os
from typing import Optional

import pandas as pd
from sqlalchemy.orm import Session

from models import SimulationCsvImport, SimulationCsvRow
from simulation_parquet_bundle import (
    bundle_stat_key,
    scenario_data_dir,
    write_bundle_from_dataframe,
)

BULK_ROWS = 1000


def stat_key(path: str) -> tuple[int, int]:
    st = os.stat(path)
    mtime_ns = getattr(st, "st_mtime_ns", int(st.st_mtime * 1e9))
    return (int(st.st_size), int(mtime_ns))


def get_effective_import(
    db: Session, catalog_rel: str, sim_name: str, design_dir: str
) -> Optional[SimulationCsvImport]:
    """
    DB mirror is valid when manifest.json size+mtime match what was imported.
    """
    sk = bundle_stat_key(design_dir, sim_name)
    if sk is None:
        return None
    imp = (
        db.query(SimulationCsvImport)
        .filter(
            SimulationCsvImport.catalog_rel == catalog_rel,
            SimulationCsvImport.sim_name == sim_name,
        )
        .first()
    )
    if not imp:
        return None
    fsize, mtime = sk
    if imp.file_size != fsize or imp.file_mtime_ns != mtime:
        return None
    return imp


def _clear_import_and_rows(db: Session, old: Optional[SimulationCsvImport]) -> None:
    if not old:
        return
    db.query(SimulationCsvRow).filter(SimulationCsvRow.import_id == old.id).delete(
        synchronize_session=False
    )
    db.delete(old)
    db.flush()


def _bulk_append_rows(db: Session, imp: SimulationCsvImport, df: pd.DataFrame) -> None:
    header = [str(h) for h in df.columns]
    batch: list[SimulationCsvRow] = []
    for idx in range(len(df)):
        row = df.iloc[idx]
        d = {header[i]: ("" if pd.isna(row.iloc[i]) else str(row.iloc[i])) for i in range(len(header))}
        batch.append(
            SimulationCsvRow(
                import_id=imp.id, row_index=idx, row_json=json.dumps(d, sort_keys=False)
            )
        )
        if len(batch) >= BULK_ROWS:
            db.add_all(batch)
            db.flush()
            batch = []
    if batch:
        db.add_all(batch)


def _mirror_dataframe_after_bundle_manifest(
    db: Session,
    catalog_rel: str,
    sim_name: str,
    design_dir: str,
    df: pd.DataFrame,
    *,
    force: bool = False,
) -> tuple[str, int]:
    """SQLite mirror must match manifest.json size+mtime on disk."""
    mp = os.path.join(scenario_data_dir(design_dir, sim_name), "manifest.json")
    fsize, mtime_ns = stat_key(mp)

    existing = (
        db.query(SimulationCsvImport)
        .filter(
            SimulationCsvImport.catalog_rel == catalog_rel,
            SimulationCsvImport.sim_name == sim_name,
        )
        .first()
    )
    if existing and not force and existing.file_size == fsize and existing.file_mtime_ns == mtime_ns:
        return "skipped", existing.row_count

    _clear_import_and_rows(db, existing)

    header = [str(h) for h in df.columns]
    imp = SimulationCsvImport(
        catalog_rel=catalog_rel,
        sim_name=sim_name,
        file_size=fsize,
        file_mtime_ns=mtime_ns,
        row_count=len(df),
        header_json=json.dumps(header),
    )
    db.add(imp)
    db.flush()
    _bulk_append_rows(db, imp, df)
    imp.row_count = len(df)
    db.add(imp)
    db.commit()
    return "imported", imp.row_count


def import_simulation_from_dataframe(
    db: Session,
    catalog_rel: str,
    sim_name: str,
    design_dir: str,
    df: pd.DataFrame,
    *,
    force: bool = False,
) -> tuple[str, int]:
    """
    Write Parquet bundle under design_dir and mirror rows into SQLite.
    """
    if df is None or df.empty:
        raise ValueError("DataFrame is empty")
    df = df.copy()
    df.columns = [str(c) for c in df.columns]

    write_bundle_from_dataframe(df, design_dir, sim_name)
    return _mirror_dataframe_after_bundle_manifest(
        db, catalog_rel, sim_name, design_dir, df, force=force
    )


def import_simulation_parquet_bundle(
    db: Session,
    catalog_rel: str,
    sim_name: str,
    design_dir: str,
    *,
    force: bool = False,
) -> tuple[str, int]:
    """Load bundle from disk into SQLite (reads Parquet column files)."""
    from simulation_parquet_bundle import read_bundle_dataframe

    df = read_bundle_dataframe(design_dir, sim_name)
    return _mirror_dataframe_after_bundle_manifest(
        db, catalog_rel, sim_name, design_dir, df, force=force
    )


def import_simulation_csv(
    db: Session,
    catalog_rel: str,
    sim_name: str,
    csv_path: str,
    *,
    force: bool = False,
    design_dir: Optional[str] = None,
) -> tuple[str, int]:
    """
    Migration / tooling only: read a legacy .data.csv once, write Parquet bundle + SQLite.

    Args:
        design_dir: Directory containing the design (parent of csv file). Defaults to dirname(csv_path).
    """
    if not os.path.isfile(csv_path):
        raise FileNotFoundError(csv_path)
    dd = design_dir if design_dir is not None else os.path.dirname(csv_path)
    df = pd.read_csv(csv_path, encoding="utf-8-sig")
    return import_simulation_from_dataframe(db, catalog_rel, sim_name, dd, df, force=force)


def fetch_all_rows_from_db(db: Session, imp: SimulationCsvImport) -> list[dict]:
    """Full scenario table from SQLite (ordered by row_index)."""
    header = json.loads(imp.header_json) if imp.header_json else []
    if not header:
        return []
    rows, _ = fetch_row_page_from_db(db, imp, [str(h) for h in header], 0, None)
    return rows


def fetch_row_page_from_db(
    db: Session,
    imp: SimulationCsvImport,
    resolved: list[str],
    offset: int,
    limit: Optional[int],
) -> tuple[list[dict], int]:
    """Return (projected row dicts, total_data_row_count) from DB mirror."""
    q = (
        db.query(SimulationCsvRow)
        .filter(
            SimulationCsvRow.import_id == imp.id,
            SimulationCsvRow.row_index >= offset,
        )
        .order_by(SimulationCsvRow.row_index)
    )
    if limit is not None:
        q = q.limit(limit)
    out: list[dict] = []
    for r in q.all():
        d = json.loads(r.row_json)
        out.append({k: d.get(k, "") for k in resolved})
    return out, imp.row_count


def clear_simulation_csv_mirror(db: Session, catalog_rel: str, sim_name: str) -> bool:
    """Remove DB mirror for this scenario."""
    existing = (
        db.query(SimulationCsvImport)
        .filter(
            SimulationCsvImport.catalog_rel == catalog_rel,
            SimulationCsvImport.sim_name == sim_name,
        )
        .first()
    )
    if not existing:
        return False
    try:
        _clear_import_and_rows(db, existing)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return True


def ensure_bundle_import(
    db: Session,
    catalog_rel: str,
    sim_name: str,
    design_dir: str,
    *,
    force: bool = False,
) -> Optional[SimulationCsvImport]:
    """
    If SQLite mirror is missing or stale, import from {sim_name}.data Parquet bundle.
    Returns effective import row or None if bundle missing.
    """
    from simulation_parquet_bundle import bundle_exists

    if not bundle_exists(design_dir, sim_name):
        return None
    imp = get_effective_import(db, catalog_rel, sim_name, design_dir)
    if imp is not None and not force:
        return imp
    import_simulation_parquet_bundle(db, catalog_rel, sim_name, design_dir, force=True)
    return get_effective_import(db, catalog_rel, sim_name, design_dir)
