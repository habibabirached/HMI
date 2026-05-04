import { pickTimeColumn } from './simulationLazyApi';

/**
 * First sample on the CSV / shared time axis (playback + scrub origin).
 *
 * @param {{
 *   timeRange?: { min?: unknown; max?: unknown } | null;
 *   isEnsemble?: boolean;
 *   memberSimulations?: string[];
 * }} simulationMetadataLike
 * @param {object[] | null | undefined} primaryRows
 * @param {Record<string, object[]> | null | undefined} ensembleMemberRows
 * @returns {number}
 */
export function computePlaybackClockOriginSeconds(
  simulationMetadataLike,
  primaryRows,
  ensembleMemberRows,
) {
  const meta = simulationMetadataLike;
  const trMin = meta?.timeRange?.min;
  const trMax = meta?.timeRange?.max;
  if (
    Number.isFinite(Number(trMin)) &&
    Number.isFinite(Number(trMax)) &&
    Number(trMax) > Number(trMin)
  ) {
    return Number(trMin);
  }

  const readFirstRowT = (rows) => {
    if (!rows?.length) return NaN;
    const tc = pickTimeColumn(Object.keys(rows[0]));
    if (!tc) return NaN;
    const v = parseFloat(rows[0][tc]);
    return Number.isFinite(v) ? v : NaN;
  };

  let best = Infinity;
  const pc = readFirstRowT(primaryRows);
  if (Number.isFinite(pc)) best = Math.min(best, pc);

  const members = meta?.memberSimulations || [];
  if (meta?.isEnsemble && ensembleMemberRows && members.length) {
    for (const id of members) {
      const v = readFirstRowT(ensembleMemberRows[id]);
      if (Number.isFinite(v)) best = Math.min(best, v);
    }
  }

  return Number.isFinite(best) ? best : 0;
}
