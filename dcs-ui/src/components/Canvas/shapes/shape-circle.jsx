import React from 'react';
import TexturedEquipmentShell from './TexturedEquipmentShell';

/** Matches `shape: 'shape-circle'` in componentVisuals.js */
export default function ShapeCircle(props) {
  const { width, height, strokeColor, strokeWidthVal } = props;
  const rx = Math.max(1, width / 2 - 1);
  const ry = Math.max(1, height / 2 - 1);
  return (
    <TexturedEquipmentShell
      {...props}
      childrenNoTexture={
        <ellipse
          cx={width / 2}
          cy={height / 2}
          rx={rx}
          ry={ry}
          fill="#1a1a1a"
          stroke={strokeColor}
          strokeWidth={strokeWidthVal}
        />
      }
    />
  );
}

ShapeCircle.displayName = 'shape-circle';
