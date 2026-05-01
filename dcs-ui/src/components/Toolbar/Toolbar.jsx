import React, { useState, useRef, useEffect } from 'react';
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
  onSaveSimulationConfig,
  onCopyScenarioLink,
  onLoad,
  hasComponents,
  canSave, // Whether we can do a quick save (config name exists)
  canSaveSimulationConfig, // Design-dir scenario loaded: open “Save configuration as” for .sim.json presets
  canCopyScenarioLink, // Scenario running from design dir: copy ?design=&sim=&config= link
}) => {
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const saveDropdownRef = useRef(null);

  useEffect(() => {
    if (!saveMenuOpen) return;
    const onDocMouseDown = (e) => {
      if (saveDropdownRef.current && !saveDropdownRef.current.contains(e.target)) {
        setSaveMenuOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setSaveMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [saveMenuOpen]);

  const closeSaveMenu = () => setSaveMenuOpen(false);

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

      {/* Save/Load Section: save actions in dropdown; Load stays on the bar */}
      <div className="toolbar-section">
        <div className="toolbar-save-dropdown" ref={saveDropdownRef}>
          <button
            type="button"
            className="btn-save-trigger"
            onClick={() => setSaveMenuOpen((o) => !o)}
            title="Save"
            aria-expanded={saveMenuOpen}
            aria-haspopup="menu"
          >
            💾
          </button>
          {saveMenuOpen && (
            <div className="toolbar-save-menu" role="menu">
              <button
                type="button"
                className="toolbar-save-menu-item"
                role="menuitem"
                disabled={!hasComponents}
                title={canSave ? 'Save Design (overwrite current config)' : 'Save Design As (first time save)'}
                onClick={() => {
                  closeSaveMenu();
                  onSave();
                }}
              >
                {canSave ? 'Save Design' : 'Save Design As'}
              </button>
              {canSave && (
                <button
                  type="button"
                  className="toolbar-save-menu-item"
                  role="menuitem"
                  title="Save Design As (create new config)"
                  onClick={() => {
                    closeSaveMenu();
                    onSaveAs();
                  }}
                >
                  Save Design As
                </button>
              )}
              {canSaveSimulationConfig && (
                <button
                  type="button"
                  className="toolbar-save-menu-item"
                  role="menuitem"
                  title="Save configuration as: snapshot current charts and panel settings into this scenario’s .sim.json under a name"
                  onClick={() => {
                    closeSaveMenu();
                    onSaveSimulationConfig();
                  }}
                >
                  Save configuration as
                </button>
              )}
              {canCopyScenarioLink && (
                <button
                  type="button"
                  className="toolbar-save-menu-item toolbar-save-menu-item--link"
                  role="menuitem"
                  title="Copy a link that opens this design, loads this scenario, and optionally the highlighted chart preset"
                  onClick={() => {
                    closeSaveMenu();
                    onCopyScenarioLink();
                  }}
                >
                  Copy scenario link
                </button>
              )}
            </div>
          )}
        </div>
        <button className="btn-load" onClick={onLoad} title="Load configuration">
          📂 Load
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
