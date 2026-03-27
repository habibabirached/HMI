#!/usr/bin/env python3
"""Snap HalfBlock canvas to 50px grid (center snap, same as Canvas.jsx) and
enforce >=50px horizontal gap between consecutive left-to-right neighbors on
each power chain where bounding boxes overlap vertically."""

import json
import math
from pathlib import Path

GRID = 50
GAP = 50

DIMS = {
    "bess-50mw": (150, 100),
    "breaker-bess": (55, 65),
    "bess-xfmr": (95, 95),
    "ct": (50, 50),
    "gas-turbine-lm2500-andritz": (150, 85),
    "breaker-gen-13.8": (50, 60),
    "gsu": (100, 100),
    "line-resistor": (56, 36),
    "bus-hv-vertical": (40, 200),
    "bus-knot": (24, 24),
    "breaker-dc": (55, 65),
    "rectifier": (80, 60),
    "inverter": (80, 60),
    "it-rack-load": (70, 100),
    "auxiliary-loads": (110, 70),
    "ups": (90, 70),
}

ROOT = Path(__file__).resolve().parents[1]
CONF = ROOT / "halfblock.conf.json"


def wh(comp):
    w, h = DIMS.get(comp["type"], (100, 80))
    vo = comp.get("visualOverrides") or {}
    return float(vo.get("width", w)), float(vo.get("height", h))


def snap_tl(top_x, top_y, w, h):
    """Match Canvas.jsx snapCenterToGrid (round center to grid)."""
    cx = top_x + w / 2
    cy = top_y + h / 2
    scx = round(cx / GRID) * GRID
    scy = round(cy / GRID) * GRID
    return scx - w / 2, scy - h / 2


def _place_after_min_left(min_left, w, h, y_center):
    min_cx = min_left + w / 2
    scx = math.ceil(min_cx / GRID) * GRID
    if scx - w / 2 + 1e-9 < min_left:
        scx += GRID
    scy = round(y_center / GRID) * GRID
    nx = scx - w / 2
    ny = scy - h / 2
    nx, ny = snap_tl(nx, ny, w, h)
    if nx + 1e-9 < min_left:
        cx = nx + w / 2
        while cx - w / 2 < min_left - 1e-9:
            cx += GRID
        nx = cx - w / 2
    return nx, ny


def place_chain_horizontal(comps, ids, y_center, min_left_first=50):
    prev_x, prev_w = None, None
    for i, cid in enumerate(ids):
        c = comps[cid]
        w, h = wh(c)
        if i == 0:
            nx, ny = _place_after_min_left(min_left_first, w, h, y_center)
        else:
            min_left = prev_x + prev_w + GAP
            nx, ny = _place_after_min_left(min_left, w, h, y_center)
        c["position"]["x"] = round(nx, 1)
        c["position"]["y"] = round(ny, 1)
        prev_x, prev_w = nx, w


def place_below(
    comps, knot_id, target_id, y_gap=GAP, align_x_mode="center"
):
    k = comps[knot_id]
    t = comps[target_id]
    kw, kh = wh(k)
    tw, th = wh(t)
    kx, ky = k["position"]["x"], k["position"]["y"]
    k_bottom = ky + kh
    min_top = k_bottom + y_gap
    target_cy = min_top + th / 2
    scy = round(target_cy / GRID) * GRID
    ty = scy - th / 2
    if align_x_mode == "center":
        kcx = kx + kw / 2
        tcx = round(kcx / GRID) * GRID
        tx = tcx - tw / 2
    else:
        tx = kx
    tx, ty = snap_tl(tx, ty, tw, th)
    t["position"]["x"] = round(tx, 1)
    t["position"]["y"] = round(ty, 1)


def main():
    with open(CONF) as f:
        d = json.load(f)
    comps = {c["id"]: c for c in d["canvasComponents"]}

    Y_BESS = 100
    Y_TURB = [250, 400, 550, 700]

    # Sources → bus
    place_chain_horizontal(
        comps,
        ["comp-bess-1", "comp-bess-cb", "comp-bess-xfmr", "comp-ct-bess-2000"],
        Y_BESS,
        min_left_first=50,
    )
    for i, yc in enumerate(Y_TURB, start=1):
        place_chain_horizontal(
            comps,
            [
                f"comp-turbine-{i}",
                f"comp-gen-cb-{i}",
                f"comp-gsu-gen-{i}",
                f"comp-ct-gen-800-{i}",
                f"comp-line-r-gen-{i}",
            ],
            yc,
        )

    # Bus: right of all feeders
    max_r = 0.0
    for cid in ["comp-ct-bess-2000"] + [f"comp-line-r-gen-{i}" for i in range(1, 5)]:
        c = comps[cid]
        w, _ = wh(c)
        max_r = max(max_r, c["position"]["x"] + w)
    bus = comps["comp-bus-main"]
    bw, bh = wh(bus)
    min_bus_left = max_r + GAP
    min_bus_cx = min_bus_left + bw / 2
    bus_cx = math.ceil(min_bus_cx / GRID) * GRID
    if bus_cx - bw / 2 < min_bus_left - 1e-9:
        bus_cx += GRID
    bus_y_span_top = 50.0
    bus_y_span_bot = 700.0
    bus_cy = (bus_y_span_top + bus_y_span_bot) / 2
    scy = round(bus_cy / GRID) * GRID
    bx = bus_cx - bw / 2
    by = scy - bh / 2
    bx, by = snap_tl(bx, by, bw, bh)
    bus["position"]["x"] = round(bx, 1)
    bus["position"]["y"] = round(by, 1)

    bx = bus["position"]["x"]

    # Tap branches (horizontal from bus)
    place_chain_horizontal(
        comps,
        ["comp-feeder-r-top", "comp-ct-1500-top", "comp-xfmr-1"],
        Y_BESS,
        min_left_first=bx + bw + GAP,
    )
    Y_BOT = 550
    place_chain_horizontal(
        comps,
        ["comp-feeder-r-bot", "comp-ct-1500-bot", "comp-xfmr-2"],
        Y_BOT,
        min_left_first=bx + bw + GAP,
    )

    # 480 V chains
    for branch, y_dc in (("1", Y_BESS), ("2", Y_BOT)):
        xfm = comps[f"comp-xfmr-{branch}"]
        xfmw, _ = wh(xfm)
        place_chain_horizontal(
            comps,
            [
                f"comp-knot-{branch}",
                f"comp-dc-cb-{branch}",
                f"comp-rectifier-{branch}",
                f"comp-knot-dc-{branch}",
                f"comp-inverter-{branch}",
                f"comp-it-rack-{branch}",
            ],
            y_dc,
            min_left_first=xfm["position"]["x"] + xfmw + GAP,
        )

    # Aux under AC knots; UPS under DC knots
    place_below(comps, "comp-knot-1", "comp-aux-1")
    place_below(comps, "comp-knot-dc-1", "comp-ups-1")
    place_below(comps, "comp-knot-2", "comp-aux-2")
    place_below(comps, "comp-knot-dc-2", "comp-ups-2")

    with open(CONF, "w") as f:
        json.dump(d, f, indent=2)
        f.write("\n")
    print("Wrote", CONF)


if __name__ == "__main__":
    main()
