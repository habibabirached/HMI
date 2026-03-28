import React from 'react';
import ShapeRect from './shape-rect';

/** Matches `shape: 'shape-bus-bar'` in componentVisuals.js (same outline as shape-rect). */
export default function ShapeBusBar(props) {
  return <ShapeRect {...props} />;
}

ShapeBusBar.displayName = 'shape-bus-bar';
