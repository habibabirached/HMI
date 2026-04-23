/**
 * Shared helpers for one-line schematic components (GSU, future xfmr symbols).
 */

/** @returns {string|null} numeric string for kV, or null if unset / invalid */
function kvNumericString(kv) {
  if (kv == null || kv === '') return null;
  const n = Number(kv);
  if (Number.isNaN(n)) return null;
  return String(n);
}

/**
 * One-line drawing style: `13.8 kV : 34.5kV` (matches typical HV/LV labels; unknown side is `X`).
 * Returns '' only when both sides are unknown (callers show — in the property panel).
 */
export function formatVoltageRatioString(primaryKv, secondaryKv) {
  const p = kvNumericString(primaryKv);
  const s = kvNumericString(secondaryKv);
  if (p == null && s == null) return '';
  return `${p ?? 'X'} kV : ${s ?? 'X'}kV`;
}

/**
 * Reads winding kV from properties (with legacy `primary` / `secondary`).
 * - If both missing: `properties.voltage` sets both sides (legacy rows).
 * - Else if still both missing: `state.voltage` as secondary only → `X kV : 34.5kV` (common in saved designs).
 *
 * For **GSU**, stored primary = generator (LV), secondary = bus (HV). The on-screen ratio reads
 * left→right along the one-line. Set `properties.gsuBusOnComponentSide`:
 * - **`left`** (default): 34.5 kV bus ties to the **left** side of the symbol → show **HV : LV** (`secondary` : `primary`).
 * - **`right`**: 34.5 kV bus ties to the **right** side → show **LV : HV** (`primary` : `secondary`).
 */
export function transformerVoltageRatioLabel(component) {
  let p = component.properties?.primaryVoltageKv ?? component.primary;
  let s = component.properties?.secondaryVoltageKv ?? component.secondary;
  let pValid = kvNumericString(p) != null;
  let sValid = kvNumericString(s) != null;
  if (
    !pValid &&
    !sValid &&
    component.properties?.voltage != null &&
    String(component.properties.voltage) !== ''
  ) {
    const v = component.properties.voltage;
    p = v;
    s = v;
    pValid = true;
    sValid = true;
  }
  if (!pValid && !sValid) {
    const st = component.state?.voltage;
    if (st != null && String(st) !== '' && !Number.isNaN(Number(st))) {
      return formatVoltageRatioString(null, st);
    }
  }
  if (component?.type === 'gsu' && pValid && sValid) {
    const busSide = component.properties?.gsuBusOnComponentSide ?? 'left';
    if (busSide === 'right') {
      return formatVoltageRatioString(p, s);
    }
    return formatVoltageRatioString(s, p);
  }
  return formatVoltageRatioString(p, s);
}
