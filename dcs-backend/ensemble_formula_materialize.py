"""
Materialize ensemble chart_panel.derived_variables into a normal scenario
`formula` (default id) with formula.data.csv + formula.sim.json.

Matches browser evaluation in dcs-ui/src/utils/formulaEvaluator.js and
qualifyEnsembleColumn in simulationLazyApi.js (ENSEMBLE_COLUMN_SEP).
"""

from __future__ import annotations

import csv
import json
import math
import os
import re
from typing import Any, Optional

import pandas as pd

# Same as dcs-ui ENSEMBLE_COLUMN_SEP: space, EM DASH (U+2014), space
ENSEMBLE_COLUMN_SEP = " \u2014 "


def _qualify_ensemble_column(simulation_id: str, column_name: str) -> str:
    sid = (simulation_id or "").strip()
    c = "" if column_name is None else str(column_name)
    if not sid or not c:
        return c
    return f"{sid}{ENSEMBLE_COLUMN_SEP}{c}"


def _evaluate_formula(formula: str, row: dict[str, float]) -> float:
    if not formula or not str(formula).strip():
        return float("nan")
    expr = str(formula).strip()
    scope: dict[str, float] = {}
    for k, v in row.items():
        try:
            num = float(v)
        except (TypeError, ValueError):
            num = 0.0
        if not math.isfinite(num):
            num = 0.0
        scope[k] = num
        tk = k.strip()
        if tk != k:
            scope[tk] = num
    names = sorted(scope.keys(), key=len, reverse=True)
    for name in names:
        val = scope[name]
        safe = str(val) if math.isfinite(val) else "0"
        expr = f"({safe})".join(expr.split(name))

    strip_fn = re.compile(r"\b(Math\.)?(sqrt|abs|sin|cos|log|exp|min|max)\b")
    stripped = strip_fn.sub("", expr)
    stripped = re.sub(r"[\d\s+\-*/().^,eE]+", "", stripped)
    if len(stripped) > 0:
        return float("nan")
    expr = expr.replace("^", "**")
    expr = re.sub(r"\bsqrt\s*\(", "math.sqrt(", expr)
    expr = re.sub(r"\babs\s*\(", "math.abs(", expr)
    expr = re.sub(r"\bsin\s*\(", "math.sin(", expr)
    expr = re.sub(r"\bcos\s*\(", "math.cos(", expr)
    expr = re.sub(r"\blog\s*\(", "math.log(", expr)
    expr = re.sub(r"\bexp\s*\(", "math.exp(", expr)
    expr = re.sub(r"\bmin\s*\(", "min(", expr)
    expr = re.sub(r"\bmax\s*\(", "max(", expr)
    try:
        out = eval(
            expr,
            {"__builtins__": {}},
            {"math": math, "min": min, "max": max},
        )
        if isinstance(out, (int, float)) and math.isfinite(float(out)):
            return float(out)
        return float("nan")
    except Exception:
        return float("nan")


def _time_column_name(df: pd.DataFrame) -> str:
    if df is None or len(df.columns) == 0:
        raise ValueError("Empty DataFrame")
    for c in df.columns:
        cl = str(c).lower().strip()
        if cl in ("time (s)", "time (sec)", "time", "t", "timestamp"):
            return str(c)
    return str(df.columns[0])


def _load_ensemble_and_members(
    ens_path: str, ensemble_id: str
) -> tuple[dict[str, Any], list[str], list[dict[str, Any]]]:
    with open(ens_path, "r", encoding="utf-8") as fp:
        data = json.load(fp)
    if not isinstance(data, dict):
        raise ValueError("Invalid ensemble file")
    raw = data.get("ensembles")
    if not isinstance(raw, list):
        raise ValueError("Invalid ensemble file: missing ensembles list")
    want = str(ensemble_id).strip()
    target: Optional[dict] = None
    for ent in raw:
        if not isinstance(ent, dict):
            continue
        eid = ent.get("id") or ent.get("name")
        if eid and str(eid).strip() == want:
            target = ent
            break
    if target is None:
        raise ValueError(f"Ensemble not found: {ensemble_id}")
    members = target.get("member_simulations") or target.get("members") or []
    if not members:
        raise ValueError("Ensemble has no member_simulations")
    members = [str(m).strip() for m in members if str(m).strip()]
    chart_panel = target.get("chart_panel") or {}
    dv = chart_panel.get("derived_variables")
    if not isinstance(dv, list):
        dv = []
    return target, members, dv


def materialize_formula_scenario_for_ensemble(
    dir_path: str,
    _catalog_rel: str,
    ensemble_id: str,
    ens_path: str,
    *,
    formula_sim_id: str = "formula",
) -> dict[str, Any]:
    """
    Read member *.data.csv files, evaluate ensemble derived_variables, write
    {formula_sim_id}.data.csv and .sim.json. Returns metadata dict.
    """
    _e, members, derived_variables = _load_ensemble_and_members(ens_path, ensemble_id)
    if not derived_variables:
        return {"skipped": True, "reason": "no derived_variables in ensemble chart_panel"}

    safe_fid = re.sub(r"[^\w\-]", "", formula_sim_id) or "formula"
    per_member: dict[str, pd.DataFrame] = {}
    for sid in members:
        csv_path = os.path.join(dir_path, f"{sid}.data.csv")
        if not os.path.isfile(csv_path):
            raise FileNotFoundError(
                f"Member scenario CSV not found: {sid}.data.csv (required for materialize)"
            )
        per_member[sid] = pd.read_csv(csv_path, encoding="utf-8-sig")
    n = min(len(df) for df in per_member.values())
    if n <= 0:
        raise ValueError("No data rows in member CSVs")

    primary = members[0]
    primary_df = per_member[primary]
    time_col = _time_column_name(primary_df)

    has_any = False
    for item in derived_variables:
        if not isinstance(item, dict):
            continue
        if str(item.get("name", "")).strip() and str(item.get("formula", "")).strip():
            has_any = True
            break
    if not has_any:
        return {"skipped": True, "reason": "no valid derived variable names"}

    out_cols: dict[str, list] = {time_col: [primary_df.iloc[i][time_col] for i in range(n)]}
    for item in derived_variables:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip()
        fml = item.get("formula", "")
        if not name or not str(fml).strip():
            continue
        col_vals: list = []
        for i in range(n):
            ev: dict[str, float] = {}
            for sid in members:
                df = per_member[sid]
                for col in df.columns:
                    key = _qualify_ensemble_column(sid, str(col))
                    raw = df.iloc[i][col]
                    try:
                        ev[key] = float(raw)
                    except (TypeError, ValueError):
                        ev[key] = 0.0
            v = _evaluate_formula(str(fml), ev)
            col_vals.append(v if math.isfinite(v) else float("nan"))
        out_cols[name] = col_vals

    out_df = pd.DataFrame(out_cols)
    csv_path_out = os.path.join(dir_path, f"{safe_fid}.data.csv")
    sim_path_out = os.path.join(dir_path, f"{safe_fid}.sim.json")
    out_df.to_csv(
        csv_path_out,
        index=False,
        quoting=csv.QUOTE_MINIMAL,
        lineterminator="\n",
    )
    # Merge or create .sim.json (keep existing charts if any)
    if os.path.isfile(sim_path_out):
        with open(sim_path_out, "r", encoding="utf-8") as fp:
            scfg = json.load(fp)
        if not isinstance(scfg, dict):
            scfg = {}
    else:
        scfg = {
            "display_name": "Formula",
            "description": "Materialized ensemble formulas (precomputed from member CSVs).",
            "charts_to_display": [],
            "event_markers": {},
        }
    scfg["display_name"] = scfg.get("display_name") or "Formula"
    scfg["data_row_count"] = int(n)
    scfg["data_column_count"] = int(len(out_df.columns))
    scfg["description"] = (
        scfg.get("description")
        or "Precomputed values from ensemble chart_panel.derived_variables."
    )
    with open(sim_path_out, "w", encoding="utf-8") as fp:
        json.dump(scfg, fp, indent=2, ensure_ascii=False)

    return {
        "ok": True,
        "formula_sim_id": safe_fid,
        "rows": n,
        "columns": int(len(out_df.columns)),
        "csv_path": csv_path_out,
    }
