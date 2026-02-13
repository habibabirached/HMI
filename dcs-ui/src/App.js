import React, { useState, useRef, useCallback } from 'react';
import ComponentLibrary from './components/ComponentLibrary';
import Canvas from './components/Canvas';
import PropertyPanel from './components/PropertyPanel';
import SimulationControls from './components/SimulationControls';
import Toolbar from './components/Toolbar';
import SaveLoadDialog from './components/SaveLoadDialog';
import CSVUploadDialog from './components/CSVUploadDialog/CSVUploadDialog';
import CSVPickerDialog from './components/CSVPickerDialog/CSVPickerDialog';
import ColumnPickerDialog from './components/ColumnPickerDialog/ColumnPickerDialog';
import ChartPanel from './components/ChartPanel/ChartPanel';
import * as Scenarios from './scenarios/quickScenarios';
import './styles/App.css';

// Backend API URL
const API_BASE_URL = 'http://localhost:5000';

function App() {
  // Application mode: 'design' or 'simulation'
  const [mode, setMode] = useState('design');
  
  // View mode: 'designer' or 'customer'
  const [viewMode, setViewMode] = useState('designer');
  
  // Canvas state
  const [canvasComponents, setCanvasComponents] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [selectedConnection, setSelectedConnection] = useState(null);
  
  // Multi-selection state
  const [selectedComponents, setSelectedComponents] = useState([]); // Array of component IDs for multi-select
  
  // Canvas viewport
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  // Simulation state
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [systemState, setSystemState] = useState({});
  const [simulationTime, setSimulationTime] = useState(0); // Current simulation time in seconds
  const [simulationSpeed, setSimulationSpeed] = useState(1); // Speed multiplier: 1x, 10x, 100x, 1000x
  const simulationIntervalRef = useRef(null); // Interval for advancing simulation time
  
  // Save/Load dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState(null); // 'save' or 'load'
  
  // Save state
  const [currentConfigName, setCurrentConfigName] = useState(null); // Track current config name for "Save"
  const [isSaving, setIsSaving] = useState(false); // Saving spinner state
  const [csvStatus, setCsvStatus] = useState(null); // CSV status for current configuration
  const [availableSimulations, setAvailableSimulations] = useState([]); // Unique simulations from CSV
  const [simConfig, setSimConfig] = useState(null); // Simulation configuration JSON (from backend)
  const [simulationData, setSimulationData] = useState([]); // Filtered CSV data for current simulation
  const [simulationMetadata, setSimulationMetadata] = useState(null); // Metadata about current simulation
  
  // CSV Upload dialog state
  const [showCSVDialog, setShowCSVDialog] = useState(false);
  
  // CSV Picker dialog state
  const [showCSVPicker, setShowCSVPicker] = useState(false);
  const [csvPickerContext, setCsvPickerContext] = useState(null); // { component, chartType }
  
  // Column Picker dialog state
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [columnPickerContext, setColumnPickerContext] = useState(null); // { component, chartType, csvData }
  
  // Chart Panel state
  const [openCharts, setOpenCharts] = useState([]); // Charts currently displayed in bottom panel
  const [chartPanelHeight, setChartPanelHeight] = useState(300);
  
  const canvasRef = useRef(null);

  // Add component to canvas
  const handleAddComponent = useCallback((componentDef, position) => {
    const newComponent = {
      id: `${componentDef.id}-${Date.now()}`,
      type: componentDef.id,
      ...componentDef,
      position: position || { x: 100, y: 100 },
      status: 'idle', // Start components as idle (gray) until simulation starts
      state: {
        power: 0,
        voltage: componentDef.properties?.voltage || 0,
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

  // ============================================================================
  // MULTI-SELECTION HANDLERS
  // ============================================================================
  
  /**
   * Toggle a component in multi-selection
   * @param {string} componentId - ID of component to toggle
   * @param {boolean} shiftKey - Whether Shift key is pressed
   */
  const handleMultiSelect = useCallback((componentId, shiftKey) => {
    if (!shiftKey) {
      // No shift key - clear multi-selection, use single selection
      setSelectedComponents([]);
      return;
    }
    
    // Shift key pressed - toggle this component in multi-selection
    setSelectedComponents(prev => {
      if (prev.includes(componentId)) {
        // Already selected - remove it
        return prev.filter(id => id !== componentId);
      } else {
        // Not selected - add it
        return [...prev, componentId];
      }
    });
    
    // Clear single selection when using multi-select
    setSelectedComponent(null);
  }, []);
  
  /**
   * Clear all multi-selections
   */
  const handleClearMultiSelection = useCallback(() => {
    setSelectedComponents([]);
  }, []);
  
  /**
   * Check if a component is multi-selected
   * @param {string} componentId
   * @returns {boolean}
   */
  const isComponentMultiSelected = useCallback((componentId) => {
    return selectedComponents.includes(componentId);
  }, [selectedComponents]);

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
    setSimulationTime(0); // Reset simulation time to 0
    
    // Turn on all components when simulation starts
    // Loop through each component and set status to 'online' and isTripped to false
    setCanvasComponents(prev => 
      prev.map(comp => ({
        ...comp,
        status: 'online',
        isTripped: false
      }))
    );
    
    // Initialize system state
    const initialState = {};
    canvasComponents.forEach(comp => {
      initialState[comp.id] = {
        ...comp.state,
        status: 'online' // Set status to 'online' in system state as well
      };
    });
    setSystemState(initialState);
    
    // Start simulation time advancement
    startSimulationClock();
  };

  // Stop simulation
  const handleStopSimulation = () => {
    setSimulationRunning(false);
    stopSimulationClock();
  };
  
  // Simulation clock advancement
  const startSimulationClock = (speed) => {
    // Use the speed parameter if provided, otherwise use state
    const currentSpeed = speed !== undefined ? speed : simulationSpeed;
    
    // Clear any existing interval
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
    }
    
    // Advance simulation time every 100ms (10 FPS)
    // Time increment = (100ms / 1000) * speed = 0.1 * speed seconds per frame
    simulationIntervalRef.current = setInterval(() => {
      setSimulationTime(prev => prev + (0.1 * currentSpeed));
    }, 100);
  };
  
  const stopSimulationClock = () => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
  };
  
  // Update simulation speed
  const handleSetSimulationSpeed = (speed) => {
    setSimulationSpeed(speed);
    if (simulationRunning) {
      startSimulationClock(speed); // Pass speed directly to avoid stale closure
    }
  };
  
  // Clean up interval on unmount
  React.useEffect(() => {
    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, []);

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
    // DEBUG: Log to console so we can see this function was called
    console.log('🔴 handleTripComponent called with ID:', componentId);
    
    // Update the canvasComponents state
    setCanvasComponents(prev => {
      // DEBUG: Log the current components before the change
      console.log('📋 Current components:', prev);
      
      // 'prev' is the current state (the old array of components)
      // We use .map() to create a new array with one component modified
      const updated = prev.map(comp => {
        // Check: Is this the component we want to trip?
        if (comp.id === componentId) {
          // DEBUG: Found the component we're tripping
          console.log('✅ Found component to trip:', comp.name, comp.id);
          
          return { 
            // YES - This is the one! Create a new object with changes
            ...comp,                          // Copy all existing properties
            status: 'offline',                // Change status to offline
            state: { 
              ...comp.state,                  // Copy existing state properties
              power: 0                        // Set power to zero (not producing)
            }
          };
        }
        return comp;  // NO - Not this one, keep it unchanged
      });
      
      // DEBUG: Log the updated components after the change
      console.log('📋 Updated components:', updated);
      
      return updated;
    });
  }, []); // Empty array means: never recreate this function

  // ========================================================================
  // FUNCTION: handleRestartComponent
  // ========================================================================
  // This function brings a component back online after it was tripped/failed.
  //
  // HOW IT WORKS (Step by step):
  // 1. Find the component with the matching ID
  // 2. Change its status from 'offline' back to 'normal'
  // 3. Restore its power output (for generators, use their rating)
  //
  // This is essentially the OPPOSITE of handleTripComponent.
  //
  // REACT CONCEPT - Same patterns as handleTripComponent:
  // - useCallback for performance
  // - Immutability (create new array with .map())
  // - State setter triggers re-render
  const handleRestartComponent = useCallback((componentId) => {
    // DEBUG: Log to console so we can see this function was called
    console.log('🟢 handleRestartComponent called with ID:', componentId);
    
    // Update the canvasComponents state
    setCanvasComponents(prev => {
      // DEBUG: Log the current components before the change
      console.log('📋 Current components:', prev);
      
      const updated = prev.map(comp => {
        // Check: Is this the component we want to restart?
        if (comp.id === componentId) {
          // DEBUG: Found the component we're restarting
          console.log('✅ Found component to restart:', comp.name, comp.id);
          
          // For generators/turbines, restore power to their rating
          // For other components, just set to 0 (they don't generate power)
          const restoredPower = comp.rating && comp.type.includes('turbine') 
            ? comp.rating 
            : 0;
          
          return { 
            ...comp,                          // Copy all existing properties
            status: 'normal',                 // Change status back to normal
            state: { 
              ...comp.state,                  // Copy existing state properties
              power: restoredPower            // Restore power output
            }
          };
        }
        return comp;  // Not this one, keep unchanged
      });
      
      // DEBUG: Log the updated components after the change
      console.log('📋 Updated components:', updated);
      
      return updated;
    });
  }, []);

  // ========================================================================
  // FUNCTION: handleOpenBreaker
  // ========================================================================
  // This opens a breaker, which disconnects the electrical circuit.
  // Think of it like flipping a light switch to OFF - no power flows through.
  //
  // This is a NORMAL operation (not a failure), so we use status 'open'
  // instead of 'offline'. Operators manually open breakers to isolate
  // sections of the power system for maintenance or reconfiguration.
  const handleOpenBreaker = useCallback((componentId) => {
    console.log('🟠 handleOpenBreaker called with ID:', componentId);
    
    setCanvasComponents(prev => {
      const updated = prev.map(comp => {
        if (comp.id === componentId) {
          console.log('✅ Opening breaker:', comp.name, comp.id);
          return { 
            ...comp,
            status: 'open',              // Status: open (manually opened)
            state: { 
              ...comp.state,
              current: 0                 // No current flows through open breaker
            }
          };
        }
        return comp;
      });
      return updated;
    });
  }, []);

  // ========================================================================
  // FUNCTION: handleCloseBreaker
  // ========================================================================
  // This closes a breaker, which reconnects the electrical circuit.
  // Think of it like flipping a light switch to ON - power can flow through.
  //
  // This restores normal operation after a breaker was manually opened.
  const handleCloseBreaker = useCallback((componentId) => {
    console.log('🟢 handleCloseBreaker called with ID:', componentId);
    
    setCanvasComponents(prev => {
      const updated = prev.map(comp => {
        if (comp.id === componentId) {
          console.log('✅ Closing breaker:', comp.name, comp.id);
          return { 
            ...comp,
            status: 'normal',            // Status: normal (closed and operational)
            state: { 
              ...comp.state,
              // Current will be determined by power flow calculation later
            }
          };
        }
        return comp;
      });
      return updated;
    });
  }, []);

  // ========================================================================
  // FUNCTION: handleTripBreaker
  // ========================================================================
  // This trips a breaker due to a protection fault (overcurrent, short circuit, etc.)
  // This is DIFFERENT from manually opening - it's an automatic safety response.
  //
  // When a breaker trips, it's like a circuit breaker in your home tripping
  // due to overload. It needs to be reset/closed before it can work again.
  const handleTripBreaker = useCallback((componentId) => {
    console.log('🔴 handleTripBreaker called with ID:', componentId);
    
    setCanvasComponents(prev => {
      const updated = prev.map(comp => {
        if (comp.id === componentId) {
          console.log('✅ Tripping breaker:', comp.name, comp.id);
          return { 
            ...comp,
            status: 'tripped',           // Status: tripped (fault condition)
            state: { 
              ...comp.state,
              current: 0                 // No current flows through tripped breaker
            }
          };
        }
        return comp;
      });
      return updated;
    });
  }, []);

  // ========================================================================
  // QUICK SCENARIO WRAPPER FUNCTIONS
  // ========================================================================
  // These functions wrap the scenario module functions, providing them
  // with the current canvas state and handler functions they need.
  // 
  // ARCHITECTURE NOTE:
  // The actual scenario logic lives in ./scenarios/quickScenarios.js
  // These wrapper functions just connect the scenarios to our App state.
  // This keeps the code organized and modular!
  // ========================================================================

  const handleTripRandomTurbine = useCallback(() => {
    const result = Scenarios.tripRandomTurbine(canvasComponents, {
      handleTripComponent
    });
    
    if (result.success && result.selectedComponent) {
      setSelectedComponent(result.selectedComponent);
    } else if (!result.success) {
      alert(result.message);
    }
  }, [canvasComponents, handleTripComponent]);

  const handleTripAllTurbines = useCallback(() => {
    const result = Scenarios.tripAllTurbines(canvasComponents, {
      handleTripComponent
    });
    
    if (!result.success) {
      alert(result.message);
    }
  }, [canvasComponents, handleTripComponent]);

  const handleGridLoss = useCallback(() => {
    const result = Scenarios.gridLoss(canvasComponents, {
      handleTripComponent
    });
    
    if (!result.success) {
      alert(result.message);
    }
  }, [canvasComponents, handleTripComponent]);

  const handleOpenAllBreakers = useCallback(() => {
    const result = Scenarios.openAllBreakers(canvasComponents, {
      handleOpenBreaker
    });
    
    if (!result.success) {
      alert(result.message);
    }
  }, [canvasComponents, handleOpenBreaker]);

  // ========================================================================
  // FUNCTION: handleResetSystem
  // ========================================================================
  // This function resets the entire simulation back to the initial state.
  // All components are returned to 'normal' status, clearing any failures,
  // trips, or manual operations.
  //
  // WHAT IT DOES:
  // 1. Loops through every component on the canvas
  // 2. Changes status to 'normal' (operational)
  // 3. Restores default power outputs for generators
  // 4. Essentially a "start over" button
  //
  // USE CASE:
  // After running several failure scenarios, you want to return to a
  // clean slate without having to manually restart each component.
  const handleResetSystem = useCallback(() => {
    console.log('🔄 Reset System triggered');
    
    // Count how many components are currently not normal
    const abnormalComponents = canvasComponents.filter(comp => 
      comp.status !== 'normal'
    );
    
    if (abnormalComponents.length === 0) {
      console.log('✅ System already in normal state');
      alert('System is already in normal state - nothing to reset!');
      return;
    }
    
    // Ask for confirmation before resetting
    const confirmed = window.confirm(
      `Reset ${abnormalComponents.length} component(s) back to normal state?\n\n` +
      'This will clear all failures, trips, and open breakers.'
    );
    
    if (!confirmed) {
      console.log('❌ Reset cancelled by user');
      return;
    }
    
    console.log(`🔄 Resetting ${abnormalComponents.length} components to normal`);
    
    // Reset all components to normal state
    setCanvasComponents(prev => 
      prev.map(comp => {
        // Only change components that aren't already normal
        if (comp.status !== 'normal') {
          console.log('  ↻ Resetting:', comp.name, comp.id, 'from', comp.status, 'to normal');
          
          // For generators/turbines, restore power to their rating
          const restoredPower = comp.rating && comp.type.includes('turbine') 
            ? comp.rating 
            : 0;
          
          return {
            ...comp,
            status: 'normal',
            state: {
              ...comp.state,
              power: restoredPower
            }
          };
        }
        return comp;
      })
    );
    
    console.log('✅ System reset complete');
  }, [canvasComponents]);

  /**
   * Handle simulation scenario button click
   * This will be expanded in later steps to:
   * 1. Clear existing charts
   * 2. Load charts for this simulation (from JSON config)
   * 3. Filter CSV data to only this simulation
   * 4. Start playback
   */
  const handleRunSimulation = async (simulationId) => {
    console.log('🎬 Run simulation clicked:', simulationId);
    console.log('📊 Current configuration:', currentConfigName);
    console.log('📊 CSV status:', csvStatus);
    console.log('📊 Sim config:', simConfig);
    
    // ========================================================================
    // STEP 1: Validate prerequisites
    // ========================================================================
    if (!currentConfigName) {
      alert('⚠️ No configuration loaded. Please load a design first.');
      return;
    }
    
    if (!csvStatus || !csvStatus.exists) {
      alert('⚠️ No CSV data available for this configuration.\n\nPlease load CSV data first.');
      return;
    }
    
    if (!availableSimulations.includes(simulationId)) {
      alert(`⚠️ Simulation "${simulationId}" not found in CSV data.`);
      return;
    }
    
    // ========================================================================
    // STEP 2: Clear existing charts
    // ========================================================================
    console.log('🧹 Clearing existing charts...');
    const previousChartCount = openCharts.length;
    setOpenCharts([]);
    console.log(`✅ Cleared ${previousChartCount} chart(s)`);
    
    // ========================================================================
    // STEP 3: Fetch full CSV data from backend
    // ========================================================================
    try {
      console.log(`📥 Fetching CSV data: ${csvStatus.csv_name}`);
      const response = await fetch(`http://localhost:5000/api/csv/${csvStatus.csv_name}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch CSV: ${response.statusText}`);
      }
      
      const csvData = await response.json();
      console.log('✅ CSV data fetched:', csvData.row_count, 'total rows');
      
      // Parse the data field (it's already an array, or might be a JSON string)
      let allRows;
      if (typeof csvData.data === 'string') {
        allRows = JSON.parse(csvData.data);
      } else if (Array.isArray(csvData.data)) {
        allRows = csvData.data;
      } else {
        throw new Error('Unexpected CSV data format');
      }
      console.log('📊 Parsed CSV rows:', allRows.length);
      
      // ========================================================================
      // STEP 4: Filter data by simulation ID
      // ========================================================================
      const filteredRows = allRows.filter(row => row.simulation === simulationId);
      console.log(`🔍 Filtered to ${filteredRows.length} rows for simulation "${simulationId}"`);
      
      if (filteredRows.length === 0) {
        alert(`⚠️ No data found for simulation "${simulationId}".\n\nThe CSV may not contain this simulation scenario.`);
        return;
      }
      
      // ========================================================================
      // STEP 5: Prepare simulation metadata
      // ========================================================================
      const simulationMetadata = {
        id: simulationId,
        displayName: simConfig?.simulations?.[simulationId]?.display_name || simulationId,
        description: simConfig?.simulations?.[simulationId]?.description || '',
        rowCount: filteredRows.length,
        timeRange: {
          min: Math.min(...filteredRows.map(r => r.time_sec || 0)),
          max: Math.max(...filteredRows.map(r => r.time_sec || 0))
        },
        columns: Object.keys(filteredRows[0] || {})
      };
      
      console.log('📋 Simulation metadata:', simulationMetadata);
      
      // ========================================================================
      // STEP 6: Store data and metadata in state
      // ========================================================================
      console.log('💾 Storing simulation data in state...');
      setSimulationData(filteredRows);
      setSimulationMetadata(simulationMetadata);
      console.log('✅ Simulation data stored in state');
      
      // ========================================================================
      // STEP 7: Load charts from simulation config
      // ========================================================================
      console.log('📊 Checking for charts to load from sim_config...');
      
      if (simConfig && simConfig.simulations && simConfig.simulations[simulationId]) {
        const scenarioConfig = simConfig.simulations[simulationId];
        const chartsToDisplay = scenarioConfig.charts_to_display || [];
        
        console.log(`📋 Simulation config defines ${chartsToDisplay.length} chart(s) to display`);
        
        if (chartsToDisplay.length > 0) {
          console.log('📊 Charts defined in sim_config:', chartsToDisplay);
          console.log('🔄 Auto-loading charts...');
          
          // Load each chart definition
          const newCharts = chartsToDisplay.map((chartDef, index) => {
            const component = canvasComponents.find(c => c.id === chartDef.component_id);
            
            if (!component) {
              console.warn(`⚠️  Component not found: ${chartDef.component_id}`);
              return null;
            }
            
            // Create chart object for openCharts
            return {
              id: `sim-chart-${Date.now()}-${index}`,
              componentId: component.id,
              componentName: component.name,
              chartType: chartDef.chart_type || '2d',
              csvName: csvStatus.csv_name,
              xColumn: chartDef.x_column,
              yColumn: chartDef.y_column,
              title: chartDef.title || `${component.name} - ${chartDef.y_column}`
            };
          }).filter(Boolean); // Remove nulls
          
          // Add all charts to openCharts
          setOpenCharts(newCharts);
          console.log(`✅ Auto-loaded ${newCharts.length} chart(s)`);
        } else {
          console.log('ℹ️  No charts defined for this simulation in sim_config');
          console.log('ℹ️  User can manually add charts via right-click menu');
        }
      } else {
        console.log('ℹ️  No simulation config available, skipping chart auto-load');
      }
      
      // ========================================================================
      // STEP 8: Log success and prepare for next steps
      // ========================================================================
      console.log('✅ Simulation data ready for playback');
      console.log('📊 Time range:', simulationMetadata.timeRange);
      console.log('📊 Available columns:', simulationMetadata.columns);
      
      // Show success message with details
      const detailsMessage = [
        `Simulation: ${simulationMetadata.displayName}`,
        `Rows: ${simulationMetadata.rowCount}`,
        `Time: ${simulationMetadata.timeRange.min}s to ${simulationMetadata.timeRange.max}s`,
        ``,
        `Next steps (will be implemented):`,
        `- Clear current charts`,
        `- Load charts from sim_config`,
        `- Start animated playback`
      ].join('\n');
      
      alert(`✅ Simulation data loaded!\n\n${detailsMessage}`);
      
      // TODO in next steps:
      // - ✅ Clear current charts (DONE)
      // - ✅ Store filtered data in state (DONE)
      // - ✅ Auto-load charts from sim_config (DONE)
      // - Implement animation loop with playback controls
      // - Add event markers visualization
      
    } catch (error) {
      console.error('❌ Error loading simulation:', error);
      alert(`❌ Failed to load simulation data:\n\n${error.message}`);
    }
  };

  /**
   * Toggle view mode (designer vs customer)
   */
  const handleToggleViewMode = () => {
    const newViewMode = viewMode === 'designer' ? 'customer' : 'designer';
    setViewMode(newViewMode);
    
    // When switching to designer view, stop simulation
    if (newViewMode === 'designer') {
      setSimulationRunning(false);
    }
  };

  // ============================================================================
  // SAVE/LOAD CONFIGURATION HANDLERS
  // ============================================================================
  
  /**
   * Open Save Dialog (Save As - always ask for name)
   */
  const handleOpenSaveDialog = () => {
    setDialogMode('save');
    setShowDialog(true);
  };

  /**
   * Quick Save (if config name exists, save without dialog)
   */
  const handleQuickSave = async () => {
    if (!currentConfigName) {
      // No config name, open Save As dialog
      handleOpenSaveDialog();
      return;
    }

    // Quick save to existing config
    setIsSaving(true);
    const saveStartTime = Date.now();

    try {
      const configData = {
        name: currentConfigName,
        description: null, // Keep existing description
        data: getCurrentConfiguration()
      };

      console.log('💾 Quick saving configuration:', currentConfigName);

      const response = await fetch(`${API_BASE_URL}/api/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const savedConfig = await response.json();

      // Ensure minimum 3-second spinner display
      const elapsed = Date.now() - saveStartTime;
      const remainingTime = Math.max(0, 3000 - elapsed);

      await new Promise(resolve => setTimeout(resolve, remainingTime));

      console.log(`✅ Configuration saved: ${savedConfig.name}`);
      alert(`✅ Configuration "${savedConfig.name}" saved successfully!`);

    } catch (error) {
      console.error('❌ Error saving configuration:', error);
      alert(`❌ Failed to save: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Open Load Dialog
   */
  const handleOpenLoadDialog = () => {
    setDialogMode('load');
    setShowDialog(true);
  };

  /**
   * Close Dialog
   */
  const handleCloseDialog = () => {
    setShowDialog(false);
    setDialogMode(null);
  };

  /**
   * Open CSV Upload Dialog
   */
  const handleOpenCSVDialog = () => {
    setShowCSVDialog(true);
  };

  /**
   * Close CSV Upload Dialog
   */
  const handleCloseCSVDialog = () => {
    setShowCSVDialog(false);
  };

  /**
   * Handle CSV Upload Complete
   * Called when CSV files are successfully uploaded
   */
  const handleCSVUploadComplete = () => {
    console.log('✅ CSV upload complete');
    // Future: Refresh CSV list in chart association dialog
  };

  /**
   * Handle Chart Association Request
   * Called when user selects a chart type from context menu
   */
  const handleAssociateChart = async (component, chartType) => {
    console.log('📊 Associate chart:', chartType, 'to', component.name);
    
    // Auto-determine CSV name from current configuration
    if (!currentConfigName) {
      alert('⚠️ No configuration loaded. Please load a configuration first.');
      return;
    }
    
    const expectedCsvName = `${currentConfigName}.csv`;
    console.log(`🔍 Auto-selecting CSV: ${expectedCsvName}`);
    
    // Check if CSV data is loaded
    if (!csvStatus || !csvStatus.exists) {
      alert(`⚠️ No CSV data loaded for this configuration.\n\nExpected file: ${expectedCsvName}\n\nPlease ensure the CSV file exists in the saved_csv directory.`);
      return;
    }
    
    // Fetch the CSV data from backend
    try {
      const response = await fetch(`http://localhost:5000/api/csv/${expectedCsvName}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch CSV: ${response.statusText}`);
      }
      const csvData = await response.json();
      
      console.log('✅ CSV data fetched:', csvData.name);
      
      // Go directly to column picker (skip CSV picker dialog)
      setColumnPickerContext({
        component,
        chartType,
        csvData
      });
      setShowColumnPicker(true);
      
    } catch (error) {
      console.error('❌ Error fetching CSV:', error);
      alert(`Failed to load CSV data: ${error.message}\n\nExpected file: ${expectedCsvName}`);
    }
  };

  /**
   * Handle CSV selection from picker
   */
  const handleCSVSelected = (csvData) => {
    console.log('✅ CSV selected:', csvData.name);
    console.log('📋 Context:', csvPickerContext);
    
    // Close CSV picker and open column picker
    setShowCSVPicker(false);
    setColumnPickerContext({
      component: csvPickerContext.component,
      chartType: csvPickerContext.chartType,
      csvData
    });
    setShowColumnPicker(true);
  };

  /**
   * Handle column selection confirmation
   */
  const handleColumnsConfirmed = (selection) => {
    console.log('✅ Columns confirmed:', selection);
    
    const { xColumn, yColumn, csvData } = selection;
    const { component, chartType } = columnPickerContext;
    
    // Create chart association object
    const chartAssociation = {
      id: `chart-${Date.now()}`,
      chartType,
      csvName: csvData.name,
      xColumn,
      yColumn,
      created: new Date().toISOString()
    };
    
    // Update component with new chart association
    setCanvasComponents(prev => prev.map(comp => {
      if (comp.id === component.id) {
        // Add or update charts array in component
        const existingCharts = comp.charts || [];
        
        // Check if this chart type already exists
        const existingIndex = existingCharts.findIndex(c => c.chartType === chartType);
        
        let updatedCharts;
        if (existingIndex >= 0) {
          // Replace existing chart of this type
          updatedCharts = [...existingCharts];
          updatedCharts[existingIndex] = chartAssociation;
          console.log(`🔄 Updated existing ${chartType} chart for ${comp.name}`);
        } else {
          // Add new chart
          updatedCharts = [...existingCharts, chartAssociation];
          console.log(`✨ Added new ${chartType} chart to ${comp.name}`);
        }
        
        return {
          ...comp,
          charts: updatedCharts
        };
      }
      return comp;
    }));
    
    console.log('📊 Chart associated successfully:', {
      component: component.name,
      chartType,
      csv: csvData.name,
      xColumn,
      yColumn
    });
    
    setShowColumnPicker(false);
  };

  /**
   * Handle opening a chart in the bottom panel
   */
  const handleOpenChart = (component, chart) => {
    console.log('📊 Opening chart:', chart.chartType, 'for', component.name);
    
    // Check if chart is already open
    const isAlreadyOpen = openCharts.some(c => 
      c.componentId === component.id && c.chartId === chart.id
    );
    
    if (isAlreadyOpen) {
      console.log('⚠️  Chart already open');
      return;
    }
    
    // Add chart to open charts
    const openChart = {
      id: `open-${Date.now()}`,
      componentId: component.id,
      componentName: component.name,
      chartId: chart.id,
      chartType: chart.chartType,
      csvName: chart.csvName,
      xColumn: chart.xColumn,
      yColumn: chart.yColumn
    };
    
    setOpenCharts(prev => [...prev, openChart]);
  };

  /**
   * Handle creating a multi-component chart (animated bar chart, etc.)
   */
  const handleCreateMultiComponentChart = (chartConfig) => {
    console.log('📊 Creating multi-component chart:', chartConfig);
    
    // Create a single chart that displays multiple components
    const multiChart = {
      id: `multi-${Date.now()}`,
      type: 'multi-component',
      chartType: chartConfig.type, // 'multi-bar-chart'
      title: chartConfig.title,
      csvName: chartConfig.csvFile,
      timeColumn: chartConfig.timeColumn,
      components: chartConfig.components, // Array of {id, name, type, columnName}
      isMultiComponent: true
    };
    
    setOpenCharts(prev => [...prev, multiChart]);
  };

  /**
   * Handle removing a chart from the bottom panel
   */
  const handleRemoveChart = (openChartId) => {
    console.log('🗑️  Removing chart:', openChartId);
    setOpenCharts(prev => prev.filter(c => c.id !== openChartId));
  };

  /**
   * Handle closing the entire chart panel
   */
  const handleCloseChartPanel = () => {
    console.log('❌ Closing chart panel');
    setOpenCharts([]);
  };

  /**
   * Handle Load - Apply loaded configuration to the app
   */
  /**
   * Fetch available simulations from CSV
   * Calls /api/csv/{name}/simulations to get unique simulation identifiers
   */
  const fetchAvailableSimulations = async (csvName) => {
    if (!csvName) return;
    
    try {
      console.log(`🔍 Fetching simulations from: ${csvName}`);
      const response = await fetch(`http://localhost:5000/api/csv/${csvName}/simulations`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch simulations: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`✅ Available simulations:`, result.simulations);
      setAvailableSimulations(result.simulations);
      
    } catch (error) {
      console.error('❌ Error fetching simulations:', error);
      setAvailableSimulations([]);
    }
  };

  const handleConfigurationLoaded = (loadedConfig) => {
    console.log('✅ Loading configuration:', loadedConfig.name);
    console.log('🔍 Full loadedConfig:', loadedConfig); // DEBUG: See entire response
    console.log('🔍 csv_status:', loadedConfig.csv_status); // DEBUG: Check csv_status
    console.log('🔍 sim_config:', loadedConfig.sim_config); // DEBUG: Check sim_config
    
    // Save the configuration name for future quick saves
    setCurrentConfigName(loadedConfig.name);
    
    // Store simulation configuration (if present)
    if (loadedConfig.sim_config) {
      setSimConfig(loadedConfig.sim_config);
      console.log('✅ Simulation config loaded:', Object.keys(loadedConfig.sim_config.simulations || {}).length, 'scenarios');
    } else {
      setSimConfig(null);
      console.log('ℹ️  No simulation config available for this design');
    }
    
    // Store CSV status and fetch available simulations
    if (loadedConfig.csv_status) {
      setCsvStatus(loadedConfig.csv_status);
      console.log('✅ CSV Status set:', loadedConfig.csv_status);
      if (loadedConfig.csv_status.exists) {
        console.log(`📊 ${loadedConfig.csv_status.message}`);
        
        // Fetch available simulations from CSV
        fetchAvailableSimulations(loadedConfig.csv_status.csv_name);
      } else {
        console.warn(`⚠️  ${loadedConfig.csv_status.message}`);
        setAvailableSimulations([]); // No CSV = no simulations
      }
    } else {
      console.warn('⚠️ csv_status is missing from backend response!');
      setAvailableSimulations([]);
    }
    
    // Extract data from the loaded configuration
    const { data } = loadedConfig;
    
    // Apply the loaded state to the application
    if (data.canvasComponents) {
      // Set all components to 'idle' status initially when loaded
      // They will turn 'online' when user presses "Start Simulation"
      const componentsWithIdleStatus = data.canvasComponents.map(comp => ({
        ...comp,
        status: 'idle',
        isTripped: false
      }));
      setCanvasComponents(componentsWithIdleStatus);
    }
    
    if (data.connections) {
      setConnections(data.connections);
    }
    
    if (data.systemState) {
      setSystemState(data.systemState);
      
      // Apply zoom and pan if they exist
      if (data.systemState.zoom !== undefined) {
        setZoom(data.systemState.zoom);
      }
      if (data.systemState.pan) {
        setPan(data.systemState.pan);
      }
      if (data.systemState.simulationRunning !== undefined) {
        setSimulationRunning(data.systemState.simulationRunning);
      }
    }
    
    // Restore chart panel state if it exists
    if (data.chartPanelState) {
      if (data.chartPanelState.openCharts) {
        setOpenCharts(data.chartPanelState.openCharts);
      }
      if (data.chartPanelState.panelHeight) {
        setChartPanelHeight(data.chartPanelState.panelHeight);
      }
    } else {
      // Clear chart panel if no state saved
      setOpenCharts([]);
    }
    
    // Reset selection
    setSelectedComponent(null);
    setSelectedConnection(null);
    
    console.log('✅ Configuration loaded and applied');
  };

  /**
   * Handle Save - Update current config name after save
   */
  const handleConfigurationSaved = (savedConfig) => {
    console.log('✅ Configuration saved:', savedConfig.name);
    
    // Update current config name for future quick saves
    setCurrentConfigName(savedConfig.name);
  };

  /**
   * Get current configuration for saving
   */
  const getCurrentConfiguration = () => {
    return {
      canvasComponents,
      connections,
      systemState: {
        simulationRunning,
        zoom,
        pan,
        mode
      },
      chartPanelState: {
        openCharts,
        panelHeight: chartPanelHeight
      }
    };
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <img 
            src="/ge-vernova-logo.svg" 
            alt="GE Vernova" 
            className="ge-vernova-logo"
          />
          <h1>Data Center Power System Designer</h1>
          {currentConfigName && (
            <div className="config-status-badge">
              <span className="config-name">{currentConfigName}</span>
              {csvStatus && (
                <span className={`csv-status ${csvStatus.exists ? 'csv-loaded' : 'csv-missing'}`}>
                  {csvStatus.exists ? '✅ Data loaded' : '⚠️ No CSV data'}
                </span>
              )}
            </div>
          )}
          <div className="view-mode-toggle">
            <span className={`view-badge view-${viewMode}`}>
              {viewMode === 'designer' ? '🔧 DESIGNER' : '👤 CUSTOMER'}
            </span>
            <label className="toggle-switch" title={viewMode === 'designer' ? 'Switch to Customer View' : 'Switch to Designer View'}>
              <input 
                type="checkbox" 
                checked={viewMode === 'customer'} 
                onChange={handleToggleViewMode}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
        <Toolbar
          mode={mode}
          onToggleMode={handleToggleMode}
          viewMode={viewMode}
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
          onSave={handleQuickSave}
          onSaveAs={handleOpenSaveDialog}
          onLoad={handleOpenLoadDialog}
          onLoadCSV={handleOpenCSVDialog}
          hasComponents={canvasComponents.length > 0}
          canSave={currentConfigName !== null}
        />
      </header>

      <div className="app-main">
        {viewMode === 'designer' && (
          <ComponentLibrary
            onAddComponent={handleAddComponent}
            disabled={mode === 'simulation'}
          />
        )}

        <Canvas
          ref={canvasRef}
          components={canvasComponents}
          connections={connections}
          selectedComponent={selectedComponent}
          selectedConnection={selectedConnection}
          onSelectComponent={setSelectedComponent}
          onSelectConnection={setSelectedConnection}
          selectedComponents={selectedComponents}
          onMultiSelect={handleMultiSelect}
          onClearMultiSelection={handleClearMultiSelection}
          isComponentMultiSelected={isComponentMultiSelected}
          onMoveComponent={handleMoveComponent}
          onAddComponent={handleAddComponent}
          onAddConnection={handleAddConnection}
          onAssociateChart={handleAssociateChart}
          onOpenChart={handleOpenChart}
          onCreateMultiComponentChart={handleCreateMultiComponentChart}
          zoom={zoom}
          pan={pan}
          onPan={setPan}
          mode={mode}
          viewMode={viewMode}
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
            - onRestartComponent: NEW! Function to bring components back online
            
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
            
            When the user clicks "Restart Turbine", similar chain happens:
            1. SimulationControls calls onRestartComponent(turbineId)
            2. That calls our handleRestartComponent function here in App.js
            3. handleRestartComponent updates the state (offline → normal)
            4. React re-renders everything
            5. The turbine appears grey/normal on screen!
        ================================================================ */}
        <SimulationControls
          mode={mode}
          viewMode={viewMode}
          simulationRunning={simulationRunning}
          selectedComponent={selectedComponent}
          onTripComponent={handleTripComponent}
          onRestartComponent={handleRestartComponent}
          onOpenBreaker={handleOpenBreaker}
          onCloseBreaker={handleCloseBreaker}
          onTripBreaker={handleTripBreaker}
          onTripRandomTurbine={handleTripRandomTurbine}
          onTripAllTurbines={handleTripAllTurbines}
          onGridLoss={handleGridLoss}
          onOpenAllBreakers={handleOpenAllBreakers}
          onResetSystem={handleResetSystem}
          simulationTime={simulationTime}
          simulationSpeed={simulationSpeed}
          onSetSimulationSpeed={handleSetSimulationSpeed}
          availableSimulations={availableSimulations}
          simConfig={simConfig}
          onRunSimulation={handleRunSimulation}
        />
      </div>

      {/* Save/Load Dialog */}
      {showDialog && (
        <SaveLoadDialog
          mode={dialogMode}
          onClose={handleCloseDialog}
          onSave={handleConfigurationSaved}
          onLoad={handleConfigurationLoaded}
          currentConfiguration={getCurrentConfiguration()}
        />
      )}

      {/* CSV Upload Dialog */}
      {showCSVDialog && (
        <CSVUploadDialog
          onClose={handleCloseCSVDialog}
          onUploadComplete={handleCSVUploadComplete}
          currentConfigName={currentConfigName}
          expectedCsvName={currentConfigName ? `${currentConfigName}.csv` : null}
        />
      )}

      {/* CSV Picker Dialog */}
      {showCSVPicker && csvPickerContext && (
        <CSVPickerDialog
          onClose={() => setShowCSVPicker(false)}
          onSelectCSV={handleCSVSelected}
          componentName={csvPickerContext.component.name}
          chartType={csvPickerContext.chartType}
        />
      )}

      {/* Column Picker Dialog */}
      {showColumnPicker && columnPickerContext && (
        <ColumnPickerDialog
          onClose={() => setShowColumnPicker(false)}
          onConfirm={handleColumnsConfirmed}
          csvData={columnPickerContext.csvData}
          componentName={columnPickerContext.component.name}
          chartType={columnPickerContext.chartType}
        />
      )}

      {/* Chart Panel */}
      {openCharts.length > 0 && (
        <ChartPanel
          charts={openCharts}
          onClose={handleCloseChartPanel}
          onRemoveChart={handleRemoveChart}
          height={chartPanelHeight}
          onHeightChange={setChartPanelHeight}
          simulationTime={simulationTime}
          simulationRunning={simulationRunning}
          selectedComponentId={selectedComponent?.id}
          simulationData={simulationData}
          simulationMetadata={simulationMetadata}
          eventMarkers={simConfig?.simulations?.[simulationMetadata?.id]?.event_markers}
        />
      )}

      {/* Saving Spinner Overlay */}
      {isSaving && (
        <div className="saving-overlay">
          <div className="saving-spinner-container">
            <div className="saving-spinner"></div>
            <div className="saving-text">Saving Configuration...</div>
            <div className="saving-subtext">Please wait</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
