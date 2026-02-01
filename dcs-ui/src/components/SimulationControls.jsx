import React from 'react';
import '../styles/SimulationControls.css';

const SimulationControls = ({ mode, selectedComponent }) => {
  // Only show in simulation mode
  if (mode !== 'simulation') {
    return null;
  }

  // Render component-specific controls
  const renderComponentControls = () => {
    if (!selectedComponent) {
      return (
        <p className="controls-placeholder">
          Control panel ready. Select a component to see available actions.
        </p>
      );
    }

    // Determine component type from the type or id
    const componentType = selectedComponent.type || selectedComponent.id || '';
    const componentName = selectedComponent.name || selectedComponent.id || 'Unknown';

    return (
      <div className="component-controls">
        <div className="selected-component-label">
          <strong>Selected:</strong> {componentName}
        </div>

        <div className="control-buttons">
          {renderButtonsForType(componentType)}
        </div>
      </div>
    );
  };

  // Render buttons based on component type
  const renderButtonsForType = (type) => {
    // Gas turbine controls
    if (type.includes('gas-turbine') || type.includes('turbine')) {
      return (
        <>
          <button className="control-btn control-btn-danger">
            Trip Turbine
          </button>
          <button className="control-btn control-btn-success">
            Restart Turbine
          </button>
        </>
      );
    }

    // Breaker controls
    if (type.includes('breaker')) {
      return (
        <>
          <button className="control-btn control-btn-warning">
            Open Breaker
          </button>
          <button className="control-btn control-btn-success">
            Close Breaker
          </button>
          <button className="control-btn control-btn-danger">
            Trip Breaker
          </button>
        </>
      );
    }

    // Battery controls
    if (type.includes('bess') || type.includes('battery')) {
      return (
        <>
          <button className="control-btn control-btn-danger">
            Battery Failure
          </button>
          <button className="control-btn control-btn-success">
            Enable Battery
          </button>
        </>
      );
    }

    // Generic controls for all other components
    return (
      <>
        <button className="control-btn control-btn-danger">
          Take Offline
        </button>
        <button className="control-btn control-btn-success">
          Bring Online
        </button>
      </>
    );
  };

  return (
    <div className="simulation-controls">
      <div className="controls-header">
        <h3>Simulation Controls</h3>
      </div>

      <div className="controls-body">
        {renderComponentControls()}
      </div>
    </div>
  );
};

export default SimulationControls;
