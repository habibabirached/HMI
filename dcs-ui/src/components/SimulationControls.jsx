import React from 'react';
import '../styles/SimulationControls.css';

const SimulationControls = ({ mode, selectedComponent }) => {
  // Only show in simulation mode
  if (mode !== 'simulation') {
    return null;
  }

  return (
    <div className="simulation-controls">
      <div className="controls-header">
        <h3>Simulation Controls</h3>
      </div>

      <div className="controls-body">
        <p className="controls-placeholder">
          Control panel ready. Select a component to see available actions.
        </p>
      </div>
    </div>
  );
};

export default SimulationControls;
