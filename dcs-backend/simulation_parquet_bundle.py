"""
On-disk scenario data as a directory named like the old CSV stem: {sim_name}.data/
  manifest.json + c0000.parquet, c0001.parquet, ... (one column per file, row order preserved).

Runtime rule: the API does not read *.data.csv; it uses SQLite mirrors and/or these Parquet files.
Git-friendly binary backup: copy the {sim_name}.data/ tree to migrate DB to another machine.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Optional

import numpy as np
import pandas as pd

# Column shards written as c0000.parquet, c0001.parquet, ...
_COLUMN_PARQUET_RE = re.compile(r"^c\d{4}\.parquet$")

MANIFEST_NAME = "manifest.json"
COLUMN_FILE_PREFIX = "c"
MANIFEST_VERSION = 1


def scenario_data_dir(design_dir: str, sim_name: str) -> str:
    """Directory basename matches the old CSV stem: {sim_name}.data.csv -> {sim_name}.data/"""
    return os.path.join(design_dir, f"{sim_name}.data")


def manifest_path(design_dir: str, sim_name: str) -> str:
    return os.path.join(scenario_data_dir(design_dir, sim_name), MANIFEST_NAME)


def bundle_exists(design_dir: str, sim_name: str) -> bool:
    m = manifest_path(design_dir, sim_name)
    return os.path.isfile(m)


def bundle_stat_key(design_dir: str, sim_name: str) -> Optional[tuple[int, int]]:
    mp = manifest_path(design_dir, sim_name)
    if not os.path.isfile(mp):
        return None
    st = os.stat(mp)
    mtime_ns = getattr(st, "st_mtime_ns", int(st.st_mtime * 1e9))
    return (int(st.st_size), int(mtime_ns))


def read_manifest(design_dir: str, sim_name: str) -> dict[str, Any]:
    mp = manifest_path(design_dir, sim_name)
    with open(mp, "r", encoding="utf-8") as f:
        return json.load(f)


def _remove_orphan_column_parquets(bundle_root: str, kept_filenames: set[str]) -> None:
    """
    Delete cNNNN.parquet shards not referenced by the manifest.

    After dropping columns the rewrite uses fewer files (c0000..c{k-1}); without this,
    leftover c{k}.parquet..c{n-1} from the previous bundle remain on disk.
    """
    if not os.path.isdir(bundle_root):
        return
    kept = kept_filenames or set()
    for name in os.listdir(bundle_root):
        if name not in kept and _COLUMN_PARQUET_RE.match(name):
            try:
                os.remove(os.path.join(bundle_root, name))
            except OSError:
                pass


def _null_like_for_parquet(v: Any) -> bool:
    """Missing markers in object columns must become Python None for Arrow (not float nan)."""
    if v is None:
        return True
    try:
        if isinstance(v, float) and np.isnan(v):
            return True
    except (TypeError, ValueError):
        pass
    try:
        return bool(pd.isna(v))
    except Exception:
        return False


def _normalize_parquet_scalar(v: Any) -> Any:
    """Decode bytes and unify nulls so pyarrow does not mix binary + float nan."""
    if _null_like_for_parquet(v):
        return None
    if isinstance(v, (bytes, bytearray, memoryview)):
        raw = bytes(v)
        try:
            return raw.decode("utf-8")
        except UnicodeDecodeError:
            return raw.hex()
    return v


def _sanitize_series_for_parquet(s: pd.Series) -> pd.Series:
    """
    Pickled DataFrames often use dtype object with bytes + numpy.nan; Arrow infers binary and then
    rejects nan floats ('Expected bytes, got a float object'). Normalize before to_parquet.
    """
    name = s.name
    if pd.api.types.is_numeric_dtype(s.dtype):
        return s
    if pd.api.types.is_bool_dtype(s.dtype):
        return s
    if pd.api.types.is_datetime64_any_dtype(s.dtype):
        return s
    if pd.api.types.is_timedelta64_dtype(s.dtype):
        return s
    # pandas string dtypes / categoricals generally serialize OK
    if isinstance(s.dtype, pd.CategoricalDtype):
        return s
    dtype_str = str(s.dtype)
    if dtype_str.startswith("string") or dtype_str.startswith("String"):
        return s

    if not pd.api.types.is_object_dtype(s.dtype):
        return s

    mapped = [_normalize_parquet_scalar(v) for v in s.tolist()]
    return pd.Series(mapped, dtype=object, index=s.index, name=name)


def _write_single_column_parquet(sub: pd.DataFrame, path: str) -> None:
    """Write one-column frame to parquet; stringify cells if Arrow still rejects inference."""
    try:
        sub.to_parquet(path, index=False, engine="pyarrow")
        return
    except ImportError:
        raise
    except Exception as first:
        if sub.shape[1] != 1:
            raise first
        col = sub.columns[0]
        sub2 = sub.assign(**{col: sub[col].map(lambda x: None if x is None else str(x))})
        try:
            sub2.to_parquet(path, index=False, engine="pyarrow")
        except Exception as second:
            raise second from first


def write_bundle_from_dataframe(df: pd.DataFrame, design_dir: str, sim_name: str) -> str:
    """
    Write {sim_name}.data/manifest.json + column parquets. Returns bundle root path.
    """
    if df is None or df.empty:
        raise ValueError("DataFrame is empty")
    root = scenario_data_dir(design_dir, sim_name)
    os.makedirs(root, exist_ok=True)

    columns = [str(c) for c in df.columns]
    n = len(df)
    column_files: list[str] = []
    for i, col in enumerate(columns):
        fn = f"{COLUMN_FILE_PREFIX}{i:04d}.parquet"
        column_files.append(fn)
        safe_series = _sanitize_series_for_parquet(df[col])
        sub = pd.DataFrame({"value": safe_series})
        p = os.path.join(root, fn)
        _write_single_column_parquet(sub, p)

    manifest = {
        "version": MANIFEST_VERSION,
        "columns": columns,
        "row_count": int(n),
        "column_files": column_files,
    }
    mp = os.path.join(root, MANIFEST_NAME)
    with open(mp, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write("\n")
    _remove_orphan_column_parquets(root, set(column_files))
    return root


def read_bundle_dataframe(design_dir: str, sim_name: str) -> pd.DataFrame:
    """Load full table from Parquet bundle."""
    m = read_manifest(design_dir, sim_name)
    root = scenario_data_dir(design_dir, sim_name)
    cols = m.get("columns") or []
    files = m.get("column_files") or []
    if len(cols) != len(files):
        raise ValueError("manifest columns / column_files length mismatch")
    series_list = []
    for col, fn in zip(cols, files):
        p = os.path.join(root, fn)
        part = pd.read_parquet(p, engine="pyarrow")
        if part.shape[1] != 1:
            raise ValueError(f"Expected single column in {fn}")
        series_list.append(part.iloc[:, 0].rename(col))
    return pd.concat(series_list, axis=1)


def read_bundle_columns_row_count(design_dir: str, sim_name: str) -> tuple[list[str], int]:
    m = read_manifest(design_dir, sim_name)
    return list(m.get("columns") or []), int(m.get("row_count") or 0)


def time_column_min_max_from_bundle(
    design_dir: str, sim_name: str, time_column: str
) -> tuple[Optional[float], Optional[float]]:
    """Read one numeric column parquet for min/max."""
    m = read_manifest(design_dir, sim_name)
    cols = m.get("columns") or []
    files = m.get("column_files") or []
    root = scenario_data_dir(design_dir, sim_name)
    try:
        idx = cols.index(time_column)
    except ValueError:
        return None, None
    p = os.path.join(root, files[idx])
    s = pd.read_parquet(p, engine="pyarrow").iloc[:, 0]
    numeric = pd.to_numeric(s, errors="coerce")
    valid = numeric.dropna()
    if valid.empty:
        return None, None
    return float(valid.min()), float(valid.max())


def resolve_bundle_column_name(columns: list[str], requested: str) -> Optional[str]:
    """Exact match, then trimmed equality."""
    if not requested:
        return None
    if requested in columns:
        return requested
    rq = requested.strip()
    for c in columns:
        if str(c).strip() == rq:
            return str(c)
    return None


def delete_bundle_column(design_dir: str, sim_name: str, column_name: str) -> bool:
    """
    Drop one column from the Parquet bundle (rewrite manifest + column files).
    Returns True if the bundle was rewritten.
    Raises ValueError if unknown column or last column.
    """
    if not bundle_exists(design_dir, sim_name):
        raise FileNotFoundError("scenario bundle missing")
    df = read_bundle_dataframe(design_dir, sim_name)
    cols = [str(c) for c in df.columns]
    hit = resolve_bundle_column_name(cols, column_name)
    if hit is None:
        raise ValueError(f"Unknown column: {column_name}")
    if len(cols) <= 1:
        raise ValueError("Cannot delete the last remaining column")
    df2 = df.drop(columns=[hit])
    write_bundle_from_dataframe(df2, design_dir, sim_name)
    return True


def legacy_csv_path(design_dir: str, sim_name: str) -> str:
    """Former canonical path (migration only)."""
    return os.path.join(design_dir, f"{sim_name}.data.csv")
