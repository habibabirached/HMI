import React from 'react';
import '../styles/Toolbar.css';

const Toolbar = ({
  mode,
  onToggleMode,
  simulationRunning,
  onStartSimulation,
  onStopSimulation,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetView
}) => {
  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <div className="mode-indicator">
          <span className="mode-label">Mode:</span>
          <span className={`mode-badge mode-${mode}`}>
            {mode === 'design' ? '✏️ DESIGN' : '▶️ SIMULATION'}
          </span>
          <button 
            className={`btn-mode-toggle ${mode === 'simulation' ? 'active' : ''}`}
            onClick={onToggleMode}
          >
            {mode === 'design' ? 'Enter Simulation' : 'Exit to Design'}
          </button>
        </div>
      </div>

      {mode === 'simulation' && (
        <div className="toolbar-section">
          <button
            className={`btn-sim ${simulationRunning ? 'stop' : 'start'}`}
            onClick={simulationRunning ? onStopSimulation : onStartSimulation}
          >
            {simulationRunning ? '⏹ Stop' : '▶ Start'} Simulation
          </button>
        </div>
      )}

      <div className="toolbar-section">
        <span className="zoom-label">Zoom: {(zoom * 100).toFixed(0)}%</span>
        <button className="btn-zoom" onClick={onZoomOut} title="Zoom Out">
          −
        </button>
        <button className="btn-zoom" onClick={onZoomIn} title="Zoom In">
          +
        </button>
        <button className="btn-zoom" onClick={onResetView} title="Reset View">
          ⊙
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
