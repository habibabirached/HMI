import React from 'react';
import './Toolbar.css';

const Toolbar = ({
  mode,
  onToggleMode,
  viewMode,
  simulationRunning,
  onStartSimulation,
  onStopSimulation,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetView,
  onSave,
  onSaveAs,
  onLoad,
  onLoadCSV,
  hasComponents,
  canSave // Whether we can do a quick save (config name exists)
}) => {
  /**
   * Toggle fullscreen for the entire page
   */
  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      // Enter fullscreen
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      } else if (document.documentElement.webkitRequestFullscreen) {
        document.documentElement.webkitRequestFullscreen(); // Safari
      } else if (document.documentElement.msRequestFullscreen) {
        document.documentElement.msRequestFullscreen(); // IE11
      }
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen(); // Safari
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen(); // IE11
      }
    }
  };

  return (
    <div className="toolbar">
      {/* In Customer view, show Start/Stop Simulation buttons */}
      {viewMode === 'customer' && (
        <div className="toolbar-section">
          <button
            className={`btn-sim ${simulationRunning ? 'stop' : 'start'}`}
            onClick={simulationRunning ? onStopSimulation : onStartSimulation}
            disabled={!hasComponents && !simulationRunning}
            title={!hasComponents ? 'Load a configuration first' : ''}
          >
            {simulationRunning ? '⏹ Stop Simulation' : '▶ Start Simulation'}
          </button>
        </div>
      )}

      {/* Save/Load Section */}
      <div className="toolbar-section">
        <button 
          className="btn-save" 
          onClick={onSave} 
          title={canSave ? "Save (overwrite current config)" : "Save As (first time save)"}
          disabled={!hasComponents}
        >
          💾 {canSave ? 'Save' : 'Save As'}
        </button>
        {canSave && (
          <button 
            className="btn-save-as" 
            onClick={onSaveAs} 
            title="Save As (create new config)"
          >
            💾 Save As
          </button>
        )}
        <button className="btn-load" onClick={onLoad} title="Load Configuration">
          📂 Load Design
        </button>
      </div>

      {/* CSV Data Section */}
      <div className="toolbar-section">
        <button className="btn-csv" onClick={onLoadCSV} title="Load CSV Data Files">
          📊 Load CSV
        </button>
      </div>

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

      {/* Fullscreen Button - Far Right */}
      <div className="toolbar-section toolbar-section-right">
        <button className="btn-fullscreen" onClick={handleFullscreen} title="Toggle Fullscreen (F11)">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1h-4zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5zM.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5zm15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5z"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
