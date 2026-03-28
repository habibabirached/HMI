import React from 'react';
import TexturedEquipmentShell from './TexturedEquipmentShell';

function hexPoints(width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) / 2 - 1;
  const pts = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 6) * (2 * i - 1);
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  return pts.join(' ');
}

/** Matches `shape: 'shape-hexagon'` in componentVisuals.js */
export default function ShapeHexagon(props) {
  const { width, height, strokeColor, strokeWidthVal } = props;
  return (
    <TexturedEquipmentShell
      {...props}
      childrenNoTexture={
        <polygon
          points={hexPoints(width, height)}
          fill="#1a1a1a"
          stroke={strokeColor}
          strokeWidth={strokeWidthVal}
          strokeLinejoin="round"
        />
      }
    />
  );
}

ShapeHexagon.displayName = 'shape-hexagon';
