import React from 'react';
import '../styles/SimulationControls.css';

/**
 * SIMULATION CONTROLS COMPONENT
 * 
 * This is the control panel that appears on the right side of the screen
 * when you're in Simulation Mode. It shows different buttons depending on
 * which component you've clicked on the canvas.
 * 
 * PURPOSE:
 * - Shows action buttons specific to the selected component type
 * - For example: turbines get "Trip" and "Restart" buttons
 * - For example: breakers get "Open", "Close", "Trip" buttons
 * 
 * PROPS IT RECEIVES:
 * - mode: string - either 'design' or 'simulation'
 * - selectedComponent: object - the component the user clicked on the canvas
 */
const SimulationControls = ({ mode, selectedComponent }) => {
  // ========================================================================
  // VISIBILITY CHECK
  // ========================================================================
  // This entire panel should ONLY appear when we're in simulation mode.
  // If we're in design mode, return null (which means "don't show anything").
  // This keeps the interface clean when you're just building your system.
  if (mode !== 'simulation') {
    return null;
  }

  // ========================================================================
  // FUNCTION: renderComponentControls
  // ========================================================================
  // This function decides what to show inside the control panel.
  // It has two cases:
  //   Case 1: Nothing is selected → show placeholder text
  //   Case 2: Something is selected → show buttons for that component
  const renderComponentControls = () => {
    // CASE 1: No component selected yet
    // Show helpful text telling the user to select something
    if (!selectedComponent) {
      return (
        <p className="controls-placeholder">
          Control panel ready. Select a component to see available actions.
        </p>
      );
    }

    // CASE 2: A component is selected
    // Figure out what TYPE of component it is (turbine? breaker? battery?)
    // We look in the "type" field first, then "id" field as backup
    const componentType = selectedComponent.type || selectedComponent.id || '';
    
    // Get a human-readable name to display (e.g., "LM2500" or "HV Breaker")
    const componentName = selectedComponent.name || selectedComponent.id || 'Unknown';

    // Now build the control panel content:
    return (
      <div className="component-controls">
        {/* Show which component is selected */}
        <div className="selected-component-label">
          <strong>Selected:</strong> {componentName}
        </div>

        {/* Show the action buttons for this component type */}
        <div className="control-buttons">
          {renderButtonsForType(componentType)}
        </div>
      </div>
    );
  };

  // ========================================================================
  // FUNCTION: renderButtonsForType
  // ========================================================================
  // This function looks at the component type and returns the appropriate
  // set of buttons. Different equipment needs different controls.
  // 
  // HOW IT WORKS:
  // - Check if the type string contains certain keywords
  // - If it's a turbine → show turbine buttons
  // - If it's a breaker → show breaker buttons
  // - If it's a battery → show battery buttons
  // - Otherwise → show generic offline/online buttons
  const renderButtonsForType = (type) => {
    // -----------------------------------------------------------------------
    // GAS TURBINE CONTROLS
    // -----------------------------------------------------------------------
    // Turbines can trip (fail) or be restarted
    // We check if the type includes "gas-turbine" or just "turbine"
    if (type.includes('gas-turbine') || type.includes('turbine')) {
      return (
        <>
          {/* RED BUTTON: Simulates a turbine failure/trip */}
          <button className="control-btn control-btn-danger">
            Trip Turbine
          </button>
          
          {/* GREEN BUTTON: Brings the turbine back online */}
          <button className="control-btn control-btn-success">
            Restart Turbine
          </button>
        </>
      );
    }

    // -----------------------------------------------------------------------
    // CIRCUIT BREAKER CONTROLS
    // -----------------------------------------------------------------------
    // Breakers can be opened (disconnect circuit), closed (connect circuit),
    // or tripped (protection fault). This gives us three actions.
    if (type.includes('breaker')) {
      return (
        <>
          {/* ORANGE BUTTON: Manually open the breaker (normal operation) */}
          <button className="control-btn control-btn-warning">
            Open Breaker
          </button>
          
          {/* GREEN BUTTON: Close the breaker (restore connection) */}
          <button className="control-btn control-btn-success">
            Close Breaker
          </button>
          
          {/* RED BUTTON: Simulate a protection trip (fault condition) */}
          <button className="control-btn control-btn-danger">
            Trip Breaker
          </button>
        </>
      );
    }

    // -----------------------------------------------------------------------
    // BATTERY / BESS CONTROLS
    // -----------------------------------------------------------------------
    // Batteries can fail or be enabled/disabled
    // We check for "bess" (Battery Energy Storage System) or "battery"
    if (type.includes('bess') || type.includes('battery')) {
      return (
        <>
          {/* RED BUTTON: Simulate battery failure/offline */}
          <button className="control-btn control-btn-danger">
            Battery Failure
          </button>
          
          {/* GREEN BUTTON: Enable the battery */}
          <button className="control-btn control-btn-success">
            Enable Battery
          </button>
        </>
      );
    }

    // -----------------------------------------------------------------------
    // GENERIC CONTROLS (DEFAULT)
    // -----------------------------------------------------------------------
    // For any other type of component (transformers, loads, etc.)
    // Give them simple offline/online controls
    return (
      <>
        {/* RED BUTTON: Take the component offline */}
        <button className="control-btn control-btn-danger">
          Take Offline
        </button>
        
        {/* GREEN BUTTON: Bring the component online */}
        <button className="control-btn control-btn-success">
          Bring Online
        </button>
      </>
    );
  };

  // ========================================================================
  // RENDER THE PANEL
  // ========================================================================
  // This is the actual HTML structure that gets displayed on screen
  return (
    <div className="simulation-controls">
      {/* Header bar with title */}
      <div className="controls-header">
        <h3>Simulation Controls</h3>
      </div>

      {/* Body area where buttons appear */}
      <div className="controls-body">
        {/* Call our function to fill this area with the right content */}
        {renderComponentControls()}
      </div>
    </div>
  );
};

export default SimulationControls;
