/**
 * Persistent browser cache for GET /api/designs/.../simulations/{id} payloads (sim_config + data rows).
 * Stored in IndexedDB (on-disk in the user profile), shared across tabs on the same origin.
 * No versioning — callers invalidate manually or on upload/delete.
 */

const DB_NAME = 'dcs-simulation-api-payload';
const DB_VERSION = 1;
const STORE = 'simulationPayloads';

function storeKey(designApiPath, simulationId) {
  return `${designApiPath}::${simulationId}`;
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
 * @returns {Promise<object|null>} Same shape as the load-simulation API body, or null.
 */
export async function getCachedSimulationPayload(designApiPath, simulationId) {
  if (!designApiPath || !simulationId) return null;
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(storeKey(designApiPath, simulationId));
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('simulationDataCache: read failed', e);
    return null;
  }
}

/**
 * @param {object} payload - Full JSON from load_design_simulation
 * After the server sends the big JSON (settings + all the table rows), we copy that whole answer into the drawer under the same label. Next time we can skip the download.
 */
export async function setCachedSimulationPayload(designApiPath, simulationId, payload) {
  if (!designApiPath || !simulationId || !payload) return;
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE).put(payload, storeKey(designApiPath, simulationId));
    });
  } catch (e) {
    console.warn('simulationDataCache: write failed', e);
  }
}

export async function deleteCachedSimulationPayload(designApiPath, simulationId) {
  if (!designApiPath || !simulationId) return;
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE).delete(storeKey(designApiPath, simulationId));
    });
  } catch (e) {
    console.warn('simulationDataCache: delete failed', e);
  }
}

/**
 * After activating a named preset, the CSV rows are unchanged but sim_config on disk is new.
 * Update the cached payload so a subsequent handleRunSimulation can serve from IndexedDB with fresh UI config.
 */
export async function mergeCachedSimulationAfterActivate(designApiPath, simulationId, activateResponse) {
  if (!designApiPath || !simulationId || !activateResponse) return;
  const existing = await getCachedSimulationPayload(designApiPath, simulationId);
  if (!existing) return;
  const next = {
    ...existing,
    sim_config: activateResponse.sim_config ?? existing.sim_config,
    named_configuration_keys:
      activateResponse.named_configuration_keys ?? existing.named_configuration_keys,
    design_name: activateResponse.design_name ?? existing.design_name,
    sim_name: activateResponse.sim_name ?? existing.sim_name,
    row_count: existing.row_count ?? (existing.data?.length ?? 0),
  };
  await setCachedSimulationPayload(designApiPath, simulationId, next);
}