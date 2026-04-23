/**
 * Performance tracing (filter console by `DCS:perf`).
 *
 * **Development:** ON by default when `NODE_ENV === 'development'`, so `npm start` shows logs without setup.
 * **Opt out (dev):** `localStorage.setItem('dcs-perf-debug', '0'); location.reload();`
 * **Production / force on:** `localStorage.setItem('dcs-perf-debug', '1'); location.reload();`
 * **Or one-shot:** `window.__DCS_PERF_DEBUG = true` (enable) / `false` (disable).
 *
 * **How to share results:** In the console filter box type `DCS:perf`. Reproduce: load fullblockpkl2 →
 * ensemble → click a turbine. Copy the ordered lines (interaction → layout … → paint rAF2). If
 * `EnsembleVariablesPane commit` `count` increases on every click while only selection changed, the huge
 * variables list is still re-committing (memo/props issue). If ms jump before PropertyPanel, the property
 * sheet or chart builder is expensive; if before App, the whole tree is large.
 */

export function isPerfDebugEnabled() {
  if (typeof window === 'undefined') return false;
  if (window.__DCS_PERF_DEBUG === false) return false;
  if (window.__DCS_PERF_DEBUG === true) return true;
  try {
    const v = window.localStorage?.getItem('dcs-perf-debug');
    if (v === '0') return false;
    if (v === '1') return true;
  } catch {
    /* ignore */
  }
  return process.env.NODE_ENV === 'development';
}

let perfBootLogged = false;

/** Call once from App mount so you know tracing is active (and how to turn it off). */
export function logPerfBootOnce() {
  if (typeof window === 'undefined' || perfBootLogged) return;
  perfBootLogged = true;
  if (!isPerfDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.info(
    '[DCS:perf] Tracing is ON — filter console by “DCS:perf”. In dev, turn off: localStorage.setItem("dcs-perf-debug","0"); reload.',
  );
}

/** Free-form note (ensemble click, etc.); does not need a prior selection mark. */
export function logPerfNote(message, extra = undefined) {
  if (!isPerfDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log(`[DCS:perf] ${message}`, extra !== undefined ? extra : '');
}

/** Call immediately before state update that should select a component. */
export function markSelectionInteractionStart() {
  if (!isPerfDebugEnabled()) return;
  window.__dcsPerfSelectT0 = performance.now();
  // eslint-disable-next-line no-console
  console.log('[DCS:perf] interaction → selectComponent scheduled', {
    t: window.__dcsPerfSelectT0.toFixed(2),
  });
}

function elapsedSinceSelectMark() {
  const t0 = window.__dcsPerfSelectT0;
  if (t0 == null) return null;
  return performance.now() - t0;
}

/** useLayoutEffect: runs after DOM updates, before paint. */
export function logPerfLayout(label, extra = undefined) {
  if (!isPerfDebugEnabled()) return;
  const ms = elapsedSinceSelectMark();
  // eslint-disable-next-line no-console
  console.log(`[DCS:perf] layout ${label}`, ms != null ? `${ms.toFixed(1)}ms since click` : '(no mark)', extra ?? '');
}

/** requestAnimationFrame chain: after next paint(s). */
export function logPerfAfterPaint(label) {
  if (!isPerfDebugEnabled()) return;
  requestAnimationFrame(() => {
    const ms = elapsedSinceSelectMark();
    // eslint-disable-next-line no-console
    console.log(`[DCS:perf] paint rAF1 ${label}`, ms != null ? `${ms.toFixed(1)}ms since click` : '');
    requestAnimationFrame(() => {
      const ms2 = elapsedSinceSelectMark();
      // eslint-disable-next-line no-console
      console.log(`[DCS:perf] paint rAF2 ${label}`, ms2 != null ? `${ms2.toFixed(1)}ms since click` : '');
    });
  });
}
