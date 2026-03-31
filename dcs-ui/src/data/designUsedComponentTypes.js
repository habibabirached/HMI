/**
 * Canvas `type` values appearing in either:
 *   dcs-backend/designs/fullblock/fullblock.conf.json
 *   dcs-backend/designs/halfblock/halfblock.conf.json
 * Union of types in fullblock + halfblock. Update when designs add components.
 */
export const REFERENCE_DESIGN_CANVAS_TYPES = new Set([
  'auxiliary-loads-bess',
  'bess-50mw',
  'bess-xfmr',
  'breaker-bess',
  'breaker-dc',
  'breaker-gen-13.8',
  'breaker-hv',
  'breaker-hv-boxed',
  'breaker-lv',
  'bus-hv-vertical',
  'bus-knot',
  'ct',
  'disconnect-switch',
  'gas-turbine-lm2500-andritz',
  'gsu',
  'inverter',
  'it-pcs-rect-inv',
  'it-rack-load',
  'manual-line-switch',
  'rectifier',
  'ups'
]);

/** Whether a palette row is used in the reference fullblock/halfblock designs (matches canvas `type` or library id). */
export function isComponentUsedInReferenceDesigns(comp) {
  if (!comp) return false;
  if (REFERENCE_DESIGN_CANVAS_TYPES.has(comp.id)) return true;
  if (comp.type != null && REFERENCE_DESIGN_CANVAS_TYPES.has(comp.type)) return true;
  return false;
}
