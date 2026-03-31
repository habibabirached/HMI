import React from 'react';

/**
 * IEC-style open manual disconnect on a one-line: gap in the bar + diagonal blade.
 * Full-width transparent hit rect (matches other schematics).
 */
function SchematicManualLineSwitch({
  width,
  height,
  strokeColor,
  strokeWidthVal: _strokeWidthVal,
  primaryLabel,
  secondaryLabel,
}) {
  const midY = height / 2 + 2;
  const gapL = width * 0.34;
  const gapR = width * 0.66;
  const wireInset = Math.max(2, width * 0.06);
  const bladeX0 = gapL;
  const bladeX1 = gapR;
  const bladeUp = Math.min(14, height * 0.32);

  return (
    <>
      <rect width={width} height={height} fill="transparent" stroke="none" />
      <g pointerEvents="none">
        <line
          x1={wireInset}
          y1={midY}
          x2={gapL}
          y2={midY}
          stroke={strokeColor}
          strokeWidth={2.25}
          strokeLinecap="round"
        />
        <line
          x1={gapR}
          y1={midY}
          x2={width - wireInset}
          y2={midY}
          stroke={strokeColor}
          strokeWidth={2.25}
          strokeLinecap="round"
        />
        {/* Open blade: diagonal from left jaw upward-right */}
        <line
          x1={bladeX0}
          y1={midY}
          x2={bladeX1}
          y2={midY - bladeUp}
          stroke={strokeColor}
          strokeWidth={2.25}
          strokeLinecap="round"
        />
      </g>
      {primaryLabel ? (
        <text
          x={width / 2}
          y={Math.max(5, height * 0.12)}
          textAnchor="middle"
          dominantBaseline="hanging"
          fill="#c5c5c5"
          fontSize="9"
          fontWeight="600"
          pointerEvents="none"
        >
          {primaryLabel}
        </text>
      ) : null}
      {secondaryLabel ? (
        <text
          x={width / 2}
          y={height - 6}
          textAnchor="middle"
          dominantBaseline="auto"
          fill="#9e9e9e"
          fontSize="8"
          pointerEvents="none"
        >
          {secondaryLabel}
        </text>
      ) : null}
    </>
  );
}

export default SchematicManualLineSwitch;
