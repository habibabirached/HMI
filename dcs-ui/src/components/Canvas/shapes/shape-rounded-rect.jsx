import React from 'react';
import TexturedEquipmentShell from './TexturedEquipmentShell';

/** Matches `shape: 'shape-rounded-rect'` in componentVisuals.js */
export default function ShapeRoundedRect(props) {
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
        />
      }
    />
  );
}

ShapeRoundedRect.displayName = 'shape-rounded-rect';
