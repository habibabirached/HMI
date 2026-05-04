/**
 * Connection line styling: automatic role-based defaults, or persisted `conn.style` overrides.
 */

/** LM family + BESS — green (production / storage source) */
const PRODUCER_TYPES = new Set([
  'gas-turbine-lm2500',
  'gas-turbine-lm2500-andritz',
  'gas-turbine-lm2500-plus',
  'gas-turbine-lm6000',
  'bess',
  'bess-30mw',
  'bess-50mw',
  'bess-xfmr'
]);

/** Loads — red (consumption) */
const CONSUMER_TYPES = new Set([
  'it-rack-load',
  'it-load',
  'ups',
  'auxiliary-loads-bess',
  'auxiliary-loads',
  'datacenter-load',
  'data-hall',
  'cooling-plant',
  'hvac-load',
  'critical-load',
  'noncritical-load'
]);

export const CONNECTION_COLOR_PALETTE = [
  '#2d7a32',
  '#66bb6a',
  '#c62828',
  '#ef5350',
  '#6d6d6d',
  '#9e9e9e',
  '#1565c0',
  '#42a5f5',
  '#ef6c00',
  '#ffb74d',
  '#6a1b9a',
  '#ab47bc',
  '#00838f',
  '#26c6da',
  '#37474f',
  '#eceff1',
  '#f9a825',
  '#fdd835'
];

export const DEFAULT_CONNECTION_SHADOW = {
  blur: 4,
  offsetX: 2,
  offsetY: 2,
  opacity: 0.35,
  color: '#000000'
};

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

function mixRgb(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t
  };
}

/** CSS drop-shadow for SVG lines — avoids SVG feDropShadow replacing the stroke (invisible line). */
function connectionShadowToCssDropShadow(sh) {
  const blur = Number.isFinite(sh.blur) ? sh.blur : DEFAULT_CONNECTION_SHADOW.blur;
  const offsetX = Number.isFinite(sh.offsetX) ? sh.offsetX : DEFAULT_CONNECTION_SHADOW.offsetX;
  const offsetY = Number.isFinite(sh.offsetY) ? sh.offsetY : DEFAULT_CONNECTION_SHADOW.offsetY;
  const op = Number.isFinite(sh.opacity) ? clamp(sh.opacity, 0, 1) : DEFAULT_CONNECTION_SHADOW.opacity;
  const sc = typeof sh.color === 'string' && sh.color ? sh.color : DEFAULT_CONNECTION_SHADOW.color;
  const rgb = hexToRgb(sc) || { r: 0, g: 0, b: 0 };
  const cssBlur = blur * 0.45 * 1.6;
  return `drop-shadow(${offsetX}px ${offsetY}px ${cssBlur}px rgba(${rgb.r},${rgb.g},${rgb.b},${op}))`;
}

export function isProducerType(type) {
  return type != null && PRODUCER_TYPES.has(type);
}

export function isConsumerType(type) {
  return type != null && CONSUMER_TYPES.has(type);
}

export function getConnectionLineRole(fromType, toType) {
  if (isProducerType(fromType) || isProducerType(toType)) return 'producer';
  if (isConsumerType(fromType) || isConsumerType(toType)) return 'consumer';
  return 'neutral';
}

/** De-energized / offline branch stroke — reads as neutral gray on canvas (not tinted green/red). */
const DEENERGIZED_STROKE_LIGHT = '#b8b8b8';
const DEENERGIZED_STROKE_DARK = '#696969';

export function getRoleGradientStops(role, energized) {
  if (!energized) {
    return {
      a: { color: DEENERGIZED_STROKE_LIGHT, opacity: 0.94 },
      b: { color: DEENERGIZED_STROKE_DARK, opacity: 0.94 }
    };
  }
  if (role === 'producer') {
    return {
      a: { color: '#7ccc7a', opacity: 1 },
      b: { color: '#2d7a32', opacity: 1 }
    };
  }
  if (role === 'consumer') {
    return {
      a: { color: '#ff8a80', opacity: 1 },
      b: { color: '#c62828', opacity: 1 }
    };
  }
  return {
    a: { color: '#b0b0b0', opacity: 0.95 },
    b: { color: '#6d6d6d', opacity: 0.95 }
  };
}

/**
 * When switching off useAuto: seed custom style from current auto role colors.
 */
export function snapshotStyleFromAutoRole(fromType, toType) {
  const role = getConnectionLineRole(fromType, toType);
  const two = getRoleGradientStops(role, true);
  return {
    useAuto: false,
    color: two.b.color,
    thickness: 5,
    animation: 'none',
    depth3d: 38,
    glossiness: 18,
    shadow: { ...DEFAULT_CONNECTION_SHADOW }
  };
}

function buildCustomGradientStops(baseHex, depth3d, glossiness, energized) {
  if (!energized) {
    return [
      { offset: '0%', color: DEENERGIZED_STROKE_LIGHT, opacity: 0.94 },
      { offset: '100%', color: DEENERGIZED_STROKE_DARK, opacity: 0.94 },
    ];
  }

  const dim = 1;
  const rgb = hexToRgb(baseHex) || { r: 109, g: 109, b: 109 };
  const t = clamp(Number(depth3d) || 0, 0, 100) / 100;
  const g = clamp(Number(glossiness) || 0, 0, 100) / 100;
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  const light = mixRgb(rgb, white, 0.1 + t * 0.42);
  const dark = mixRgb(rgb, black, 0.08 + t * 0.38);
  const a = { offset: '0%', color: rgbToHex(light.r, light.g, light.b), opacity: dim };
  const end = { offset: '100%', color: rgbToHex(dark.r, dark.g, dark.b), opacity: dim };
  if (g > 0.04) {
    const midRgb = mixRgb(mixRgb(light, dark, 0.5), white, g * 0.62);
    return [
      a,
      {
        offset: '50%',
        color: rgbToHex(midRgb.r, midRgb.g, midRgb.b),
        opacity: dim * (0.88 + 0.12 * g)
      },
      end
    ];
  }
  return [a, end];
}

/**
 * @returns {{
 *   stops: Array<{ offset: string, color: string, opacity: number }>,
 *   strokeWidth: number,
 *   animation: 'none'|'forward'|'reverse',
 *   flowArrows: 'none'|'forward'|'reverse',
 *   dropShadowCss: string|null,
 *   role: string|null
 * }}
 */
export function resolveConnectionRenderParams(conn, fromType, toType, isEnergized) {
  const style = conn.style;
  const useAuto = !style || style.useAuto !== false;

  // flowArrows works independently of useAuto — read it from style regardless
  const rawArrows = style?.flowArrows;
  const flowArrows = rawArrows === 'forward' || rawArrows === 'reverse' ? rawArrows : 'none';

  if (useAuto) {
    const role = getConnectionLineRole(fromType, toType);
    const two = getRoleGradientStops(role, isEnergized);
    return {
      stops: [
        { offset: '0%', color: two.a.color, opacity: two.a.opacity },
        { offset: '100%', color: two.b.color, opacity: two.b.opacity }
      ],
      strokeWidth: 5,
      animation: 'none',
      flowArrows,
      dropShadowCss: null,
      role
    };
  }

  const color = typeof style.color === 'string' && style.color ? style.color : '#6d6d6d';
  const depth3d = Number.isFinite(style.depth3d) ? style.depth3d : 38;
  const glossiness = Number.isFinite(style.glossiness) ? style.glossiness : 0;
  const stops = buildCustomGradientStops(color, depth3d, glossiness, isEnergized);
  const strokeWidth =
    Number.isFinite(style.thickness) && style.thickness > 0 ? style.thickness : 5;
  const anim = style.animation;
  const animation =
    anim === 'forward' || anim === 'reverse' ? anim : 'none';

  const sh = style.shadow || {};
  const blur = Number.isFinite(sh.blur) ? sh.blur : DEFAULT_CONNECTION_SHADOW.blur;
  const offsetX = Number.isFinite(sh.offsetX) ? sh.offsetX : DEFAULT_CONNECTION_SHADOW.offsetX;
  const offsetY = Number.isFinite(sh.offsetY) ? sh.offsetY : DEFAULT_CONNECTION_SHADOW.offsetY;
  const op = Number.isFinite(sh.opacity) ? sh.opacity : DEFAULT_CONNECTION_SHADOW.opacity;
  const sc = typeof sh.color === 'string' && sh.color ? sh.color : DEFAULT_CONNECTION_SHADOW.color;

  let dropShadowCss = null;
  if (blur > 0.05 && op > 0.02) {
    dropShadowCss = connectionShadowToCssDropShadow({
      blur,
      offsetX,
      offsetY,
      opacity: clamp(op, 0, 1),
      color: sc
    });
  }

  return {
    stops,
    strokeWidth,
    animation,
    flowArrows,
    dropShadowCss,
    role: null
  };
}
