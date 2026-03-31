/**
 * Persistent browser cache for GET /api/designs/.../simulations/{id} payloads (sim_config + data rows).
 * Stored in IndexedDB (on-disk in the user profile), shared across tabs on the same origin.
 *
 * Keys:
 * - `design::simId` — last default load for that scenario (current_configuration on disk at fetch time).
 * - `design::simId#presetName` — full snapshot after activating that named preset (same data[], that preset’s sim_config).
 */

const DB_NAME = 'dcs-simulation-api-payload';
const DB_VERSION = 1;
const STORE = 'simulationPayloads';

function idbDbg(action, detail) {
  console.log(`[DCS:idb] ${action}`, detail ?? '');
}

export function simulationPayloadStoreKey(designApiPath, simulationId, presetName = null) {
  const base = `${designApiPath}::${simulationId}`;
  if (!presetName) return base;
  return `${base}#${presetName}`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

/**
 * @param {string|null} presetName - If set, read snapshot for that named preset (conf01, …).
 * @returns {Promise<object|null>} Same shape as the load-simulation API body, or null.
 */
export async function getCachedSimulationPayload(designApiPath, simulationId, presetName = null) {
  if (!designApiPath || !simulationId) return null;
  try {
    const db = await openDb();
    const key = simulationPayloadStoreKey(designApiPath, simulationId, presetName);
    const row = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    idbDbg('get', {
      key,
      hit: !!row,
      dataRows: row?.data?.length ?? 0,
      hasSimConfig: !!row?.sim_config,
      chartsToDisplay: row?.sim_config?.charts_to_display?.length ?? 0,
    });
    return row;
  } catch (e) {
    console.warn('simulationDataCache: read failed', e);
    idbDbg('get ERROR', { message: e?.message });
    return null;
  }
}

/**
 * @param {object} payload - Full JSON from load_design_simulation (or equivalent).
 * @param {string|null} presetName - If set, store under preset-specific key for deep links / conf buttons.
 */
export async function setCachedSimulationPayload(designApiPath, simulationId, payload, presetName = null) {
  if (!designApiPath || !simulationId || !payload) return;
  try {
    const db = await openDb();
    const key = simulationPayloadStoreKey(designApiPath, simulationId, presetName);
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE).put(payload, key);
    });
    idbDbg('put', {
      key,
      dataRows: payload?.data?.length ?? 0,
      chartsToDisplay: payload?.sim_config?.charts_to_display?.length ?? 0,
    });
  } catch (e) {
    console.warn('simulationDataCache: write failed', e);
    idbDbg('put ERROR', { message: e?.message });
  }
}

/** Deletes `design::sim` and every `design::sim#*` preset entry for this scenario. */
export async function deleteCachedSimulationPayload(designApiPath, simulationId) {
  if (!designApiPath || !simulationId) return;
  const prefix = `${designApiPath}::${simulationId}`;
  idbDbg('delete all keys with prefix', { prefix });
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      const store = tx.objectStore(STORE);
      const r = store.openCursor();
      r.onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) return;
        const k = cursor.key;
        if (typeof k === 'string' && (k === prefix || k.startsWith(`${prefix}#`))) {
          cursor.delete();
        }
        cursor.continue();
      };
    });
  } catch (e) {
    console.warn('simulationDataCache: delete failed', e);
  }
}

/**
 * After activating a named preset, the CSV rows are unchanged but sim_config on disk is new.
 * Update the **default** cached payload (design::sim) when present.
 */
export async function mergeCachedSimulationAfterActivate(designApiPath, simulationId, activateResponse) {
  if (!designApiPath || !simulationId || !activateResponse) return;
  const existing = await getCachedSimulationPayload(designApiPath, simulationId, null);
  if (!existing) {
    idbDbg('mergeAfterActivate skipped (no default cache row)', {
      designApiPath,
      simulationId,
    });
    return;
  }
  const next = {
    ...existing,
    sim_config: activateResponse.sim_config ?? existing.sim_config,
    named_configuration_keys:
      activateResponse.named_configuration_keys ?? existing.named_configuration_keys,
    design_name: activateResponse.design_name ?? existing.design_name,
    sim_name: activateResponse.sim_name ?? existing.sim_name,
    row_count: existing.row_count ?? (existing.data?.length ?? 0),
  };
  await setCachedSimulationPayload(designApiPath, simulationId, next, null);
}
