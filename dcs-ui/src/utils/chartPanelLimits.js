/** Min height for the bottom chart tray (px). */
export const CHART_PANEL_MIN_HEIGHT = 200;

/** Fraction of viewport height the tray may use when resizing (user-requested ~90%). */
export const CHART_PANEL_MAX_HEIGHT_VIEWPORT = 0.9;

export function getChartPanelMaxHeightPx() {
  if (typeof window === 'undefined') return 800;
  return Math.floor(window.innerHeight * CHART_PANEL_MAX_HEIGHT_VIEWPORT);
}

/** Chart tray / plot surface opacity: 0 = fully transparent, 1 = opaque. */
export const CHART_PANEL_OPACITY_MIN = 0;
export const CHART_PANEL_OPACITY_MAX = 1;
export const CHART_PANEL_OPACITY_DEFAULT = 1;

export function clampChartPanelOpacity(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return CHART_PANEL_OPACITY_DEFAULT;
  return Math.min(
    CHART_PANEL_OPACITY_MAX,
    Math.max(CHART_PANEL_OPACITY_MIN, n),
  );
}
