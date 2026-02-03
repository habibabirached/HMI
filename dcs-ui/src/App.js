import React, { useState, useRef, useCallback } from 'react';
import ComponentLibrary from './components/ComponentLibrary';
import Canvas from './components/Canvas';
import PropertyPanel from './components/PropertyPanel';
import SimulationControls from './components/SimulationControls';
import Toolbar from './components/Toolbar';
import './styles/App.css';

function App() {
  // Application mode: 'design' or 'simulation'
  const [mode, setMode] = useState('design');
  
  // Canvas state
  const [canvasComponents, setCanvasComponents] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [selectedConnection, setSelectedConnection] = useState(null);
  
  // Canvas viewport
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  // Simulation state
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [systemState, setSystemState] = useState({});
  
  const canvasRef = useRef(null);

  // Add component to canvas
  const handleAddComponent = useCallback((componentDef, position) => {
    const newComponent = {
      id: `${componentDef.id}-${Date.now()}`,
      type: componentDef.id,
      ...componentDef,
      position: position || { x: 100, y: 100 },
      status: 'normal',
      state: {
        power: 0,
        voltage: componentDef.voltage || 0,
        current: 0,
        frequency: 60
      }
    };
    
    setCanvasComponents(prev => [...prev, newComponent]);
  }, []);

  // Update component position
  const handleMoveComponent = useCallback((componentId, newPosition) => {
    setCanvasComponents(prev =>
      prev.map(comp =>
        comp.id === componentId ? { ...comp, position: newPosition } : comp
      )
    );
  }, []);

  // Update component properties
  const handleUpdateComponent = useCallback((componentId, updates) => {
    setCanvasComponents(prev =>
      prev.map(comp =>
        comp.id === componentId ? { ...comp, ...updates } : comp
      )
    );
  }, []);

  // Delete component
  const handleDeleteComponent = useCallback((componentId) => {
    setCanvasComponents(prev => prev.filter(comp => comp.id !== componentId));
    setConnections(prev => prev.filter(conn => 
      conn.from !== componentId && conn.to !== componentId
    ));
    if (selectedComponent?.id === componentId) {
      setSelectedComponent(null);
    }
  }, [selectedComponent]);

  // Add connection
  const handleAddConnection = useCallback((fromId, toId) => {
    const newConnection = {
      id: `conn-${Date.now()}`,
      from: fromId,
      to: toId,
      voltage: 0,
      type: 'AC',
      status: 'normal'
    };
    setConnections(prev => [...prev, newConnection]);
  }, []);

  // Delete connection
  const handleDeleteConnection = useCallback((connectionId) => {
    setConnections(prev => prev.filter(conn => conn.id !== connectionId));
    if (selectedConnection?.id === connectionId) {
      setSelectedConnection(null);
    }
  }, [selectedConnection]);

  // Toggle mode
  const handleToggleMode = () => {
    if (mode === 'design') {
      // Validate before entering simulation
      if (canvasComponents.length === 0) {
        alert('Add components to the canvas before starting simulation');
        return;
      }
      setMode('simulation');
    } else {
      setMode('design');
      setSimulationRunning(false);
    }
  };

  // Start simulation
  const handleStartSimulation = () => {
    setSimulationRunning(true);
    // Initialize system state
    const initialState = {};
    canvasComponents.forEach(comp => {
      initialState[comp.id] = {
        ...comp.state,
        status: comp.status
      };
    });
    setSystemState(initialState);
  };

  // Stop simulation
  const handleStopSimulation = () => {
    setSimulationRunning(false);
  };

  // ========================================================================
  // FUNCTION: handleTripComponent
  // ========================================================================
  // This function makes a component "trip" or "fail" - like when a turbine
  // breaks down or goes offline.
  //
  // HOW IT WORKS (Step by step):
  // 1. Find the component with the matching ID
  // 2. Change its status from 'normal' to 'offline'
  // 3. Set its power output to 0 (because it's not working anymore)
  //
  // REACT CONCEPT - useCallback:
  // We wrap this function in useCallback() which tells React:
  // "Don't recreate this function every time the component re-renders,
  //  keep using the same function." This makes the app faster.
  //
  // REACT CONCEPT - setCanvasComponents:
  // This is a "state setter" function from useState(). When we call it,
  // React updates the state AND automatically re-renders the screen.
  //
  // REACT CONCEPT - Immutability:
  // We don't change the existing array directly (that would be mutation).
  // Instead, we create a NEW array with .map() where one component is changed.
  // This is how React knows something changed and needs to update the screen.
  const handleTripComponent = useCallback((componentId) => {
    // Update the canvasComponents state
    setCanvasComponents(prev => 
      // 'prev' is the current state (the old array of components)
      // We use .map() to create a new array with one component modified
      prev.map(comp => 
        // Check: Is this the component we want to trip?
        comp.id === componentId 
          ? { 
              // YES - This is the one! Create a new object with changes
              ...comp,                          // Copy all existing properties
              status: 'offline',                // Change status to offline
              state: { 
                ...comp.state,                  // Copy existing state properties
                power: 0                        // Set power to zero (not producing)
              }
            } 
          : comp  // NO - Not this one, keep it unchanged
      )
    );
  }, []); // Empty array means: never recreate this function

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Data Center Power System Designer</h1>
        <Toolbar
          mode={mode}
          onToggleMode={handleToggleMode}
          simulationRunning={simulationRunning}
          onStartSimulation={handleStartSimulation}
          onStopSimulation={handleStopSimulation}
          zoom={zoom}
          onZoomIn={() => setZoom(prev => Math.min(prev + 0.1, 2))}
          onZoomOut={() => setZoom(prev => Math.max(prev - 0.1, 0.5))}
          onResetView={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        />
      </header>

      <div className="app-main">
        <ComponentLibrary
          onAddComponent={handleAddComponent}
          disabled={mode === 'simulation'}
        />

        <Canvas
          ref={canvasRef}
          components={canvasComponents}
          connections={connections}
          selectedComponent={selectedComponent}
          selectedConnection={selectedConnection}
          onSelectComponent={setSelectedComponent}
          onSelectConnection={setSelectedConnection}
          onMoveComponent={handleMoveComponent}
          onAddComponent={handleAddComponent}
          onAddConnection={handleAddConnection}
          zoom={zoom}
          pan={pan}
          onPan={setPan}
          mode={mode}
          simulationRunning={simulationRunning}
          systemState={systemState}
        />

        <PropertyPanel
          selectedComponent={selectedComponent}
          selectedConnection={selectedConnection}
          onUpdateComponent={handleUpdateComponent}
          onDeleteComponent={handleDeleteComponent}
          onDeleteConnection={handleDeleteConnection}
          onClose={() => {
            setSelectedComponent(null);
            setSelectedConnection(null);
          }}
          disabled={mode === 'simulation'}
        />

        {/* ================================================================
            SIMULATION CONTROLS PANEL
            ================================================================
            This is the control panel on the right side that shows buttons
            for triggering failures (like "Trip Turbine").
            
            PROPS WE'RE PASSING:
            - mode: Tells it if we're in 'design' or 'simulation' mode
            - selectedComponent: Which component the user clicked on
            - onTripComponent: A FUNCTION we're passing down (called a callback)
            
            REACT CONCEPT - Passing Functions as Props:
            We pass handleTripComponent as a prop called "onTripComponent".
            This lets the child component (SimulationControls) call our
            function when the user clicks a button. It's like giving the
            child a phone number to call back to the parent.
            
            When the user clicks "Trip Turbine", this chain happens:
            1. SimulationControls calls onTripComponent(turbineId)
            2. That calls our handleTripComponent function here in App.js
            3. handleTripComponent updates the state
            4. React re-renders everything with the new state
            5. The turbine appears red on screen!
        ================================================================ */}
        <SimulationControls
          mode={mode}
          selectedComponent={selectedComponent}
          onTripComponent={handleTripComponent}
        />
      </div>
    </div>
  );
}

export default App;
