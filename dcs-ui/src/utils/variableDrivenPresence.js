/**
 * Drive canvas "offline" styling from simulation CSV columns: when a watched variable
 * satisfies a predicate at the playhead, marked components (and incident connections) render de-energized.
 */
import { cellFloat } from './csvRowAccess';
import { parseEnsembleQualifiedColumn, pickTimeColumn } from './simulationLazyApi';

const EMPTY_SET = new Set();

/** Stable default for Canvas props — do not mutate. */
export const NO_PRESENCE_FORCED_IDS = EMPTY_SET;

const EMPTY_PAIR = { componentIds: EMPTY_SET, connectionIds: EMPTY_SET };

/**
 * Prefer the same X column as an embedded spark that plots this rule's value, so playback filtering
 * matches ComponentEmbeddedSparklines (which uses spark.xColumn, not pickTimeColumn heuristics).
 */
export function resolvePresenceTimeColumn(rule, canvasComponents = []) {
  if (rule.timeColumn != null && String(rule.timeColumn).trim()) {
    return String(rule.timeColumn).trim();
  }
  const parsed = parseEnsembleQualifiedColumn(rule.column);
  const rawY = parsed ? parsed.column.trim() : String(rule.column ?? '').trim();
  const sidNeed = parsed?.simId ?? null;
  if (!rawY) return null;

  const preferredIds = rule.componentIds || [];
  const tryComp = (comp) => {
    if (!comp?.embeddedSparklines?.length) return null;
    for (const sp of comp.embeddedSparklines) {
      const y = sp.yColumn != null ? String(sp.yColumn).trim() : '';
      if (!y || y !== rawY) continue;
      if (!sp.xColumn) continue;
      const spSid = sp.ensembleSimId || null;
      if (sidNeed != null && sidNeed !== '') {
        if (spSid !== sidNeed) continue;
      } else if (spSid) {
        continue;
      }
      return String(sp.xColumn).trim();
    }
    return null;
  };

  for (const id of preferredIds) {
    const comp = canvasComponents.find((c) => c.id === id);
    if (!comp) continue;
    const hit = tryComp(comp);
    if (hit) return hit;
  }
  for (const comp of canvasComponents) {
    if (preferredIds.includes(comp.id)) continue;
    const hit = tryComp(comp);
    if (hit) return hit;
  }
  return null;
}

/** @typedef {{ id: string, column: string, componentIds?: string[], connectionIds?: string[], when?: string, threshold?: number, epsilon?: number, timeColumn?: string }} VariableDrivenPresenceRule */

function rowsUpToTime(rows, timeCol, simulationTime) {
  if (!rows?.length || !timeCol) return [];
  const tLim = Number(simulationTime);
  if (!Number.isFinite(tLim)) return [...rows];
  return rows.filter((row) => {
    const t = cellFloat(row, timeCol);
    return !Number.isNaN(t) && t <= tLim + 1e-9;
  });
}

function numericParam(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * @param {string|undefined} when
 * @param {number} value
 * @param {number} threshold
 * @param {number} epsilon
 */
export function predicateHolds(when, value, threshold, epsilon) {
  const mode = when && typeof when === 'string' ? when : 'lte';
  const thr = numericParam(threshold, 0);
  const eps = numericParam(epsilon, 1e-9);
  switch (mode) {
    case 'lte':
      return value <= thr + eps;
    case 'lt':
      return value < thr - eps;
    case 'gte':
      return value >= thr - eps;
    case 'gt':
      return value > thr + eps;
    case 'eq':
      return Math.abs(value - thr) <= eps;
    default:
      return value <= thr + eps;
  }
}

/**
 * Last sample of `valueCol` in `rows` (already time-filtered).
 */
function lastValueInRows(rows, valueCol) {
  if (!rows?.length || !valueCol) return NaN;
  const last = rows[rows.length - 1];
  return cellFloat(last, valueCol);
}

/**
 * @param {VariableDrivenPresenceRule} rule
 * @param {{
 *   simulationRowsSparkAligned: object[],
 *   simulationData: object[],
 *   ensembleMemberSimulationData: Record<string, object[]>|null,
 *   simulationTime: number,
 *   canvasComponents?: object[],
 * }} ctx
 * @returns {boolean} true → linked components/lines match the predicate at the playhead
 */
export function evaluateVariablePresenceRule(rule, ctx) {
  const {
    simulationRowsSparkAligned = [],
    simulationData = [],
    ensembleMemberSimulationData = null,
    simulationTime,
    canvasComponents = [],
  } = ctx;

  const parsed = parseEnsembleQualifiedColumn(rule.column);
  let rows;
  let valueCol;
  if (parsed) {
    rows = ensembleMemberSimulationData?.[parsed.simId];
    valueCol = parsed.column;
  } else {
    // Match ComponentEmbeddedSparklines: non-member sparks use Canvas `simulationData` (= downsampled rows).
    rows = simulationRowsSparkAligned?.length ? simulationRowsSparkAligned : simulationData;
    valueCol = String(rule.column ?? '').trim();
  }

  if (!rows?.length) return false;

  const timeCol =
    resolvePresenceTimeColumn(rule, canvasComponents) || pickTimeColumn(Object.keys(rows[0]));
  if (!timeCol || !valueCol) return false;

  const slice = rowsUpToTime(rows, timeCol, simulationTime);
  const value = lastValueInRows(slice, valueCol);
  if (Number.isNaN(value)) return false;

  const thr = numericParam(rule.threshold, 0);
  const eps = rule.epsilon != null && Number.isFinite(Number(rule.epsilon)) ? Number(rule.epsilon) : 1e-9;
  return predicateHolds(rule.when, value, thr, eps);
}

/**
 * @param {VariableDrivenPresenceRule[]|null|undefined} rules
 * @param {object} ctx
 * @returns {{ componentIds: Set<string>, connectionIds: Set<string> }}
 */
export function computePresenceDeenergization(rules, ctx) {
  if (!rules?.length) return EMPTY_PAIR;
  let compOut = null;
  let connOut = null;

  const ensureComp = () => {
    if (!compOut) compOut = new Set();
    return compOut;
  };
  const ensureConn = () => {
    if (!connOut) connOut = new Set();
    return connOut;
  };

  for (const rule of rules) {
    const cids = Array.isArray(rule?.componentIds) ? rule.componentIds : [];
    const lids = Array.isArray(rule?.connectionIds) ? rule.connectionIds : [];
    if (!cids.length && !lids.length) continue;
    try {
      if (evaluateVariablePresenceRule(rule, ctx)) {
        if (cids.length) {
          const s = ensureComp();
          for (const id of cids) {
            if (id) s.add(id);
          }
        }
        if (lids.length) {
          const s = ensureConn();
          for (const id of lids) {
            if (id) s.add(id);
          }
        }
      }
    } catch {
      /* ignore bad rule / missing data */
    }
  }

  return {
    componentIds: compOut || EMPTY_SET,
    connectionIds: connOut || EMPTY_SET,
  };
}

/** @deprecated Use computePresenceDeenergization; kept for callers that only need component ids */
export function computePresenceForcedOfflineIds(rules, ctx) {
  return computePresenceDeenergization(rules, ctx).componentIds;
}
