import { pickTimeColumn } from './simulationLazyApi';
import { sampleRowAtSimTime } from './ensembleTurbineMetrics';
import { findColumnKey } from './csvRowAccess';

export function effectiveSampleTime(simulationTime) {
  const t = Number(simulationTime);
  return Number.isFinite(t) ? t : 0;
}

export function formatReadoutScalar(value, decimals = 2) {
  if (value === undefined || value === null || value === '') return '—';
  const n = parseFloat(value);
  if (Number.isNaN(n)) return '—';
  const d = Number.isFinite(Number(decimals)) ? Math.max(0, Math.min(8, Math.round(Number(decimals)))) : 2;
  return n.toFixed(d);
}

export function formatReadoutPart(slot, rawCell) {
  const d = slot.decimals ?? 2;
  const unit = (slot.unit || '').trim();
  const num = formatReadoutScalar(rawCell, d);
  if (num === '—') return '—';
  return unit ? `${num} ${unit}` : num;
}

export function resolveReadoutRows(slot, simulationData, ensembleMemberSimulationData) {
  if (slot.ensembleSimId) {
    const memberRows = ensembleMemberSimulationData?.[slot.ensembleSimId];
    if (Array.isArray(memberRows) && memberRows.length > 0) {
      return memberRows;
    }
    // Purple ensemble: member CSV not loaded yet — empty until data arrives.
    // Green single scenario: member buckets are cleared — fall back to the active CSV rows so
    // readouts still work if column names match (e.g. slots saved without ensemble prefix).
    return simulationData || [];
  }
  return simulationData || [];
}

export function resolveHeaderListForSlot(slot, ensembleColumnGroups, singleSimColumns) {
  if (slot.ensembleSimId && ensembleColumnGroups?.length) {
    const g = ensembleColumnGroups.find((x) => x.simId === slot.ensembleSimId);
    return g?.columns || [];
  }
  return singleSimColumns || [];
}

export function getSlotDisplayString(slot, rows, headerList, simTime) {
  if (!slot?.column) return '—';
  const timeCol = pickTimeColumn(headerList);
  const row = sampleRowAtSimTime(rows, timeCol, simTime);
  if (!row) return '—';
  const key = findColumnKey(row, slot.column);
  if (key == null) return '—';
  return formatReadoutPart(slot, row[key]);
}

/**
 * @param {object|null} connectionReadout — { slots: [{ column, ensembleSimId?, unit, decimals? }] }
 * @param {object} ctx
 */
export function buildConnectionReadoutLines(connectionReadout, ctx) {
  const {
    simulationData,
    ensembleMemberSimulationData,
    ensembleColumnGroups,
    singleSimColumns,
    simulationTime,
  } = ctx;
  if (!connectionReadout?.slots?.length) return null;
  const slots = [...connectionReadout.slots];
  while (slots.length < 4) slots.push({});
  const tSample = effectiveSampleTime(simulationTime);
  const parts = [0, 1, 2, 3].map((i) => {
    const slot = slots[i] || {};
    const rows = resolveReadoutRows(slot, simulationData, ensembleMemberSimulationData);
    const headers = resolveHeaderListForSlot(slot, ensembleColumnGroups, singleSimColumns);
    return getSlotDisplayString(slot, rows, headers, tSample);
  });
  return {
    line1: `${parts[0]}, ${parts[1]}`,
    line2: `${parts[2]}, ${parts[3]}`,
  };
}

/** Component types that show “Connection readout” in the right-click chart menu (sparkle #1–#4). */
export const CONNECTION_READOUT_COMPONENT_TYPES = new Set([
  'gas-turbine-lm2500',
  'gas-turbine-lm2500-andritz',
  'gas-turbine-lm2500-plus',
  /* BESS — library uses `battery`; saved designs often use id-style types like `bess-50mw`. */
  'battery',
  'bess',
  'bess-30mw',
  'bess-50mw',
  /* Auxiliary loads — library `auxiliary`; designs use id-style types. */
  'auxiliary',
  'auxiliary-loads',
  'auxiliary-loads-bess',
]);

export function componentSupportsConnectionReadout(component) {
  return component && CONNECTION_READOUT_COMPONENT_TYPES.has(component.type);
}

const AUX_LOAD_NAME_NUM_RE = /Aux(?:iliary)?\s*Loads?\s*#(\d+)/i;

/** UI label for ensemble tab dropdown: `Load_4` → "Load 4". */
export function formatEnsembleMemberTabLabel(simId) {
  if (!simId) return '';
  return String(simId).replace(/_/g, ' ');
}

/**
 * If the block is an auxiliary load named "Aux Loads #N", guess ensemble member `Load_N`
 * (only when that id exists on the active ensemble). User can pick another tab in the dialog.
 */
export function guessAuxiliaryLoadEnsembleSimId(component, memberSimulations = []) {
  const t = component?.type;
  if (
    t !== 'auxiliary' &&
    t !== 'auxiliary-loads' &&
    t !== 'auxiliary-loads-bess'
  ) {
    return null;
  }
  const m = String(component?.name || '').match(AUX_LOAD_NAME_NUM_RE);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 1) return null;
  const id = `Load_${n}`;
  if (memberSimulations.length && !memberSimulations.includes(id)) return null;
  return id;
}

const BESS_TAG_NUM_RE = /BESS\s*#\s*(\d+)/i;

const BESS_READOUT_TYPES = new Set(['battery', 'bess', 'bess-30mw', 'bess-50mw']);

/**
 * If the block is named "BESS #N", guess ensemble member `BESS_N` when present (e.g. BESS #1 → BESS_1).
 */
export function guessBessEnsembleSimId(component, memberSimulations = []) {
  if (!component?.type || !BESS_READOUT_TYPES.has(component.type)) return null;
  const m = String(component?.name || '').match(BESS_TAG_NUM_RE);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 1) return null;
  const id = `BESS_${n}`;
  if (memberSimulations.length && !memberSimulations.includes(id)) return null;
  return id;
}

/** Default sparkle tab: Aux Loads #N → Load_N, else BESS #N → BESS_N. */
export function guessConnectionReadoutDefaultEnsembleSimId(component, memberSimulations = []) {
  return (
    guessAuxiliaryLoadEnsembleSimId(component, memberSimulations) ??
    guessBessEnsembleSimId(component, memberSimulations)
  );
}
