/**
 * Dev-only browser guards for large simulation payloads.
 *
 * 1) Stub __REACT_DEVTOOLS_GLOBAL_HOOK__ so the extension cannot attach.
 * 2) Skip React 19 dev-mode performance.measure() calls for component renders:
 *    those measures embed prop-change details that get structured-cloned →
 *    DataCloneError / OOM when props hold huge tables (e.g. simulationData).
 *
 * React DevTools extension: disable the import below in index.js.
 * Performance guard: remove this file’s measure wrap if you need DevTools “Components” timings.
 */
if (typeof window !== 'undefined') {
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    inject() {},
    onScheduleFiberRoot() {},
    onCommitFiberRoot() {},
    onCommitFiberUnmount() {},
    renderers: new Map(),
  };
}

// React 19+: logComponentRender → performance.measure with detail.devtools (see react-dom-client.development.js)
const REACT_COMPONENTS_TIMING_TRACK = 'Components \u269b';

if (
  typeof performance !== 'undefined' &&
  typeof performance.measure === 'function'
) {
  const nativeMeasure = performance.measure.bind(performance);
  performance.measure = function measureGuard(...args) {
    try {
      if (args.length >= 2) {
        const second = args[1];
        if (second != null && typeof second === 'object' && !('nodeType' in second)) {
          const track = second.detail?.devtools?.track;
          if (track === REACT_COMPONENTS_TIMING_TRACK) {
            return undefined;
          }
        }
      }
      return nativeMeasure(...args);
    } catch (_) {
      return undefined;
    }
  };
}
