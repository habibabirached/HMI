import React from 'react';

/**
 * Icon + primary + secondary lines for generic / framed-texture blocks.
 */
export default function StandardEquipmentLabels({
  width,
  height,
  centerX,
  visualConfig,
  canvasPrimaryText,
  canvasSecondaryText,
  framedTextureLayout,
}) {
  return (
    <>
      {!framedTextureLayout && (
        <text
          x={centerX}
          y={height * 0.28}
          textAnchor="middle"
          fill={visualConfig.color}
          fontSize="24"
          fontWeight="400"
          pointerEvents="none"
          opacity="0.9"
        >
          {visualConfig.icon}
        </text>
      )}
      <text
        x={centerX}
        y={framedTextureLayout ? 4 : height * 0.52}
        textAnchor="middle"
        dominantBaseline={framedTextureLayout ? 'hanging' : 'auto'}
        fill="#e0e0e0"
        fontSize="11"
        fontWeight="600"
        pointerEvents="none"
      >
        {canvasPrimaryText}
      </text>
      <text
        x={centerX}
        y={framedTextureLayout ? height - 4 : height * 0.68}
        textAnchor="middle"
        fill="#999"
        fontSize="10"
        pointerEvents="none"
      >
        {canvasSecondaryText}
      </text>
    </>
  );
}
