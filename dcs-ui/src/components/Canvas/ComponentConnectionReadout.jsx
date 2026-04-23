import React, { useMemo } from 'react';
import { buildConnectionReadoutLines } from '../../utils/connectionReadoutSampling';
import './ComponentConnectionReadout.css';

const FO_WIDTH = 218;
const FO_HEIGHT = 54;

function readoutHasAnySlot(connectionReadout) {
  return (connectionReadout?.slots || []).some((s) => s && String(s.column || '').trim() !== '');
}

/**
 * Four-value “sparkle” readout anchored to the left or right of a component (e.g. on the bus tie).
 * Uses the same playhead rules as embedded sparklines.
 */
export default function ComponentConnectionReadout({
  connectionReadout,
  simulationData = [],
  ensembleMemberSimulationData = null,
  ensembleColumnGroups = [],
  singleSimColumns = [],
  simulationTime = 0,
  width,
  height,
}) {
  const lines = useMemo(
    () =>
      buildConnectionReadoutLines(connectionReadout, {
        simulationData,
        ensembleMemberSimulationData,
        ensembleColumnGroups,
        singleSimColumns,
        simulationTime,
      }),
    [
      connectionReadout,
      simulationData,
      ensembleMemberSimulationData,
      ensembleColumnGroups,
      singleSimColumns,
      simulationTime,
    ],
  );

  if (!readoutHasAnySlot(connectionReadout) || !lines) return null;

  const side = connectionReadout.side === 'right' ? 'right' : 'left';
  const swatchColor = connectionReadout.swatchColor || '#cddc39';
  const y = Math.max(0, height / 2 - FO_HEIGHT / 2);
  const x = side === 'left' ? -FO_WIDTH - 8 : width + 8;

  return (
    <foreignObject
      x={x}
      y={y}
      width={FO_WIDTH}
      height={FO_HEIGHT}
      pointerEvents="none"
      className="connection-readout-foreign-object"
    >
      <div className="connection-readout-fo">
        <div className="connection-readout-inner">
          <div className="connection-readout-swatch" style={{ background: swatchColor }} />
          <div className="connection-readout-text">
            <div className="connection-readout-line1">{lines.line1}</div>
            <div className="connection-readout-divider" />
            <div className="connection-readout-line2">{lines.line2}</div>
          </div>
        </div>
      </div>
    </foreignObject>
  );
}
