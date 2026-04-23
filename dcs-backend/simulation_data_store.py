"""
Load and serve simulation *.data.csv rows from the database when a mirror is present
and the file on disk is unchanged (size + mtime). Otherwise callers fall back to reading the CSV.
"""

from __future__ import annotations

import csv
import json
import os
from typing import Optional

from sqlalchemy.orm import Session

from models import SimulationCsvImport, SimulationCsvRow

BULK_ROWS = 1000


def stat_key(csv_path: str) -> tuple[int, int]:
    st = os.stat(csv_path)
    mtime_ns = getattr(st, "st_mtime_ns", int(st.st_mtime * 1e9))
    return (int(st.st_size), int(mtime_ns))


def get_effective_import(
    db: Session, catalog_rel: str, sim_name: str, sim_csv_path: str
) -> Optional[SimulationCsvImport]:
    if not sim_csv_path or not os.path.isfile(sim_csv_path):
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
    fsize, mtime = stat_key(sim_csv_path)
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


def import_simulation_csv(
    db: Session,
    catalog_rel: str,
    sim_name: str,
    csv_path: str,
    *,
    force: bool = False,
) -> tuple[str, int]:
    """
    Insert or replace DB mirror for one *.data.csv.
    Returns ("skipped" | "imported", row_count).
    """
    if not os.path.isfile(csv_path):
        raise FileNotFoundError(csv_path)
    fsize, mtime = stat_key(csv_path)
    existing = (
        db.query(SimulationCsvImport)
        .filter(
            SimulationCsvImport.catalog_rel == catalog_rel,
            SimulationCsvImport.sim_name == sim_name,
        )
        .first()
    )
    if (
        existing
        and not force
        and existing.file_size == fsize
        and existing.file_mtime_ns == mtime
    ):
        return "skipped", existing.row_count

    _clear_import_and_rows(db, existing)

    with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            imp = SimulationCsvImport(
                catalog_rel=catalog_rel,
                sim_name=sim_name,
                file_size=fsize,
                file_mtime_ns=mtime,
                row_count=0,
                header_json=json.dumps([]),
            )
            db.add(imp)
            db.commit()
            return "imported", 0
        header = [str(h) for h in reader.fieldnames]
        imp = SimulationCsvImport(
            catalog_rel=catalog_rel,
            sim_name=sim_name,
            file_size=fsize,
            file_mtime_ns=mtime,
            row_count=0,
            header_json=json.dumps(header),
        )
        db.add(imp)
        db.flush()
        batch: list[SimulationCsvRow] = []
        last_idx = -1
        for idx, row in enumerate(reader):
            last_idx = idx
            d = {k: ("" if v is None else str(v)) for k, v in row.items()}
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
        imp.row_count = last_idx + 1
    db.add(imp)
    db.commit()
    return "imported", imp.row_count


def fetch_row_page_from_db(
    db: Session,
    imp: SimulationCsvImport,
    resolved: list[str],
    offset: int,
    limit: Optional[int],
) -> tuple[list[dict], int]:
    """
    Return (projected row dicts, total_data_row_count) from DB mirror.
    """
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
    """
    Remove SimulationCsvImport and SimulationCsvRow rows for this design+scenario, if a mirror exists.
    Call when the corresponding *.data.csv and *.sim.json are removed from disk.
    """
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
