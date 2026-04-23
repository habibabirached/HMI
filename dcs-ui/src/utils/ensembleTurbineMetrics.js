import { pickTimeColumn } from './simulationLazyApi';

/**
 * Best-effort map from a member CSV header list to P / Q / frequency / voltage columns
 * (matches test1 LM2500_* files: P_gN|, Q_gN|, freq_gt_N|, Vrms_gt_N| or V_gN|).
 */
export function pickPQFVColumns(csvColumns) {
  const cols = csvColumns || [];
  const p = cols.find((c) => /^P_/i.test(c) || /\bP_g/i.test(c));
  const q = cols.find((c) => /^Q_/i.test(c) || /\bQ_g/i.test(c));
  const f = cols.find((c) => /freq/i.test(c));
  const v =
    cols.find((c) => /Vrms/i.test(c)) ||
    cols.find((c) => /^V_g/i.test(c) || /\bV_g/i.test(c));
  return { p, q, f, v };
}

/**
 * Last row whose time column is <= simTimeSeconds (CSV rows assumed time-ordered).
 */
export function sampleRowAtSimTime(rows, timeCol, simTimeSeconds) {
  if (!rows?.length || !timeCol) return null;
  if (simTimeSeconds === Infinity) {
    return rows[rows.length - 1] ?? null;
  }
  const t = Number(simTimeSeconds);
  if (!Number.isFinite(t)) return rows[0] || null;
  let bestIdx = 0;
  for (let i = 0; i < rows.length; i++) {
    const tv = parseFloat(rows[i][timeCol]);
    if (Number.isNaN(tv)) continue;
    if (tv <= t) bestIdx = i;
    else break;
  }
  return rows[bestIdx] ?? null;
}

export function formatEnsembleMetric(value, unit, digits = 2) {
  if (value === undefined || value === null || value === '') return '—';
  const n = parseFloat(value);
  if (Number.isNaN(n)) return '—';
  return `${n.toFixed(digits)} ${unit}`;
}

/** Resolve live P/Q/F/V strings for one ensemble member (raw CSV column names). */
export function getMemberLiveMetrics(simId, csvColumns, rows, simTimeSeconds) {
  const { p, q, f, v } = pickPQFVColumns(csvColumns);
  const timeCol = pickTimeColumn(csvColumns);
  const row = sampleRowAtSimTime(rows, timeCol, simTimeSeconds);
  if (!row) {
    return {
      line1: '— MW, — MVAR',
      line2: '— Hz, — V',
      missingData: true,
    };
  }
  const pStr = formatEnsembleMetric(p != null ? row[p] : null, 'MW');
  const qStr = formatEnsembleMetric(q != null ? row[q] : null, 'MVAR');
  const fStr = formatEnsembleMetric(f != null ? row[f] : null, 'Hz');
  const vStr = formatEnsembleMetric(v != null ? row[v] : null, 'V');
  return {
    line1: `${pStr}, ${qStr}`,
    line2: `${fStr}, ${vStr}`,
    missingData: false,
  };
}
