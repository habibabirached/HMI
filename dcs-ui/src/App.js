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

        <SimulationControls
          mode={mode}
          selectedComponent={selectedComponent}
        />
      </div>
    </div>
  );
}

export default App;
