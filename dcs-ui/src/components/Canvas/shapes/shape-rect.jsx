import React from 'react';
import TexturedEquipmentShell from './TexturedEquipmentShell';

/** Matches `shape: 'shape-rect'` in componentVisuals.js */
export default function ShapeRect(props) {
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
          rx={2}
        />
      }
    />
  );
}

ShapeRect.displayName = 'shape-rect';
