import React from 'react';

/**
 * One-line diagram style breaker: horizontal bar + diagonal blade.
 * SVG fragment for use inside Canvas.jsx (coordinates relative to component box).
 */
function SchematicBreaker({
  width,
  height,
  strokeColor,
  strokeWidthVal,
  primaryLabel,
  secondaryLabel,
}) {
  const cx = width / 2;
  const symY = height * 0.26;
  const symX1 = Math.max(4, width * 0.1);
  const symX2 = width - symX1;
  const bladeTipX = width * 0.48;
  const bladeRootX = width * 0.2;
  const bladeRootY = symY - Math.min(13, height * 0.2);

  return (
    <>
      <rect
        width={width}
        height={height}
        fill="#1a1a1a"
        stroke={strokeColor}
        strokeWidth={strokeWidthVal}
        rx="4"
      />
      <g pointerEvents="none">
        <line
          x1={symX1}
          y1={symY}
          x2={symX2}
          y2={symY}
          stroke={strokeColor}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <line
          x1={bladeRootX}
          y1={bladeRootY}
          x2={bladeTipX}
          y2={symY}
          stroke={strokeColor}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      </g>
      <text
        x={cx}
        y={height * 0.55}
        textAnchor="middle"
        fill="#e0e0e0"
        fontSize="11"
        fontWeight="600"
        pointerEvents="none"
      >
        {primaryLabel}
      </text>
      <text
        x={cx}
        y={height * 0.78}
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

export default SchematicBreaker;
