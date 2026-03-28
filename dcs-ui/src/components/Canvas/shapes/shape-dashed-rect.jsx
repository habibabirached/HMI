import React from 'react';
import TexturedEquipmentShell from './TexturedEquipmentShell';

/** Matches `shape: 'shape-dashed-rect'` in componentVisuals.js */
export default function ShapeDashedRect(props) {
  const { width, height, strokeColor, strokeWidthVal } = props;
  return (
    <TexturedEquipmentShell
      {...props}
      childrenNoTexture={
        <rect
          width={width}
          height={height}
          fill="#1a1a1a"
          stroke={strokeColor}
          strokeWidth={strokeWidthVal}
          rx={4}
          strokeDasharray="6 4"
        />
      }
    />
  );
}

ShapeDashedRect.displayName = 'shape-dashed-rect';
