/**
 * Tracks in-flight simulation API fetches (metadata + /data) for a non-blocking header status bar.
 */

let activities = [];
let idSeq = 1;
const listeners = new Set();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeSimulationFetchActivity(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSimulationFetchActivitySnapshot() {
  return activities;
}

function getServerSnapshot() {
  return [];
}

export { getServerSnapshot };

/**
 * @param {{ kind: 'metadata' | 'data', designApiPath: string, simulationId: string, columns?: string, offset?: number, limit?: number | null }} detail
 * @returns {number} id — pass to popSimulationFetchActivity when done
 */
export function pushSimulationFetchActivity(detail) {
  const id = idSeq++;
  activities = [...activities, { id, ...detail, at: Date.now() }];
  emit();
  return id;
}

export function popSimulationFetchActivity(id) {
  activities = activities.filter((a) => a.id !== id);
  emit();
}

/**
 * Human-readable line for one activity.
 */
export function formatSimulationFetchActivityLine(a) {
  if (!a) return '';
  if (a.kind === 'metadata') {
    return `${a.simulationId} · metadata (header + row count · not full row data)`;
  }
  const cols = a.columns || '';
  const colShort = cols.length > 72 ? `${cols.slice(0, 69)}…` : cols;
  const off = Number(a.offset) || 0;
  const lim = a.limit;
  let rowPart;
  if (lim != null && lim !== undefined && Number(lim) > 0) {
    rowPart = `rows ${off}–${off + Number(lim) - 1}`;
  } else {
    rowPart = `rows from ${off} (entire series in one response)`;
  }
  return `${a.simulationId} · columns: ${colShort} · ${rowPart}`;
}
