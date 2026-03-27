import React from 'react';

/**
 * Current transformer one-line symbol: bold zigzag (resistor-style) centered vertically.
 * No visible box — transparent hit target only so the block stays draggable/selectable.
 */
function SchematicCT({
  width,
  height,
  strokeColor,
  zigzagColor,
  primaryLabel,
  secondaryLabel,
}) {
  const cx = width / 2;
  const wireY = height / 2;
  const margin = Math.max(2, width * 0.08);
  const x0 = margin;
  const x1 = width - margin;
  const amp = Math.max(3, height * 0.09);
  const span = x1 - x0;
  const steps = 6;
  const seg = span / steps;

  let d = `M ${x0} ${wireY}`;
  for (let i = 1; i < steps; i += 1) {
    const x = x0 + seg * i;
    const y = wireY + (i % 2 === 0 ? amp : -amp);
    d += ` L ${x} ${y}`;
  }
  d += ` L ${x1} ${wireY}`;

  const lineColor = zigzagColor || strokeColor;

  return (
    <>
      <rect
        width={width}
        height={height}
        fill="transparent"
        stroke="none"
        rx="4"
      />
      <path
        d={d}
        fill="none"
        stroke={lineColor}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="none"
      />
      <text
        x={cx}
        y={Math.max(11, height * 0.16)}
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
        y={height - 6}
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

export default SchematicCT;
