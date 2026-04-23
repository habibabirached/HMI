/**
 * Canvas may pass simulationData to many blocks; embedded sparklines (if any) scan every row.
 * Downsample for Canvas only — charts / formulas in App still use full-resolution simulationData.
 */
const DEFAULT_MAX_SPARKLINE_ROWS = 3200;

export function downsampleRowsForSparklines(rows, maxRows = DEFAULT_MAX_SPARKLINE_ROWS) {
  if (!rows?.length || rows.length <= maxRows) return rows;
  const n = rows.length;
  const out = [];
  const step = (n - 1) / (maxRows - 1);
  for (let i = 0; i < maxRows; i++) {
    const idx = Math.min(n - 1, Math.round(i * step));
    out.push(rows[idx]);
  }
  return out;
}

/** Min/max without Math.min(...arr) — large spreads are slow and can stress the engine. */
export function arrayFiniteMinMax(arr) {
  if (!arr?.length) return { min: 0, max: 0 };
  let minV = arr[0];
  let maxV = arr[0];
  for (let i = 1; i < arr.length; i++) {
    const v = arr[i];
    if (!Number.isFinite(v)) continue;
    if (!Number.isFinite(minV) || v < minV) minV = v;
    if (!Number.isFinite(maxV) || v > maxV) maxV = v;
  }
  if (!Number.isFinite(minV) || !Number.isFinite(maxV)) return { min: 0, max: 0 };
  return { min: minV, max: maxV };
}
