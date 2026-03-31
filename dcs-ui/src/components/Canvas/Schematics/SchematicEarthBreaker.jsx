import React from 'react';

/**
 * Earth / chassis circuit breaker symbol (vertical stem + three graded horizontal bars).
 * Transparent hit target only. Stack: primary label → symbol (centered) → secondary label.
 */
function SchematicEarthBreaker({
  width,
  height,
  strokeColor,
  strokeWidthVal: _strokeWidthVal,
  primaryLabel,
  secondaryLabel,
  /** One-line square frame (e.g. sectional CB on bus), width/height = one grid cell. */
  showFrame = false,
}) {
  const cx = width / 2;
  /** Slight downward shift + compact bars so top/bottom labels clear the graphic. */
  const symY = height / 2 + 1;
  const stemTop = symY - Math.min(10, height * 0.15);
  const stemBot = symY + 1;
  const w1 = Math.max(6, width * 0.12);
  const w2 = Math.max(10, width * 0.2);
  const w3 = Math.max(14, width * 0.28);
  const step = Math.min(3, height * 0.048);
  const y1 = stemBot + step * 1.2;
  const y2 = y1 + step;
  const y3 = y2 + step;

  const pad = 1.5;
  return (
    <>
      <rect width={width} height={height} fill="transparent" stroke="none" rx="4" />
      {showFrame ? (
        <rect
          x={pad}
          y={pad}
          width={width - 2 * pad}
          height={height - 2 * pad}
          fill="none"
          stroke={strokeColor}
          strokeWidth={2}
          rx={3}
          pointerEvents="none"
        />
      ) : null}
      <g pointerEvents="none">
        <line
          x1={cx}
          y1={stemTop}
          x2={cx}
          y2={stemBot}
          stroke={strokeColor}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <line
          x1={cx - w1}
          y1={y1}
          x2={cx + w1}
          y2={y1}
          stroke={strokeColor}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <line
          x1={cx - w2}
          y1={y2}
          x2={cx + w2}
          y2={y2}
          stroke={strokeColor}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <line
          x1={cx - w3}
          y1={y3}
          x2={cx + w3}
          y2={y3}
          stroke={strokeColor}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </g>
      <text
        x={cx}
        y={Math.max(6, height * 0.05)}
        textAnchor="middle"
        dominantBaseline="hanging"
        fill="#e0e0e0"
        fontSize="11"
        fontWeight="600"
        pointerEvents="none"
      >
        {primaryLabel}
      </text>
      <text
        x={cx}
        y={height - 10}
        textAnchor="middle"
        fill="#999"
        fontSize="10"
        pointerEvents="none"
      >
        {secondaryLabel}
      </text>
    </>
  );
}

export default SchematicEarthBreaker;
