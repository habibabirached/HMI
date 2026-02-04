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
 * PROPS IT RECEIVES (like function parameters):
 * - mode: string - either 'design' or 'simulation'
 * - selectedComponent: object - the component the user clicked on the canvas
 * - onTripComponent: function - a callback we can call to trip/fail a component
 * - onRestartComponent: function - NEW! a callback to bring component back online
 * 
 * REACT CONCEPT - Props:
 * Props are like inputs to a component. The parent (App.js) passes data
 * and functions down to this child component. We receive them in the
 * curly braces { mode, selectedComponent, onTripComponent, onRestartComponent }.
 * 
 * REACT CONCEPT - Callbacks:
 * onTripComponent is a FUNCTION passed from the parent. When we call it,
 * we're basically telling the parent "Hey, the user clicked this button,
 * do something about it!" The parent then updates the state.
 * 
 * onRestartComponent works the same way but for bringing components online.
 */
const SimulationControls = ({ 
  mode, 
  selectedComponent, 
  onTripComponent, 
  onRestartComponent,
  onOpenBreaker,
  onCloseBreaker,
  onTripBreaker,
  onTripRandomTurbine,
  onTripAllTurbines,
  onGridLoss,
  onOpenAllBreakers,
  onResetSystem
}) => {
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
          {/* ===============================================================
              RED BUTTON: Trip Turbine
              ===============================================================
              This button simulates a turbine failure/trip.
              
              WHAT HAPPENS WHEN CLICKED:
              1. onClick event fires (user clicked the button)
              2. We call onTripComponent() with the selected component's ID
              3. This calls the handleTripComponent function in App.js
              4. App.js updates the component's status to 'offline'
              5. React re-renders the canvas with the turbine in red
              
              JAVASCRIPT CONCEPT - Arrow Function:
              onClick={() => onTripComponent(selectedComponent.id)}
                      ^^^^
              This creates a small anonymous function that runs when clicked.
              We need this because we want to CALL onTripComponent WITH
              an argument (the ID). If we wrote onClick={onTripComponent},
              it would call the function immediately without an ID.
              
              JAVASCRIPT CONCEPT - Optional Chaining:
              selectedComponent?.id means "if selectedComponent exists,
              get its id property, otherwise return undefined".
              The ? prevents errors if selectedComponent is null.
          =============================================================== */}
          <button 
            className="control-btn control-btn-danger"
            onClick={() => {
              console.log('🔴 Trip Turbine clicked for:', selectedComponent?.name, selectedComponent?.id);
              onTripComponent(selectedComponent.id);
            }}
          >
            Trip Turbine
          </button>
          
          {/* ===============================================================
              GREEN BUTTON: Restart Turbine
              ===============================================================
              This button brings a tripped turbine back online.
              
              WHAT HAPPENS WHEN CLICKED:
              1. onClick event fires (user clicked the button)
              2. We call onRestartComponent() with the selected component's ID
              3. This calls the handleRestartComponent function in App.js
              4. App.js updates the component's status to 'normal'
              5. React re-renders the canvas with the turbine in grey/normal
              
              OPPOSITE OF TRIP: This reverses what "Trip Turbine" did.
          =============================================================== */}
          <button 
            className="control-btn control-btn-success"
            onClick={() => {
              console.log('🟢 Restart Turbine clicked for:', selectedComponent?.name, selectedComponent?.id);
              onRestartComponent(selectedComponent.id);
            }}
          >
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
          {/* ===============================================================
              ORANGE BUTTON: Open Breaker
              ===============================================================
              Manually opens the breaker to disconnect the circuit.
              This is a NORMAL operation, not a failure.
              
              USE CASE: Operators open breakers to isolate sections of the
              power system for maintenance or reconfiguration.
          =============================================================== */}
          <button 
            className="control-btn control-btn-warning"
            onClick={() => {
              console.log('🟠 Open Breaker clicked for:', selectedComponent?.name, selectedComponent?.id);
              onOpenBreaker(selectedComponent.id);
            }}
          >
            Open Breaker
          </button>
          
          {/* ===============================================================
              GREEN BUTTON: Close Breaker
              ===============================================================
              Closes the breaker to reconnect the circuit.
              Restores normal operation after manual opening.
          =============================================================== */}
          <button 
            className="control-btn control-btn-success"
            onClick={() => {
              console.log('🟢 Close Breaker clicked for:', selectedComponent?.name, selectedComponent?.id);
              onCloseBreaker(selectedComponent.id);
            }}
          >
            Close Breaker
          </button>
          
          {/* ===============================================================
              RED BUTTON: Trip Breaker
              ===============================================================
              Simulates a protection fault (overcurrent, short circuit, etc.)
              The breaker automatically opens due to a fault condition.
              
              DIFFERENCE FROM "OPEN":
              - Open = Manual operation by operator
              - Trip = Automatic safety response to a fault
          =============================================================== */}
          <button 
            className="control-btn control-btn-danger"
            onClick={() => {
              console.log('🔴 Trip Breaker clicked for:', selectedComponent?.name, selectedComponent?.id);
              onTripBreaker(selectedComponent.id);
            }}
          >
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
        {/* ===============================================================
            RED BUTTON: Take Offline (Generic)
            ===============================================================
            This button works the same as "Trip Turbine" but for any
            component type (transformers, loads, etc.)
            
            DEBUG: Added console.log to see when this is clicked
        =============================================================== */}
        <button 
          className="control-btn control-btn-danger"
          onClick={() => {
            console.log('🔴 Take Offline clicked for:', selectedComponent?.name, selectedComponent?.id);
            onTripComponent(selectedComponent.id);
          }}
        >
          Take Offline
        </button>
        
        {/* ===============================================================
            GREEN BUTTON: Bring Online (Generic)
            ===============================================================
            This button works the same as "Restart Turbine" but for any
            component type (transformers, loads, etc.)
            
            DEBUG: Added console.log to see when this is clicked
        =============================================================== */}
        <button 
          className="control-btn control-btn-success"
          onClick={() => {
            console.log('🟢 Bring Online clicked for:', selectedComponent?.name, selectedComponent?.id);
            onRestartComponent(selectedComponent.id);
          }}
        >
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

        {/* ================================================================
            QUICK SCENARIOS SECTION
            ================================================================
            This section shows pre-built scenario buttons that work
            WITHOUT needing to select a specific component.
            
            These are always visible (when in simulation mode) and let
            you quickly test common failure scenarios with one click.
        ================================================================ */}
        <div className="quick-scenarios-section">
          <h4 className="scenarios-title">Quick Scenarios</h4>
          
          <div className="control-buttons">
            {/* Trip Random Turbine - Tests unexpected single turbine failure */}
            <button 
              className="control-btn control-btn-danger"
              onClick={() => {
                console.log('🎲 Quick Scenario: Trip Random Turbine');
                onTripRandomTurbine();
              }}
              title="Randomly trips one turbine to test system response"
            >
              🎲 Trip Random Turbine
            </button>

            {/* Trip All Turbines - Total generation loss scenario */}
            <button 
              className="control-btn control-btn-danger"
              onClick={() => {
                console.log('💥 Quick Scenario: Trip All Turbines');
                onTripAllTurbines();
              }}
              title="Trips all turbines - worst case blackout scenario"
            >
              💥 Trip All Turbines
            </button>

            {/* Grid Loss - Utility grid disconnection */}
            <button 
              className="control-btn control-btn-danger"
              onClick={() => {
                console.log('⚡ Quick Scenario: Grid Loss');
                onGridLoss();
              }}
              title="Simulates losing utility grid connection"
            >
              ⚡ Grid Loss
            </button>

            {/* Open All Breakers - System sectioning */}
            <button 
              className="control-btn control-btn-warning"
              onClick={() => {
                console.log('🟠 Quick Scenario: Open All Breakers');
                onOpenAllBreakers();
              }}
              title="Opens all breakers - complete system isolation"
            >
              🔌 Open All Breakers
            </button>
          </div>

          {/* ================================================================
              RESET SYSTEM BUTTON
              ================================================================
              This button appears separately at the bottom of the Quick
              Scenarios section. It's styled differently (blue/grey) to
              distinguish it from failure scenarios.
              
              PURPOSE:
              After running multiple failure scenarios, this provides a
              quick way to return everything to normal without having to
              manually restart each component.
          ================================================================ */}
          <div className="reset-section">
            <button 
              className="control-btn control-btn-reset"
              onClick={() => {
                console.log('🔄 Reset System button clicked');
                onResetSystem();
              }}
              title="Reset all components back to normal state"
            >
              🔄 Reset System
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulationControls;
