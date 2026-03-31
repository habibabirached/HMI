#!/usr/bin/env python3
"""Build fullblock.conf.json: dual 34.5kV buses, seven bus-tie bays, continuous vertical buses."""
from __future__ import annotations

import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "fullblock.conf.json"

# Canvas grid in dcs-ui/src/components/Canvas/Canvas.jsx — minimum clear air between bounding boxes.
MIN_GRID_GAP = 50

# Spacing tuned so chains clear neighboring rows (reference fullBlock SLD).
GAP = 78
# Horizontal gap LM2500 → Gen CB → GSU → CT: edge-to-edge ≥ MIN_GRID_GAP.
GEN_H_GAP = 100
BUS_TO_FIRST_TIE = 94
# Horizontal gap between consecutive IT-branch symbols (rect / inv / UPS / …).
IT_BRANCH_GAP = MIN_GRID_GAP
# Horizontal inset of aux load from AC knot (keeps label / tie lines off the stack).
IT_AUX_X_INSET = 62
# Left bus nudged right so IT + gen chains still clear canvas west edge after wider spacing.
X_BUS_L = 1040

# One tie row: all symbol widths = GRID (50px) for even spacing (matches componentVisuals.js).
TIE_MAIN_WIDTHS: list[int] = [50] * 17

# Mirror widths (match componentVisuals.js, for 4-corner symmetry about bus midline).
_DIM_W = {
    "gas-turbine-lm2500-andritz": 100,
    "breaker-gen-13.8": 50,
    "breaker-bess": 50,
    "bess-xfmr": 100,
    "gsu": 100,
    "ct": 50,
    "bess-50mw": 150,
    "bus-knot": 50,
    "breaker-dc": 50,
    "breaker-lv": 50,
    "breaker-hv": 50,
    "breaker-hv-boxed": 50,
    "disconnect-switch": 50,
    "manual-line-switch": 50,
    "rectifier": 80,
    "inverter": 80,
    "it-rack-load": 100,
    "it-pcs-rect-inv": 100,
    "auxiliary-loads-bess": 150,
    "ups": 100,
}

# Bounding-box heights for vertical stacking (componentVisuals.js).
H_GSU_IT = 100
H_AUX_LOAD = 100
H_AUX_CB = 50

GRID = 50

STYLE_GREEN = {
    "useAuto": False,
    "color": "#2d7a32",
    "thickness": 5,
    "animation": "none",
    "depth3d": 38,
    "glossiness": 18,
    "shadow": {
        "blur": 4,
        "offsetX": 2,
        "offsetY": 2,
        "opacity": 0.35,
        "color": "#000000",
    },
}
STYLE_RED = {
    "useAuto": False,
    "color": "#ef5350",
    "thickness": 5,
    "animation": "none",
    "depth3d": 38,
    "glossiness": 18,
    "shadow": {
        "blur": 4,
        "offsetX": 2,
        "offsetY": 2,
        "opacity": 0.35,
        "color": "#000000",
    },
}

_BBOX: dict[str, tuple[int, int]] = {
    "bus-hv-vertical": (25, 250),
    "ct": (50, 50),
    "breaker-hv": (50, 50),
    "breaker-hv-boxed": (50, 50),
    "disconnect-switch": (50, 50),
    "manual-line-switch": (50, 50),
    "bus-knot": (50, 50),
    "gas-turbine-lm2500-andritz": (100, 150),
    "breaker-gen-13.8": (50, 50),
    "gsu": (100, 100),
    "bess-50mw": (150, 100),
    "breaker-bess": (50, 50),
    "bess-xfmr": (100, 100),
    "it-rack-load": (100, 100),
    "it-pcs-rect-inv": (100, 50),
    "ups": (100, 100),
    "inverter": (80, 100),
    "rectifier": (80, 90),
    "breaker-dc": (50, 50),
    "breaker-lv": (50, 50),
    "auxiliary-loads-bess": (150, 100),
}


def st(v: float) -> float:
    return round(v, 1)


def snap_component_to_grid(c: dict) -> None:
    """Snap component **center** to GRID (same rule as dcs-ui Canvas snapCenterToGrid)."""
    typ = c["type"]
    w0, h0 = _BBOX.get(typ, (80, 80))
    vo = c.get("visualOverrides") or {}
    w = float(vo.get("width", w0))
    h = float(vo.get("height", h0))
    cx = c["position"]["x"] + w / 2
    cy = c["position"]["y"] + h / 2
    scx = round(cx / GRID) * GRID
    scy = round(cy / GRID) * GRID
    c["position"]["x"] = st(scx - w / 2)
    c["position"]["y"] = st(scy - h / 2)


def left_edges_chain(widths: list[int], x0: float, gap: float) -> list[float]:
    xs: list[float] = []
    x = x0
    for w in widths:
        xs.append(st(x))
        x += w + gap
    return xs


def comp(
    cid: str,
    typ: str,
    name: str,
    full_name: str,
    x: float,
    y: float,
    props: dict,
    *,
    v_state: float | None = None,
    soc: int | None = None,
    visual_overrides: dict | None = None,
    is_tripped: bool = False,
) -> dict:
    vs = 34.5 if v_state is None else v_state
    c = {
        "id": cid,
        "type": typ,
        "name": name,
        "fullName": full_name,
        "position": {"x": st(x), "y": st(y)},
        "status": "idle",
        "properties": props,
        "state": {"power": 0, "voltage": vs, "current": 0, "frequency": 60},
        "isTripped": is_tripped,
    }
    if soc is not None:
        c["state"]["soc"] = soc
    if visual_overrides:
        c["visualOverrides"] = visual_overrides
    return c


def main():
    canvas: list[dict] = []
    connections: list[dict] = []
    conn_id = 0

    def conn(frm: str, to: str, style: dict | None = None) -> None:
        nonlocal conn_id
        row: dict = {
            "id": f"conn-{conn_id}",
            "from": frm,
            "to": to,
            "type": "power",
            "status": "idle",
        }
        if style is not None:
            row["style"] = copy.deepcopy(style)
        connections.append(row)
        conn_id += 1

    # --- Buses: one continuous vertical bar per side (30 grid cells tall) ---
    BUS_W = GRID // 2
    bus_h = 30 * GRID
    bus_y_init = 6
    seg_ref_h = 5 * GRID
    first_cy = bus_y_init + seg_ref_h / 2
    # Align bus top with the former first stacked segment (tie / feeder Ys stay consistent).
    bus_y = round(first_cy / GRID) * GRID - seg_ref_h / 2
    x_bus_l = X_BUS_L
    tie_x0 = x_bus_l + BUS_W + BUS_TO_FIRST_TIE
    tie_xs = left_edges_chain(TIE_MAIN_WIDTHS, tie_x0, MIN_GRID_GAP)
    x_bus_r = round(tie_xs[-1] + 52 + GAP + 32, 0)

    bus_id_l = "comp-bus-left"
    bus_id_r = "comp-bus-right"
    canvas.append(
        comp(
            bus_id_l,
            "bus-hv-vertical",
            "34.5kV Bus L",
            "Main Distribution Bus 34.5kV (Left)",
            x_bus_l,
            bus_y,
            {"rating": 0, "voltage": 34.5, "unit": "kV"},
            visual_overrides={"width": BUS_W, "height": bus_h},
        )
    )
    canvas.append(
        comp(
            bus_id_r,
            "bus-hv-vertical",
            "34.5kV Bus R",
            "Main Distribution Bus 34.5kV (Right)",
            x_bus_r,
            bus_y,
            {"rating": 0, "voltage": 34.5, "unit": "kV"},
            visual_overrides={"width": BUS_W, "height": bus_h},
        )
    )

    def left_seg_for_y(y: float) -> str:
        return bus_id_l

    def right_seg_for_y(y: float) -> str:
        return bus_id_r

    bus_cx_l = x_bus_l + BUS_W / 2
    bus_cx_r = x_bus_r + BUS_W / 2

    # Sectional CB graphics on the long bus (same Y spacing as former 5-stack layout); not wired.
    seg_h = 5 * GRID
    gap_h = GRID
    y_sec = bus_y
    for si in range(5):
        y_sec += seg_h
        if si < 4:
            bx_l = st(bus_cx_l - GRID / 2)
            bx_r = st(bus_cx_r - GRID / 2)
            sid = si + 1
            canvas.append(
                comp(
                    f"comp-bus-section-cb-l-{sid}",
                    "breaker-hv-boxed",
                    "CB",
                    "Bus section / riser CB 34.5kV (graphic)",
                    bx_l,
                    y_sec,
                    {"rating": 0, "voltage": 34.5, "unit": ""},
                )
            )
            canvas.append(
                comp(
                    f"comp-bus-section-cb-r-{sid}",
                    "breaker-hv-boxed",
                    "CB",
                    "Bus section / riser CB 34.5kV (graphic)",
                    bx_r,
                    y_sec,
                    {"rating": 0, "voltage": 34.5, "unit": ""},
                )
            )
            y_sec += gap_h

    # LC feeder column: CT west/east of bus; turb–CB–GSU–CT westward.
    FEEDER_INSET = 50
    x_ctl = x_bus_l - FEEDER_INSET - _DIM_W["ct"]
    x_gsul = x_ctl - GEN_H_GAP - _DIM_W["gsu"]
    x_cbl = x_gsul - GEN_H_GAP - _DIM_W["breaker-gen-13.8"]
    x_tl = x_cbl - GEN_H_GAP - _DIM_W["gas-turbine-lm2500-andritz"]
    x_ct_r_feed = x_bus_r + BUS_W + FEEDER_INSET
    bus_mid_x = (bus_cx_l + bus_cx_r) / 2

    def mir_x(x: float, typ: str) -> float:
        w = _DIM_W.get(typ, 80)
        return st(2 * bus_mid_x - x - w)

    n_tie = 7
    raw_step = bus_h / (n_tie + 1)
    tie_y = [st(round((bus_y + raw_step * (k + 1)) / GRID) * GRID) for k in range(n_tie)]

    # --- Bus ties: white SLD — 6 CT, 3 CB, 6 manual sw, 2 knots, 2 retour ---
    RETOUR_Y_OFF = 100
    KNOT_W = 50
    for i, yc in enumerate(tie_y, start=1):
        p = f"comp-tie-{i}"
        xs = tie_xs
        j1_i, j2_i = 5, 11

        canvas.append(
            comp(
                f"{p}-sw-a",
                "manual-line-switch",
                "",
                "Manual line disconnect 34.5kV",
                xs[0],
                yc,
                {"rating": 3500, "voltage": 34.5, "unit": "A"},
            )
        )
        canvas.append(
            comp(
                f"{p}-ct-a",
                "ct",
                "CT",
                "Current Transformer 3500:1",
                xs[1],
                yc,
                {"rating": 0, "voltage": 0, "unit": ""},
            )
        )
        canvas.append(
            comp(
                f"{p}-brk-l",
                "breaker-hv",
                "Bay CB",
                "Bay / Bus Tie CB 34.5kV 3500A",
                xs[2],
                yc,
                {"rating": 3500, "voltage": 34.5, "unit": "A"},
            )
        )
        canvas.append(
            comp(
                f"{p}-ct-b",
                "ct",
                "CT",
                "Current Transformer 3500:1",
                xs[3],
                yc,
                {"rating": 0, "voltage": 0, "unit": ""},
            )
        )
        canvas.append(
            comp(
                f"{p}-sw-b",
                "manual-line-switch",
                "",
                "Manual line disconnect 34.5kV",
                xs[4],
                yc,
                {"rating": 3500, "voltage": 34.5, "unit": "A"},
            )
        )
        canvas.append(
            comp(
                f"{p}-j1",
                "bus-knot",
                "",
                "Tie / bypass junction",
                xs[5],
                yc,
                {"rating": 0, "voltage": 0, "unit": ""},
                v_state=34.5,
            )
        )
        canvas.append(
            comp(
                f"{p}-sw-c",
                "manual-line-switch",
                "",
                "Manual line disconnect 34.5kV",
                xs[6],
                yc,
                {"rating": 3500, "voltage": 34.5, "unit": "A"},
            )
        )
        canvas.append(
            comp(
                f"{p}-ct-c",
                "ct",
                "CT",
                "Current Transformer 3500:1",
                xs[7],
                yc,
                {"rating": 0, "voltage": 0, "unit": ""},
            )
        )
        canvas.append(
            comp(
                f"{p}-brk-m",
                "breaker-hv",
                "Tie CB",
                "Center bus-tie CB 34.5kV 3500A",
                xs[8],
                yc,
                {"rating": 3500, "voltage": 34.5, "unit": "A"},
            )
        )
        canvas.append(
            comp(
                f"{p}-ct-d",
                "ct",
                "CT",
                "Current Transformer 3500:1",
                xs[9],
                yc,
                {"rating": 0, "voltage": 0, "unit": ""},
            )
        )
        canvas.append(
            comp(
                f"{p}-sw-d",
                "manual-line-switch",
                "",
                "Manual line disconnect 34.5kV",
                xs[10],
                yc,
                {"rating": 3500, "voltage": 34.5, "unit": "A"},
            )
        )
        canvas.append(
            comp(
                f"{p}-j2",
                "bus-knot",
                "",
                "Tie / bypass junction",
                xs[11],
                yc,
                {"rating": 0, "voltage": 0, "unit": ""},
                v_state=34.5,
            )
        )
        canvas.append(
            comp(
                f"{p}-sw-e",
                "manual-line-switch",
                "",
                "Manual line disconnect 34.5kV",
                xs[12],
                yc,
                {"rating": 3500, "voltage": 34.5, "unit": "A"},
            )
        )
        canvas.append(
            comp(
                f"{p}-ct-e",
                "ct",
                "CT",
                "Current Transformer 3500:1",
                xs[13],
                yc,
                {"rating": 0, "voltage": 0, "unit": ""},
            )
        )
        canvas.append(
            comp(
                f"{p}-brk-r",
                "breaker-hv",
                "Bay CB",
                "Bay / Bus Tie CB 34.5kV 3500A",
                xs[14],
                yc,
                {"rating": 3500, "voltage": 34.5, "unit": "A"},
            )
        )
        canvas.append(
            comp(
                f"{p}-ct-f",
                "ct",
                "CT",
                "Current Transformer 3500:1",
                xs[15],
                yc,
                {"rating": 0, "voltage": 0, "unit": ""},
            )
        )
        canvas.append(
            comp(
                f"{p}-sw-f",
                "manual-line-switch",
                "",
                "Manual line disconnect 34.5kV",
                xs[16],
                yc,
                {"rating": 3500, "voltage": 34.5, "unit": "A"},
            )
        )

        x_ret_l = st((bus_cx_l + xs[j1_i] + KNOT_W / 2) / 2)
        x_ret_r = st((bus_cx_r + xs[j2_i] + KNOT_W / 2) / 2)
        y_ret = yc - RETOUR_Y_OFF
        canvas.append(
            comp(
                f"{p}-ret-l",
                "manual-line-switch",
                "Retour",
                "Bypass (retour) disconnect",
                x_ret_l - 18,
                y_ret,
                {"rating": 3500, "voltage": 34.5, "unit": "A"},
            )
        )
        canvas.append(
            comp(
                f"{p}-ret-r",
                "manual-line-switch",
                "Retour",
                "Bypass (retour) disconnect",
                x_ret_r - 18,
                y_ret,
                {"rating": 3500, "voltage": 34.5, "unit": "A"},
            )
        )

        main_ids = [
            f"{p}-sw-a",
            f"{p}-ct-a",
            f"{p}-brk-l",
            f"{p}-ct-b",
            f"{p}-sw-b",
            f"{p}-j1",
            f"{p}-sw-c",
            f"{p}-ct-c",
            f"{p}-brk-m",
            f"{p}-ct-d",
            f"{p}-sw-d",
            f"{p}-j2",
            f"{p}-sw-e",
            f"{p}-ct-e",
            f"{p}-brk-r",
            f"{p}-ct-f",
            f"{p}-sw-f",
        ]
        tap_y = yc + 25
        conn(left_seg_for_y(tap_y), main_ids[0])
        for a, b in zip(main_ids[:-1], main_ids[1:]):
            conn(a, b)
        conn(main_ids[-1], right_seg_for_y(tap_y))

        conn(left_seg_for_y(tap_y), f"{p}-ret-l")
        conn(f"{p}-ret-l", f"{p}-j1")
        conn(right_seg_for_y(tap_y), f"{p}-ret-r")
        conn(f"{p}-ret-r", f"{p}-j2")

    # --- Left wing: PNG order — IT top, turbines, BESS mid, IT bottom ---
    # Top IT row (h_GSU_IT below yc) must clear row-1 LM2500 top by MIN_GRID_GAP:
    #   y_it_top + 75 + MIN_GRID_GAP <= y_g[0] - 17.5  →  y_g[0] >= y_it_top + 142.5
    # Adjacent gen rows: Δy ≥ 135. BESS between rows 2–3 needs y_g[2]-y_g[1] ≥ 285 (see BESS notes above).
    # Bottom IT: y_it_bot >= y_g[3] + 142.5 so last LM2500 clears bottom IT GSU.
    y_it_top = 302
    # Row spacing: GSU stacks in the same x column need Δy ≥ 150 between feeder rows; BESS needs
    # a wide y_g[2]-y_g[1] so bess-xfmr clears LM2500 GSU above and below (Δ ≥ 285).
    y_g = [465, 615, 940, 1095]
    y_bess = 800
    y_it_bot = 1240

    def add_gen_pair(n: int, yc: float) -> None:
        """Left generator n + mirror right generator n+4 (4-corner symmetry)."""
        nr = n + 4
        tid_l = f"comp-turbine-{n}"
        tid_r = f"comp-turbine-{nr}"
        canvas.append(
            comp(
                tid_l,
                "gas-turbine-lm2500-andritz",
                f"LM2500 L#{n}",
                "LM2500 Andritz A03 33.3 MW",
                x_tl,
                yc - 55,
                {"rating": 33.3, "voltage": 13.8, "unit": "MW"},
                v_state=13.8,
            )
        )
        canvas.append(
            comp(
                tid_r,
                "gas-turbine-lm2500-andritz",
                f"LM2500 R#{n}",
                "LM2500 Andritz A03 33.3 MW",
                mir_x(x_tl, "gas-turbine-lm2500-andritz"),
                yc - 55,
                {"rating": 33.3, "voltage": 13.8, "unit": "MW"},
                v_state=13.8,
            )
        )
        canvas.append(
            comp(
                f"comp-gen-cb-{n}",
                "breaker-gen-13.8",
                "Gen CB",
                "Generator CB 13.8 kV",
                x_cbl,
                yc - 5,
                {"rating": 2000, "voltage": 13.8, "unit": "A"},
                v_state=13.8,
            )
        )
        canvas.append(
            comp(
                f"comp-gen-cb-{nr}",
                "breaker-gen-13.8",
                "Gen CB",
                "Generator CB 13.8 kV",
                mir_x(x_cbl, "breaker-gen-13.8"),
                yc - 5,
                {"rating": 2000, "voltage": 13.8, "unit": "A"},
                v_state=13.8,
            )
        )
        canvas.append(
            comp(
                f"comp-gsu-gen-{n}",
                "gsu",
                "GSU",
                "Generator Step-Up Transformer",
                x_gsul,
                yc - 30,
                {
                    "rating": 35,
                    "unit": "MVA",
                    "primaryVoltageKv": 13.8,
                    "secondaryVoltageKv": 34.5,
                },
                v_state=13.8,
            )
        )
        canvas.append(
            comp(
                f"comp-gsu-gen-{nr}",
                "gsu",
                "GSU",
                "Generator Step-Up Transformer",
                mir_x(x_gsul, "gsu"),
                yc - 30,
                {
                    "rating": 35,
                    "unit": "MVA",
                    "primaryVoltageKv": 13.8,
                    "secondaryVoltageKv": 34.5,
                },
                v_state=13.8,
            )
        )
        canvas.append(
            comp(
                f"comp-ct-gen-800-{n}",
                "ct",
                "CT",
                "Current Transformer 800:1",
                x_ctl,
                yc - 5,
                {"rating": 800, "voltage": 0, "unit": "800:1"},
            )
        )
        canvas.append(
            comp(
                f"comp-ct-gen-800-{nr}",
                "ct",
                "CT",
                "Current Transformer 800:1",
                mir_x(x_ctl, "ct"),
                yc - 5,
                {"rating": 800, "voltage": 0, "unit": "800:1"},
            )
        )
        conn(tid_l, f"comp-gen-cb-{n}")
        conn(f"comp-gen-cb-{n}", f"comp-gsu-gen-{n}", STYLE_GREEN)
        conn(f"comp-gsu-gen-{n}", f"comp-ct-gen-800-{n}", STYLE_GREEN)
        conn(f"comp-ct-gen-800-{n}", left_seg_for_y(yc + 20), STYLE_GREEN)
        conn(right_seg_for_y(yc + 20), f"comp-ct-gen-800-{nr}", STYLE_GREEN)
        conn(f"comp-ct-gen-800-{nr}", f"comp-gsu-gen-{nr}", STYLE_GREEN)
        conn(f"comp-gsu-gen-{nr}", f"comp-gen-cb-{nr}", STYLE_GREEN)
        conn(f"comp-gen-cb-{nr}", tid_r)

    add_gen_pair(1, y_g[0])
    add_gen_pair(2, y_g[1])
    add_gen_pair(3, y_g[2])
    add_gen_pair(4, y_g[3])

    # BESS left (between gen pairs on diagram)
    canvas.append(
        comp(
            "comp-bess-left",
            "bess-50mw",
            "BESS 50MW L",
            "Battery Energy Storage System 50MW",
            x_tl,
            y_bess - 50,
            {"rating": 50, "voltage": 34.5, "unit": "MW"},
            soc=85,
        )
    )
    canvas.append(
        comp(
            "comp-bess-cb-left",
            "breaker-bess",
            "BESS CB L",
            "BESS Circuit Breaker",
            x_cbl,
            y_bess - 25,
            {"rating": 2000, "voltage": 34.5, "unit": "A"},
        )
    )
    canvas.append(
        comp(
            "comp-bess-xfmr-left",
            "bess-xfmr",
            "BESS Xfmr L",
            "BESS Transformer",
            x_gsul,
            y_bess - 50,
            {
                "rating": 50,
                "unit": "MVA",
                "secondaryVoltageKv": 34.5,
            },
        )
    )
    canvas.append(
        comp(
            "comp-ct-bess-left",
            "ct",
            "CT",
            "Current Transformer 2000:1",
            x_ctl,
            y_bess - 25,
            {"rating": 2000, "voltage": 0, "unit": "2000:1"},
        )
    )
    for a, b in [
        ("comp-bess-left", "comp-bess-cb-left"),
        ("comp-bess-cb-left", "comp-bess-xfmr-left"),
        ("comp-bess-xfmr-left", "comp-ct-bess-left"),
    ]:
        conn(a, b)
    conn("comp-ct-bess-left", left_seg_for_y(y_bess), STYLE_GREEN)

    canvas.append(
        comp(
            "comp-bess-right",
            "bess-50mw",
            "BESS 50MW R",
            "Battery Energy Storage System 50MW",
            mir_x(x_tl, "bess-50mw"),
            y_bess - 50,
            {"rating": 50, "voltage": 34.5, "unit": "MW"},
            soc=85,
        )
    )
    canvas.append(
        comp(
            "comp-bess-cb-right",
            "breaker-bess",
            "BESS CB R",
            "BESS Circuit Breaker",
            mir_x(x_cbl, "breaker-bess"),
            y_bess - 25,
            {"rating": 2000, "voltage": 34.5, "unit": "A"},
        )
    )
    canvas.append(
        comp(
            "comp-bess-xfmr-right",
            "bess-xfmr",
            "BESS Xfmr R",
            "BESS Transformer",
            mir_x(x_gsul, "bess-xfmr"),
            y_bess - 50,
            {"rating": 50, "unit": "MVA", "secondaryVoltageKv": 34.5},
        )
    )
    canvas.append(
        comp(
            "comp-ct-bess-right",
            "ct",
            "CT",
            "Current Transformer 2000:1",
            mir_x(x_ctl, "ct"),
            y_bess - 25,
            {"rating": 2000, "voltage": 0, "unit": "2000:1"},
        )
    )
    conn(right_seg_for_y(y_bess), "comp-ct-bess-right", STYLE_GREEN)
    conn("comp-ct-bess-right", "comp-bess-xfmr-right")
    conn("comp-bess-xfmr-right", "comp-bess-cb-right")
    conn("comp-bess-cb-right", "comp-bess-right")

    def place_it_west_rack_east_bus(x_ct_col: float) -> dict[str, float]:
        """White SLD: IT Rack → UPS → single Rect/Inv → DC CB → GSU knot chain → CT → bus."""
        order = [
            ("rack", "it-rack-load"),
            ("ups", "ups"),
            ("pcs", "it-pcs-rect-inv"),
            ("dc_cb", "breaker-dc"),
            ("knot", "bus-knot"),
            ("xfmr", "gsu"),
            ("ct", "ct"),
        ]
        x = 32.0
        pos: dict[str, float] = {}
        for key, typ in order:
            pos[key] = x
            x += _DIM_W[typ] + IT_BRANCH_GAP
        dx = x_ct_col - pos["ct"]
        for key in pos:
            pos[key] = st(pos[key] + dx)
        return pos

    def place_it_east_bus_east_rack(x_ct_col: float) -> dict[str, float]:
        order = [
            ("ct", "ct"),
            ("xfmr", "gsu"),
            ("knot", "bus-knot"),
            ("dc_cb", "breaker-dc"),
            ("pcs", "it-pcs-rect-inv"),
            ("ups", "ups"),
            ("rack", "it-rack-load"),
        ]
        x = x_ct_col
        pos: dict[str, float] = {}
        for key, typ in order:
            pos[key] = st(x)
            x += _DIM_W[typ] + IT_BRANCH_GAP
        return pos

    def emit_it_png_branch(
        prefix: str,
        tag: str,
        ax: dict[str, float],
        bus_id: str,
        yc: float,
        rack_y_extra: float,
        *,
        aux_above: bool,
    ) -> None:
        pl = prefix
        y_trunk_50 = yc
        y_ups_row = yc - 25
        y_rack = yc + rack_y_extra
        y_gsu_top = yc - 25
        if aux_above:
            # Aux CB between aux load and IT GSU; ≥ MIN_GRID_GAP between each pair.
            y_aux_cb = y_gsu_top - MIN_GRID_GAP - H_AUX_CB
            y_aux = y_aux_cb - MIN_GRID_GAP - H_AUX_LOAD
        else:
            y_aux_cb = y_gsu_top + H_GSU_IT + MIN_GRID_GAP
            y_aux = y_aux_cb + H_AUX_CB + MIN_GRID_GAP

        canvas.append(
            comp(
                f"{pl}-ct",
                "ct",
                "CT",
                "Current Transformer 1500:1",
                ax["ct"],
                yc,
                {"rating": 1500, "voltage": 0, "unit": "1500:1"},
            )
        )
        canvas.append(
            comp(
                f"{pl}-xfmr",
                "gsu",
                "GSU",
                "GSU 34.5 kV : 480 V 35 MVA",
                ax["xfmr"],
                yc - 25,
                {
                    "rating": 35,
                    "unit": "MVA",
                    "primaryVoltageKv": 34.5,
                    "secondaryVoltageKv": 0.48,
                },
                v_state=34.5,
            )
        )
        canvas.append(
            comp(
                f"{pl}-knot",
                "bus-knot",
                "",
                "Connection Point",
                ax["knot"],
                y_trunk_50,
                {"rating": 0, "voltage": 0, "unit": ""},
                v_state=0.48,
            )
        )
        canvas.append(
            comp(
                f"{pl}-aux",
                "auxiliary-loads-bess",
                f"Aux Loads {tag}",
                "Auxiliary Loads",
                ax["knot"] - IT_AUX_X_INSET,
                y_aux,
                {"rating": 5, "voltage": 0.48, "unit": "MW"},
                v_state=0.48,
            )
        )
        canvas.append(
            comp(
                f"{pl}-aux-cb",
                "breaker-lv",
                "Aux CB",
                "Auxiliary feeder circuit breaker",
                ax["knot"] - 25,
                y_aux_cb,
                {"rating": 4000, "voltage": 0.48, "unit": "A"},
                v_state=0.48,
            )
        )
        canvas.append(
            comp(
                f"{pl}-dc-cb",
                "breaker-dc",
                "DC CB 480V",
                "DC Circuit Breaker 480V",
                ax["dc_cb"],
                y_trunk_50,
                {"rating": 3000, "voltage": 0.48, "unit": "A"},
                v_state=0.48,
            )
        )
        canvas.append(
            comp(
                f"{pl}-pcs",
                "it-pcs-rect-inv",
                "Rectifier / Inverter",
                "UPS branch AC-DC conversion (one-line combined)",
                ax["pcs"],
                y_trunk_50,
                {"rating": 25, "voltage": 0.48, "unit": "MW"},
                v_state=0.48,
            )
        )
        canvas.append(
            comp(
                f"{pl}-ups",
                "ups",
                f"UPS {tag}",
                "UPS / LV UPS 400Vdc",
                ax["ups"],
                y_ups_row,
                {"rating": 5, "voltage": 0.4, "unit": "MVA"},
                v_state=0.4,
            )
        )
        canvas.append(
            comp(
                f"{pl}-rack",
                "it-rack-load",
                f"IT Rack {tag}",
                "IT Rack Load",
                ax["rack"],
                y_rack,
                {"rating": 25, "voltage": 0.4, "unit": "MW"},
                v_state=0.4,
            )
        )

        conn(bus_id, f"{pl}-ct", STYLE_RED)
        conn(f"{pl}-ct", f"{pl}-xfmr", STYLE_RED)
        conn(f"{pl}-xfmr", f"{pl}-knot", STYLE_RED)
        conn(f"{pl}-knot", f"{pl}-dc-cb", STYLE_RED)
        conn(f"{pl}-knot", f"{pl}-aux-cb")
        conn(f"{pl}-aux", f"{pl}-aux-cb")
        conn(f"{pl}-aux-cb", f"{pl}-knot")
        conn(f"{pl}-dc-cb", f"{pl}-pcs", STYLE_RED)
        conn(f"{pl}-pcs", f"{pl}-ups", STYLE_RED)
        conn(f"{pl}-ups", f"{pl}-rack")

    emit_it_png_branch(
        "comp-it-lt",
        "lt",
        place_it_west_rack_east_bus(x_ctl),
        left_seg_for_y(y_it_top + 25),
        y_it_top,
        168,
        aux_above=True,
    )
    emit_it_png_branch(
        "comp-it-lb",
        "lb",
        place_it_west_rack_east_bus(x_ctl),
        left_seg_for_y(y_it_bot + 25),
        y_it_bot,
        -168,
        aux_above=False,
    )
    emit_it_png_branch(
        "comp-it-rt",
        "rt",
        place_it_east_bus_east_rack(x_ct_r_feed),
        right_seg_for_y(y_it_top + 25),
        y_it_top,
        168,
        aux_above=True,
    )
    emit_it_png_branch(
        "comp-it-rb",
        "rb",
        place_it_east_bus_east_rack(x_ct_r_feed),
        right_seg_for_y(y_it_bot + 25),
        y_it_bot,
        -168,
        aux_above=False,
    )

    for c in canvas:
        snap_component_to_grid(c)

    doc = {
        "name": "FullBlock",
        "description": "Dual 34.5 kV buses, seven bus-tie bays, continuous vertical buses (30 grid cells); boxed sectional CB graphics on the bus (unwired); feeder CT off-bus; layout snapped to 50 px grid by component center.",
        "canvasComponents": canvas,
        "connections": connections,
        "systemState": {
            "simulationRunning": False,
            "zoom": 0.72,
            "pan": {"x": 20, "y": 10},
            "mode": "design",
        },
    }

    with open(OUT, "w") as f:
        json.dump(doc, f, indent=2)
        f.write("\n")
    print("Wrote", OUT, "components", len(canvas), "connections", len(connections))


if __name__ == "__main__":
    main()
