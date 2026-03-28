/**
 * Shareable URLs for a loaded design + scenario (+ optional chart preset), e.g.
 * ?design=halfblock&sim=HalfBlock&config=demo1
 * "design" is the same path segment used by GET /api/designs/catalog/{design}/load (halfblock, archive/foo, …).
 */

export function parseSimulationDeepLink(search) {
  const q = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(q);
  const design = (params.get('design') || '').trim();
  const sim = (params.get('sim') || '').trim();
  const config = (params.get('config') || '').trim();
  if (!design || !sim) return null;
  return { design, sim, config: config || null };
}

/**
 * Returns the query string only (starts with ?) so callers can append to origin + pathname.
 */
export function buildSimulationDeepLinkQuery({ designApiPath, simulationId, namedConfig }) {
  if (!designApiPath || !simulationId) return '';
  const p = new URLSearchParams();
  p.set('design', designApiPath);
  p.set('sim', simulationId);
  if (namedConfig) p.set('config', namedConfig);
  return `?${p.toString()}`;
}

/** localStorage key for “last CSV tab + optional preset” when reopening a design (same browser). */
export function lastScenarioSessionStorageKey(designApiPath) {
  return `dcs:lastScenario:${designApiPath}`;
}
