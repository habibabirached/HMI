import { API_BASE_URL } from '../apiConfig';
import {
  popSimulationFetchActivity,
  pushSimulationFetchActivity,
} from './simulationFetchActivity';

/**
 * Helpers for lazy simulation loading: metadata + column-scoped CSV rows.
 */

/** Separator between scenario id and CSV header in the chart-builder list when an ensemble is active. */
export const ENSEMBLE_COLUMN_SEP = ' — ';

/**
 * Build the label shown in SimulationChartBuilder for one cell of one member scenario’s CSV.
 * The scenario id is always prefixed so duplicate header names across tabs stay distinct.
 */
export function qualifyEnsembleColumn(simulationId, columnName) {
  if (!simulationId || columnName == null || columnName === '') return String(columnName ?? '');
  return `${simulationId}${ENSEMBLE_COLUMN_SEP}${columnName}`;
}

/**
 * Turn a qualified label back into { simId, column } or null if the string is not in ensemble form.
 */
export function parseEnsembleQualifiedColumn(qualified) {
  if (!qualified || typeof qualified !== 'string') return null;
  const idx = qualified.indexOf(ENSEMBLE_COLUMN_SEP);
  if (idx <= 0) return null;
  return {
    simId: qualified.slice(0, idx),
    column: qualified.slice(idx + ENSEMBLE_COLUMN_SEP.length),
  };
}

/**
 * Ensemble charts require every picked column to come from the same member tab. Returns that member id
 * and the raw CSV header names in the same order as the input list, or null if any value is not qualified
 * or members disagree.
 */
export function singleMemberFromQualifiedSelections(qualifiedList) {
  if (!qualifiedList?.length) return null;
  let simId = null;
  const rawColumns = [];
  for (const q of qualifiedList) {
    const p = parseEnsembleQualifiedColumn(q);
    if (!p) return null;
    if (simId == null) simId = p.simId;
    else if (p.simId !== simId) return null;
    rawColumns.push(p.column);
  }
  return { simId, rawColumns };
}

/**
 * Parse every list entry as a qualified "simId — column" label.
 * Fails (returns null) if any entry is unqualified. Used for ensemble "virtual join" charts.
 */
export function parseEnsembleColumnSelections(qualifiedList) {
  if (!qualifiedList?.length) return null;
  const items = [];
  for (const q of qualifiedList) {
    const p = parseEnsembleQualifiedColumn(q);
    if (!p) return null;
    items.push(p);
  }
  return { items };
}

/** True when the selection spans more than one member scenario. */
export function isEnsembleCrossMemberSelection(items) {
  if (!items?.length) return false;
  return new Set(items.map((i) => i.simId)).size > 1;
}

/**
 * Column names to load per real scenario id (raw CSV header strings).
 * @param {Array<{ simId: string, column: string }>} items
 * @returns {Record<string, string[]>}
 */
export function groupColumnsByEnsembleMember(items) {
  const map = new Map();
  for (const { simId, column } of items) {
    if (!map.has(simId)) map.set(simId, new Set());
    if (column) map.get(simId).add(column);
  }
  const out = {};
  for (const [k, v] of map) {
    out[k] = [...v];
  }
  return out;
}

export function pickTimeColumn(columns) {
  if (!columns?.length) return null;
  const candidates = ['Time (s)', 'time_sec', 'Time', 'time'];
  for (const c of candidates) {
    if (columns.includes(c)) return c;
  }
  return columns[0];
}

/**
 * Which base CSV columns a set of formulas needs, respecting derived-variable order:
 * each formula may reference CSV columns or derived names defined earlier in the list.
 */
export function columnsNeededForDerived(derivedVariables, csvColumns) {
  if (!derivedVariables?.length || !csvColumns?.length) return [];
  const csvSet = new Set(csvColumns);
  const doneDerived = new Set();
  const needCsv = new Set();

  const poolForFormula = () => [...csvColumns, ...doneDerived];

  for (const { name, formula } of derivedVariables) {
    const pool = poolForFormula();
    for (const ref of collectFormulaReferencedColumns(formula, pool)) {
      if (csvSet.has(ref)) needCsv.add(ref);
    }
    if (name) doneDerived.add(name);
  }
  return [...needCsv];
}

/**
 * Find which strings from `columnNames` appear as substrings in `formula` (longest names first).
 */
export function collectFormulaReferencedColumns(formula, columnNames) {
  if (!formula || typeof formula !== 'string' || !columnNames?.length) return [];
  const sorted = [...columnNames].sort((a, b) => b.length - a.length);
  const used = new Set();
  let remainder = formula;
  for (const col of sorted) {
    if (!col || !remainder.includes(col)) continue;
    used.add(col);
    remainder = remainder.split(col).join('\0');
  }
  return [...used];
}

/** Columns referenced by saved chart definitions (charts_to_display / .sim.json). */
export function collectColumnsFromChartsToDisplay(chartsToDisplay) {
  const out = new Set();
  for (const chartDef of chartsToDisplay || []) {
    if (chartDef.x_column) out.add(chartDef.x_column);
    if (chartDef.y_column) out.add(chartDef.y_column);
    for (const y of chartDef.y_columns || []) {
      if (y) out.add(y);
    }
    if (chartDef.type === 'multi') {
      for (const comp of chartDef.components || []) {
        if (comp?.columnName) out.add(comp.columnName);
      }
    }
    /* split_by is a chart mode ('phase' | 'load' | 'column' | 'manual'), not a CSV header. */
  }
  return [...out];
}

/**
 * Align merged rows by index (same row count expected). Extra keys on each row are merged.
 */
export function mergeSimulationDataByRowIndex(existing, incoming) {
  if (!incoming?.length) return existing?.length ? existing : [];
  if (!existing?.length) return incoming;
  const n = Math.min(existing.length, incoming.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ ...existing[i], ...incoming[i] });
  }
  if (incoming.length !== existing.length) {
    console.warn('[DCS:lazy] mergeSimulationDataByRowIndex row count mismatch', {
      existing: existing.length,
      incoming: incoming.length,
    });
  }
  return out;
}

export async function fetchSimulationMetadata(designApiPath, simulationId) {
  const id = pushSimulationFetchActivity({
    kind: 'metadata',
    designApiPath,
    simulationId,
  });
  try {
    const url = `${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/simulations/${encodeURIComponent(simulationId)}/metadata`;
    const res = await fetch(url);
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || `Metadata ${res.status} ${res.statusText}`);
    }
    return res.json();
  } finally {
    popSimulationFetchActivity(id);
  }
}

/**
 * @param {string} designApiPath
 * @param {string} simulationId
 * @param {string[]} columnList
 * @param {{ offset?: number, limit?: number }} [options] offset=0, omit limit to fetch all remaining rows (legacy)
 */
export async function fetchSimulationDataSubset(designApiPath, simulationId, columnList, options = {}) {
  const cols = [...new Set((columnList || []).filter(Boolean))];
  if (!cols.length) {
    throw new Error('fetchSimulationDataSubset: no columns');
  }
  const offset = options.offset != null && Number(options.offset) > 0 ? Number(options.offset) : 0;
  const limit = options.limit != null ? options.limit : null;
  const id = pushSimulationFetchActivity({
    kind: 'data',
    designApiPath,
    simulationId,
    columns: cols.join(', '),
    offset,
    limit,
  });
  try {
    const params = new URLSearchParams();
    params.set('columns', cols.join(','));
    if (offset > 0) {
      params.set('offset', String(offset));
    }
    if (limit != null) {
      params.set('limit', String(limit));
    }
    const url = `${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/simulations/${encodeURIComponent(simulationId)}/data?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || `Data ${res.status} ${res.statusText}`);
    }
    return res.json();
  } finally {
    popSimulationFetchActivity(id);
  }
}
