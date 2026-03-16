import React, { useState, useRef, useCallback } from 'react';
import ComponentLibrary from './components/ComponentLibrary';
import Canvas from './components/Canvas';
import PropertyPanel from './components/PropertyPanel';
import SimulationControls from './components/SimulationControls';
import Toolbar from './components/Toolbar';
import SaveLoadDialog from './components/SaveLoadDialog';
import ChartPanel from './components/ChartPanel/ChartPanel';
import ColumnPickerDialog from './components/ColumnPickerDialog/ColumnPickerDialog';
import ViewDataModal from './components/ViewDataModal/ViewDataModal';
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
  const [isUploading, setIsUploading] = useState(false); // Upload spinner state
  const [csvStatus, setCsvStatus] = useState(null); // CSV status for current configuration
  const [availableSimulations, setAvailableSimulations] = useState([]); // Unique simulations from CSV
  const [simConfig, setSimConfig] = useState(null); // Simulation configuration JSON (from backend)
  const [simulationData, setSimulationData] = useState([]); // Filtered CSV data for current simulation
  const [simulationMetadata, setSimulationMetadata] = useState(null); // Metadata about current simulation
  
  
  // Chart Panel state
  const [openCharts, setOpenCharts] = useState([]); // Charts currently displayed in bottom panel
  const [chartStacks, setChartStacks] = useState([]); // Array of stacks; each stack = array of chart indices
  const [chartPanelHeight, setChartPanelHeight] = useState(300);
  const [globalSampleStep, setGlobalSampleStep] = useState(1); // Chart sampling: 1=every row, 2=every 2nd, etc.
  const [perChartSampleStep, setPerChartSampleStep] = useState({}); // Per-chart override: { chartId: step }
  const [selectedRowIndices, setSelectedRowIndices] = useState(null); // Set<number> for cross-chart selection, null = none

  // STEP 4: Column picker – when user picks a chart type, we show this dialog to choose X/Y columns
  const [columnPickerContext, setColumnPickerContext] = useState(null); // { component, chartType } | null
  
  // View data modal – show first 200 rows of simulation CSV
  const [viewModal, setViewModal] = useState(null); // { simName, displayName, data } | null
  
  // Panel focus for z-index (click-to-bring-forward)
  const [focusedPanel, setFocusedPanel] = useState(null); // 'canvas' | 'property' | 'simulation' | 'charts' | null
  
  // Design view: canvas (interactive), image (PNG only), split (both side by side)
  const [designViewMode, setDesignViewMode] = useState('canvas'); // 'canvas' | 'image' | 'split'
  
  const canvasRef = useRef(null);

  const designImageUrl = currentConfigName && csvStatus?.use_design_dir
    ? `${API_BASE_URL}/api/designs/${encodeURIComponent(currentConfigName)}/image`
    : null;

  const handlePanelFocus = (panel, e) => {
    if (e.target.closest('button, select, input, a, [role="button"]')) return;
    setFocusedPanel(panel);
  };

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
    
    if (!currentConfigName) {
      alert('⚠️ No configuration loaded. Please load a design first.');
      return;
    }
    
    if (!availableSimulations.includes(simulationId)) {
      alert(`⚠️ Simulation "${simulationId}" not found.`);
      return;
    }
    
    if (!csvStatus?.use_design_dir) {
      alert('⚠️ No design directory for this configuration.');
      return;
    }
    
    console.log('🧹 Clearing existing charts...');
    setOpenCharts([]);
    setSelectedComponent(null);
    setSelectedConnection(null);
    
    try {
      let filteredRows;
      let scenarioConfig;
      let csvNameForCharts;
      
      // Fetch from design dir (per-sim .sim.json + .data.csv)
      const response = await fetch(
        `http://localhost:5000/api/designs/${encodeURIComponent(currentConfigName)}/simulations/${encodeURIComponent(simulationId)}`
      );
      if (!response.ok) throw new Error(`Failed to load simulation: ${response.statusText}`);
      const result = await response.json();
      filteredRows = result.data || [];
      scenarioConfig = result.sim_config || {};
      csvNameForCharts = `${simulationId}.data.csv`;
      
      if (!filteredRows || filteredRows.length === 0) {
        alert(`⚠️ No data found for simulation "${simulationId}".`);
        return;
      }
      
      const timeValues = filteredRows.map(r => Number(r.time_sec) || 0);
      const simulationMetadata = {
        id: simulationId,
        displayName: scenarioConfig.display_name || simConfig?.simulations?.[simulationId]?.display_name || simulationId,
        description: scenarioConfig.description || '',
        rowCount: filteredRows.length,
        timeRange: { min: Math.min(...timeValues), max: Math.max(...timeValues) },
        columns: Object.keys(filteredRows[0] || {})
      };
      
      setSimulationData(filteredRows);
      setSimulationMetadata(simulationMetadata);
      
      // Merge scenarioConfig for event markers; preserve existing simConfig (has_data for all sims)
      setSimConfig(prev => {
        const sims = prev?.simulations ? { ...prev.simulations } : {};
        const existing = sims[simulationId] || {};
        sims[simulationId] = {
          ...existing,
          display_name: scenarioConfig.display_name ?? existing.display_name,
          description: scenarioConfig.description ?? existing.description,
          has_data: true, // we just loaded it
          event_markers: scenarioConfig.event_markers
        };
        return { simulations: sims };
      });
      
      const chartsToDisplay = scenarioConfig.charts_to_display || [];
      setChartStacks(scenarioConfig.chart_stacks || []);
      setGlobalSampleStep(scenarioConfig.chart_sample_default ?? 1);
      if (scenarioConfig.chart_panel_height != null && scenarioConfig.chart_panel_height >= 200 && scenarioConfig.chart_panel_height <= 800) {
        setChartPanelHeight(scenarioConfig.chart_panel_height);
      }
      const initialPerChart = {};
      if (chartsToDisplay.length > 0) {
        const newCharts = chartsToDisplay.map((chartDef, index) => {
          const chartId = `sim-chart-${Date.now()}-${index}`;
          if (chartDef.sample_step != null) initialPerChart[chartId] = chartDef.sample_step;
          if (chartDef.type === 'multi') {
            return {
              id: chartId,
              type: 'multi-component',
              chartType: chartDef.chart_type || 'multi-bar-chart',
              title: chartDef.title || 'Multi-Component Chart',
              csvName: csvNameForCharts,
              timeColumn: chartDef.x_column,
              components: chartDef.components || [],
              isMultiComponent: true
            };
          }
          const component = canvasComponents.find(c => c.id === chartDef.component_id);
          if (!component) return null;
          const isNd = chartDef.chart_type === 'nd' && chartDef.y_columns?.length;
          const isStackedNd = chartDef.chart_type === 'stacked-nd' && chartDef.y_columns?.length;
          return {
            id: chartId,
            componentId: component.id,
            componentName: component.name,
            chartType: chartDef.chart_type || '2d',
            csvName: csvNameForCharts,
            xColumn: chartDef.x_column,
            ...(isNd ? { yColumns: chartDef.y_columns } : isStackedNd ? {} : { yColumn: chartDef.y_column }),
            ...(isStackedNd ? {
              yColumns: chartDef.y_columns,
              splitBy: chartDef.split_by || 'phase',
              ...(chartDef.split_by === 'manual' && chartDef.manual_group_breaks?.length && { manualGroupBreaks: chartDef.manual_group_breaks })
            } : {}),
            title: chartDef.title || (isNd ? `${component.name} - nD` : isStackedNd ? `${component.name} - Stacked nD` : `${component.name} - ${chartDef.y_column}`)
          };
        }).filter(Boolean);
        setOpenCharts(newCharts);
        setPerChartSampleStep(initialPerChart);
      } else {
        setChartStacks([]);
        setPerChartSampleStep({});
      }
      
      // alert(`✅ Simulation loaded!\n\n${simulationMetadata.displayName}\n${simulationMetadata.rowCount} rows, ${simulationMetadata.timeRange.min}s–${simulationMetadata.timeRange.max}s`);
    } catch (error) {
      console.error('❌ Error loading simulation:', error);
      alert(`❌ Failed to load simulation:\n\n${error.message}`);
    }
  };

  /**
   * Refresh simulations list from backend (after add or upload)
   */
  const refreshSimulationsList = async () => {
    if (!currentConfigName) return;
    try {
      const listRes = await fetch(`${API_BASE_URL}/api/designs/${encodeURIComponent(currentConfigName)}/simulations`);
      if (listRes.ok) {
        const list = await listRes.json();
        const sims = list.simulations || [];
        setAvailableSimulations(sims.map(s => s.id));
        const simMap = {};
        sims.forEach(s => { simMap[s.id] = { display_name: s.display_name, description: s.description || '', has_data: !!s.has_data }; });
        setSimConfig(sims.length > 0 ? { simulations: simMap } : null);
      }
    } catch (e) {
      console.error('Failed to refresh simulations:', e);
    }
  };

  /**
   * Add a new simulation scenario (creates .sim.json, then user can upload CSV)
   */
  const handleAddSimulation = async (simName) => {
    if (!currentConfigName || !simName?.trim()) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/designs/${encodeURIComponent(currentConfigName)}/simulations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: simName.trim() })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || response.statusText || `HTTP ${response.status}`);
      }
      const result = await response.json();
      await refreshSimulationsList();
      // Activate the new scenario so it's highlighted; upload button next to it targets this sim
      const newSimId = result.sim_name;
      const displayName = (result.sim_name || '').replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      setSimulationMetadata({
        id: newSimId,
        displayName: displayName || newSimId,
        description: '',
        rowCount: 0,
        columns: [],
        timeRange: { min: 0, max: 0 }
      });
      setSimulationData([]);
      setOpenCharts([]);
    } catch (e) {
      alert(`❌ Failed to add simulation: ${e.message}`);
    }
  };

  /**
   * Upload CSV data for a simulation (design dir flow only)
   */
  const handleUploadSimData = async (simId, file) => {
    if (!currentConfigName || !file) return;
    setIsUploading(true);
    const uploadStartTime = Date.now();
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(
        `http://localhost:5000/api/designs/${encodeURIComponent(currentConfigName)}/simulations/${encodeURIComponent(simId)}/data`,
        { method: 'POST', body: formData }
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || response.statusText || `HTTP ${response.status}`);
      }
      const result = await response.json();
      await refreshSimulationsList();
      // Minimum 2 seconds spinner display
      const elapsed = Date.now() - uploadStartTime;
      const remainingTime = Math.max(0, 2000 - elapsed);
      await new Promise((resolve) => setTimeout(resolve, remainingTime));
      // Virtually "run" the simulation so user can create charts without clicking the button
      await handleRunSimulation(simId);
    } catch (e) {
      alert(`❌ Upload failed: ${e.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Add simulation scenarios from an xlsx file. Each sheet becomes a simulation:
   * - Sheet name → button name and {SheetName}.data.csv
   * - Sheet data → CSV content saved to design dir (handled by backend)
   */
  const handleAddSimulationsFromXlsx = async (file) => {
    if (!currentConfigName || !file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(
        `${API_BASE_URL}/api/designs/${encodeURIComponent(currentConfigName)}/simulations/from-xlsx`,
        { method: 'POST', body: formData }
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || response.statusText || `HTTP ${response.status}`);
      }
      const result = await response.json();
      await refreshSimulationsList();
      const count = result.created?.length ?? 0;
      alert(`✅ Created ${count} simulation scenario(s) from xlsx.`);
    } catch (e) {
      alert(`❌ Failed to load xlsx: ${e.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Delete a simulation (removes .sim.json and .data.csv)
   */
  const handleDeleteSimulation = async (simId) => {
    if (!currentConfigName || !simId) return;
    if (!window.confirm(`Delete simulation "${simId}" and its data? This cannot be undone.`)) return;
    try {
      const response = await fetch(
        `http://localhost:5000/api/designs/${encodeURIComponent(currentConfigName)}/simulations/${encodeURIComponent(simId)}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || response.statusText || `HTTP ${response.status}`);
      }
      await refreshSimulationsList();
      if (simulationMetadata?.id === simId) {
        setSimulationMetadata(null);
        setSimulationData([]);
        setOpenCharts([]);
      }
    } catch (e) {
      alert(`❌ Delete failed: ${e.message}`);
    }
  };

  /**
   * View simulation data (first 200 rows in popup)
   */
  const handleViewSimData = async (simId) => {
    if (!currentConfigName || !simId) return;
    const displayName = simConfig?.simulations?.[simId]?.display_name || simId;
    setViewModal({ simName: simId, displayName, data: null, loading: true });
    try {
      const response = await fetch(
        `http://localhost:5000/api/designs/${encodeURIComponent(currentConfigName)}/simulations/${encodeURIComponent(simId)}`
      );
      if (!response.ok) throw new Error('Failed to load simulation data');
      const result = await response.json();
      setViewModal({ simName: simId, displayName, data: result.data || [], loading: false });
    } catch (e) {
      setViewModal(null);
      alert(`❌ Failed to load data: ${e.message}`);
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

      // Persist current simulation's charts + sample rates to .sim.json
      if (simulationMetadata?.id && openCharts.length >= 0) {
        persistChartsToSimJson(openCharts);
      }
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
   * STEP 3: Persist chart config to .sim.json
   *
   * When the user adds or removes charts, we save the updated list to the current
   * simulation's .sim.json so it survives a reload. We only persist when we have
   * an active simulation from a design dir (simulationMetadata.id + currentConfigName).
   * The conversion maps our openCharts format (componentId, xColumn, etc.) to the
   * backend format (component_id, x_column, etc.) used in charts_to_display.
   */
  const persistChartsToSimJson = useCallback(async (charts, overrides = {}) => {
    if (!simulationMetadata?.id || !currentConfigName) return;
    const effectiveGlobal = overrides.chart_sample_default ?? globalSampleStep;
    const effectivePerChart = overrides.perChartSampleStep ?? perChartSampleStep;
    const effectiveHeight = overrides.chart_panel_height ?? chartPanelHeight;
    const effectiveStacks = overrides.chart_stacks ?? chartStacks;
    try {
      const charts_to_display = charts.map(c => {
        let base;
        if (c.isMultiComponent) {
          base = {
            type: 'multi',
            chart_type: c.chartType,
            x_column: c.timeColumn,
            components: c.components || [],
            title: c.title || ''
          };
        } else if (c.chartType === 'nd' && c.yColumns?.length) {
          base = {
            type: 'single',
            component_id: c.componentId,
            chart_type: 'nd',
            x_column: c.xColumn,
            y_columns: c.yColumns,
            title: c.title || `${c.componentName || ''} - nD`
          };
        } else if (c.chartType === 'stacked-nd' && c.yColumns?.length) {
          base = {
            type: 'single',
            component_id: c.componentId,
            chart_type: 'stacked-nd',
            x_column: c.xColumn,
            y_columns: c.yColumns,
            split_by: c.splitBy || 'phase',
            ...(c.splitBy === 'manual' && c.manualGroupBreaks?.length && { manual_group_breaks: c.manualGroupBreaks }),
            title: c.title || `${c.componentName || ''} - Stacked nD`
          };
        } else {
          base = {
            type: 'single',
            component_id: c.componentId,
            chart_type: c.chartType || '2d',
            x_column: c.xColumn,
            y_column: c.yColumn,
            title: c.title || `${c.componentName || ''} - ${c.yColumn || 'chart'}`
          };
        }
        if (effectivePerChart[c.id] != null) base.sample_step = effectivePerChart[c.id];
        return base;
      });
      const body = { charts_to_display, chart_stacks: effectiveStacks, chart_sample_default: effectiveGlobal, chart_panel_height: effectiveHeight };
      const res = await fetch(
        `${API_BASE_URL}/api/designs/${encodeURIComponent(currentConfigName)}/simulations/${encodeURIComponent(simulationMetadata.id)}/config`,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      );
      if (!res.ok) console.warn('Failed to persist charts:', await res.text());
    } catch (e) {
      console.warn('persistChartsToSimJson error:', e);
    }
  }, [simulationMetadata?.id, currentConfigName, globalSampleStep, perChartSampleStep, chartPanelHeight, chartStacks]);

  const persistChartPanelHeightRef = useRef(null);
  const handleChartPanelHeightChange = useCallback((newHeight) => {
    setChartPanelHeight(newHeight);
    if (persistChartPanelHeightRef.current) clearTimeout(persistChartPanelHeightRef.current);
    persistChartPanelHeightRef.current = setTimeout(() => {
      if (simulationMetadata?.id && openCharts.length >= 0) {
        persistChartsToSimJson(openCharts, { chart_panel_height: newHeight });
      }
      persistChartPanelHeightRef.current = null;
    }, 400);
  }, [simulationMetadata?.id, openCharts, persistChartsToSimJson]);

  /**
   * STEP 1 + STEP 4: Gate and column picker flow
   *
   * When the user right-clicks a component and chooses "Associate Chart", we first check
   * whether a simulation is loaded. If not, we show an instructive message. If yes,
   * we open the column picker dialog (Step 4) so the user can pick X and Y columns from
   * the current simulation's CSV. On confirm, we add the chart and persist to .sim.json.
   */
  const handleAssociateChart = (component, chartType) => {
    const inSimulation = simulationMetadata != null && simulationData && simulationData.length > 0;
    if (!inSimulation) {
      alert('Run a simulation first to add or modify charts.\n\nClick a scenario button in the Simulation Controls panel.');
      return;
    }
    setColumnPickerContext({ component, chartType });
  };

  /**
   * STEP 4: Callback when user confirms column selection in the column picker dialog.
   * We create the chart object, add it to openCharts, persist to .sim.json, and close the dialog.
   */
  const handleColumnPickerConfirm = ({ xColumn, yColumn, title }) => {
    if (!columnPickerContext) return;
    const { component, chartType } = columnPickerContext;
    const csvName = simulationMetadata?.id ? `${simulationMetadata.id}.data.csv` : '';
    const openChart = {
      id: `open-${Date.now()}`,
      componentId: component.id,
      componentName: component.name,
      chartType,
      csvName,
      xColumn,
      yColumn,
      title: title || `${component.name} - ${yColumn}`
    };
    setOpenCharts(prev => {
      const next = [...prev, openChart];
      persistChartsToSimJson(next);
      return next;
    });
    setColumnPickerContext(null);
  };

  /**
   * Handle opening a chart in the bottom panel (from a component's predefined charts).
   * After adding, we persist to .sim.json so the chart list is saved.
   */
  const handleOpenChart = (component, chart) => {
    console.log('📊 Opening chart:', chart.chartType, 'for', component.name);
    
    const isAlreadyOpen = openCharts.some(c => 
      c.componentId === component.id && c.chartId === chart.id
    );
    if (isAlreadyOpen) {
      console.log('⚠️  Chart already open');
      return;
    }
    
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
    
    setOpenCharts(prev => {
      const next = [...prev, openChart];
      persistChartsToSimJson(next);
      return next;
    });
  };

  /**
   * Handle creating a multi-component chart (animated bar chart, etc.).
   * After adding the chart to state, we persist the full chart list to .sim.json
   * so the new chart survives a reload.
   */
  const handleCreateMultiComponentChart = (chartConfig) => {
    console.log('📊 Creating multi-component chart:', chartConfig);
    
    const multiChart = {
      id: `multi-${Date.now()}`,
      type: 'multi-component',
      chartType: chartConfig.type,
      title: chartConfig.title,
      csvName: chartConfig.csvFile,
      timeColumn: chartConfig.timeColumn,
      components: chartConfig.components || [],
      isMultiComponent: true
    };
    
    setOpenCharts(prev => {
      const next = [...prev, multiChart];
      persistChartsToSimJson(next);
      return next;
    });
  };

  /**
   * Add chart from SimulationChartBuilder (Property Panel when sim loaded).
   * Receives { chartType, selections } - maps to xColumn/yColumn based on chart type.
   */
  const handleAddChartFromBuilder = ({ chartType, selections, splitBy, manualGroupBreaks }) => {
    if (!simulationMetadata || !selections?.length) return;
    const cols = simulationMetadata.columns || [];
    const csvName = `${simulationMetadata.id}.data.csv`;
    const comp = canvasComponents[0];
    const componentId = comp?.id || 'sim-data';
    const componentName = comp?.name || simulationMetadata.displayName || 'Simulation';

    let xColumn, yColumn, yColumns, title;
    if (chartType === 'nd') {
      xColumn = selections[0];
      yColumns = selections.slice(1);
      title = `${componentName} - nD`;
    } else if (chartType === 'stacked-nd') {
      xColumn = selections[0];
      yColumns = selections.slice(1);
      title = `${componentName} - Stacked nD`;
    } else if (chartType === '2d' || chartType === 'bar') {
      xColumn = selections[0];
      yColumn = selections[1];
      title = `${componentName} - ${yColumn}`;
    } else {
      xColumn = cols[0] || selections[0];
      yColumn = selections[0];
      title = `${componentName} - ${selections[0]}`;
    }

    const openChart = {
      id: `open-${Date.now()}`,
      componentId,
      componentName,
      chartType,
      csvName,
      xColumn,
      ...(yColumn != null && { yColumn }),
      ...(yColumns != null && { yColumns }),
      ...(chartType === 'stacked-nd' && splitBy && { splitBy }),
      ...(chartType === 'stacked-nd' && splitBy === 'manual' && manualGroupBreaks?.length && { manualGroupBreaks }),
      title
    };
    setOpenCharts(prev => {
      const next = [...prev, openChart];
      persistChartsToSimJson(next);
      return next;
    });
  };

  /** Reindex chartStacks when a chart at removedIdx is removed */
  const reindexChartStacksAfterRemove = (stacks, removedIdx) => {
    return stacks
      .map(stack => stack
        .filter(i => i !== removedIdx)
        .map(i => i > removedIdx ? i - 1 : i)
      )
      .filter(stack => stack.length >= 2);
  };

  /**
   * Handle removing a chart from the bottom panel.
   * We compute the next chart list, update state, and persist to .sim.json so the
   * removal is saved and will persist across reloads.
   */
  const handleRemoveChart = (openChartId) => {
    console.log('🗑️  Removing chart:', openChartId);
    const removedIdx = openCharts.findIndex(c => c.id === openChartId);
    const nextCharts = openCharts.filter(c => c.id !== openChartId);
    const nextStacks = removedIdx >= 0 ? reindexChartStacksAfterRemove(chartStacks, removedIdx) : chartStacks;
    setOpenCharts(nextCharts);
    setChartStacks(nextStacks);
    setPerChartSampleStep(prev => {
      const next = { ...prev };
      delete next[openChartId];
      return next;
    });
    persistChartsToSimJson(nextCharts, { chart_stacks: nextStacks });
  };

  /**
   * Handle closing the entire chart panel.
   * We clear charts and persist the empty list to .sim.json so reopening the design
   * will start with no charts.
   */
  const handleCloseChartPanel = () => {
    console.log('❌ Closing chart panel');
    setOpenCharts([]);
    setChartStacks([]);
    setPerChartSampleStep({});
    persistChartsToSimJson([], { chart_stacks: [] });
  };

  const handleStackCharts = (selectedChartIds) => {
    if (!selectedChartIds || selectedChartIds.size < 2) return;
    const indices = openCharts
      .map((c, i) => (selectedChartIds.has(c.id) ? i : -1))
      .filter(i => i >= 0)
      .sort((a, b) => a - b);
    if (indices.length < 2) return;
    const selectedSet = new Set(indices);
    const nextStacks = chartStacks
      .map(stack => stack.filter(i => !selectedSet.has(i)))
      .filter(stack => stack.length >= 2);
    nextStacks.push(indices);
    setChartStacks(nextStacks);
    persistChartsToSimJson(openCharts, { chart_stacks: nextStacks });
  };

  const handleUnstackCharts = (selectedChartIds) => {
    if (!selectedChartIds || selectedChartIds.size === 0) return;
    const selectedIndices = new Set(
      openCharts.map((c, i) => (selectedChartIds.has(c.id) ? i : -1)).filter(i => i >= 0)
    );
    const nextStacks = chartStacks
      .map(stack => stack.filter(i => !selectedIndices.has(i)))
      .filter(stack => stack.length >= 2);
    setChartStacks(nextStacks);
    persistChartsToSimJson(openCharts, { chart_stacks: nextStacks });
  };

  /**
   * Handle Load - Apply loaded configuration to the app
   */
  const handleConfigurationLoaded = (loadedConfig) => {
    console.log('✅ Loading configuration:', loadedConfig.name);
    console.log('🔍 Full loadedConfig:', loadedConfig); // DEBUG: See entire response
    console.log('🔍 csv_status:', loadedConfig.csv_status); // DEBUG: Check csv_status
    console.log('🔍 sim_config:', loadedConfig.sim_config); // DEBUG: Check sim_config
    
    // Save the configuration name for future quick saves
    setCurrentConfigName(loadedConfig.name);
    
    // Store CSV status and fetch available simulations
    if (loadedConfig.csv_status) {
      setCsvStatus(loadedConfig.csv_status);
      const sims = loadedConfig.csv_status.available_simulations || [];
      setAvailableSimulations(sims.map(s => s.id));
      const simMap = {};
      sims.forEach(s => { simMap[s.id] = { display_name: s.display_name, description: s.description || '', has_data: !!s.has_data }; });
      setSimConfig(sims.length > 0 ? { simulations: simMap } : null);
    } else {
      console.warn('⚠️ csv_status is missing from backend response!');
      setAvailableSimulations([]);
      setSimConfig(null);
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
    
    // Never restore charts on load: design only. Charts appear when user clicks a simulation.
    setOpenCharts([]);
    setDesignViewMode('canvas');
    
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

    // Persist current simulation's charts + sample rates to .sim.json
    if (simulationMetadata?.id) {
      persistChartsToSimJson(openCharts);
    }
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
                csvStatus.use_design_dir ? (
                  <div className="design-view-tri-state" role="group" aria-label="Design view mode">
                    {[
                      { id: 'canvas', icon: '◉', label: 'Interactive' },
                      { id: 'image', icon: '▣', label: 'Diagram' },
                      { id: 'split', icon: '⊞', label: 'Split' }
                    ].map(({ id, icon, label }) => (
                      <button
                        key={id}
                        type="button"
                        className={`tri-state-btn ${designViewMode === id ? 'active' : ''}`}
                        onClick={() => setDesignViewMode(id)}
                        title={label}
                      >
                        <span className="tri-state-icon">{icon}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className={`csv-status ${csvStatus.exists ? 'csv-loaded' : 'csv-missing'}`}>
                    {csvStatus.exists ? '✅ Data loaded' : '⚠️ No CSV data'}
                  </span>
                )
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

        <div
          className={`panel-focus-wrapper design-view-wrapper ${designImageUrl ? `mode-${designViewMode}` : ''}`}
          style={{ position: 'relative', zIndex: focusedPanel === 'canvas' ? 1100 : 10 }}
          onMouseDown={(e) => handlePanelFocus('canvas', e)}
        >
          {designImageUrl && (designViewMode === 'image' || designViewMode === 'split') && (
            <div className="design-view-image-panel">
              <img src={designImageUrl} alt={`${currentConfigName} design diagram`} />
            </div>
          )}
          {(designViewMode === 'canvas' || designViewMode === 'split') && (
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
              onUpdateComponent={handleUpdateComponent}
              onAssociateChart={handleAssociateChart}
              onOpenChart={handleOpenChart}
              onCreateMultiComponentChart={handleCreateMultiComponentChart}
              canAddCharts={simulationMetadata != null && simulationData && simulationData.length > 0}
              simulationColumns={simulationMetadata?.columns || []}
              simulationCsvName={simulationMetadata?.id ? `${simulationMetadata.id}.data.csv` : ''}
              zoom={zoom}
              pan={pan}
              onPan={setPan}
              mode={mode}
              viewMode={viewMode}
              simulationRunning={simulationRunning}
              systemState={systemState}
            />
          )}
        </div>

        <div
          className="panel-focus-wrapper"
          style={{ position: 'relative', zIndex: focusedPanel === 'property' ? 1100 : 10 }}
          onMouseDown={(e) => handlePanelFocus('property', e)}
        >
          <PropertyPanel
            selectedComponent={selectedComponent}
            selectedConnection={selectedConnection}
            simulationMetadata={simulationMetadata}
            simulationColumns={simulationMetadata?.columns || []}
            canvasComponents={canvasComponents}
            onUpdateComponent={handleUpdateComponent}
            onDeleteComponent={handleDeleteComponent}
            onDeleteConnection={handleDeleteConnection}
            onAddChartFromBuilder={handleAddChartFromBuilder}
            onClose={() => {
              setSelectedComponent(null);
              setSelectedConnection(null);
            }}
            disabled={mode === 'simulation'}
          />
        </div>

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
            When you click a simulation scenario (e.g. "Low-Voltage Ride-Through"), that scenario’s data and config are loaded. 
            To show clearly which scenario is active, the matching button in the Simulation Controls panel gets a bright “active” style (brighter gradient, glow). 
            The activeSimulationId prop is the ID of the loaded simulation and is passed from App to SimulationControls so the correct button can be styled.

        ================================================================ */}
        {/* STEP 2: Pass which simulation  (simulationMetadata?.id ) is currently loaded so the Controls panel can highlight that button.
            When the user clicks a scenario (e.g. "Low-Voltage Ride-Through"), simulationMetadata is set with its id.
            Passing activeSimulationId lets SimulationControls show a bright, glowing style on the active button
            so the user always knows which simulation they're viewing and editing charts for. */}
        <div
          className="panel-focus-wrapper"
          style={{ position: 'relative', zIndex: focusedPanel === 'simulation' ? 1100 : 10 }}
          onMouseDown={(e) => handlePanelFocus('simulation', e)}
        >
          <SimulationControls
            mode={mode}
            viewMode={viewMode}
            simulationRunning={simulationRunning}
            activeSimulationId={simulationMetadata?.id ?? null}
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
            useDesignDir={!!csvStatus?.use_design_dir}
            currentConfigName={currentConfigName}
            onUploadSimData={handleUploadSimData}
            onDeleteSimulation={handleDeleteSimulation}
            onViewSimData={handleViewSimData}
            onAddSimulation={handleAddSimulation}
            onAddSimulationsFromXlsx={handleAddSimulationsFromXlsx}
          />
        </div>
      </div>

      {/* Save/Load Dialog */}
      {showDialog && (
        <SaveLoadDialog
          mode={dialogMode}
          onClose={handleCloseDialog}
          onSave={handleConfigurationSaved}
          onLoad={handleConfigurationLoaded}
          currentConfiguration={getCurrentConfiguration()}
          currentConfigName={currentConfigName}
        />
      )}

      {/* STEP 4: Column picker – when user picks a chart type, choose X/Y from simulation CSV */}
      {columnPickerContext && (
        <ColumnPickerDialog
          key={`${columnPickerContext.component?.id}-${columnPickerContext.chartType}`}
          component={columnPickerContext.component}
          chartType={columnPickerContext.chartType}
          columns={simulationMetadata?.columns || []}
          csvName={simulationMetadata?.id ? `${simulationMetadata.id}.data.csv` : ''}
          onConfirm={handleColumnPickerConfirm}
          onClose={() => setColumnPickerContext(null)}
        />
      )}

      {/* Chart Panel */}
      {openCharts.length > 0 && (
        <ChartPanel
          charts={openCharts}
          chartStacks={chartStacks}
          onStackCharts={handleStackCharts}
          onUnstackCharts={handleUnstackCharts}
          onClose={handleCloseChartPanel}
          onRemoveChart={handleRemoveChart}
          height={chartPanelHeight}
          onHeightChange={handleChartPanelHeightChange}
          simulationTime={simulationTime}
          simulationRunning={simulationRunning}
          selectedComponentId={selectedComponent?.id}
          simulationData={simulationData}
          simulationMetadata={simulationMetadata}
          eventMarkers={simConfig?.simulations?.[simulationMetadata?.id]?.event_markers}
          globalSampleStep={globalSampleStep}
          perChartSampleStep={perChartSampleStep}
          onGlobalSampleStepChange={(step) => {
            setGlobalSampleStep(step);
            if (simulationMetadata?.id && openCharts.length > 0) {
              persistChartsToSimJson(openCharts, { chart_sample_default: step });
            }
          }}
          onPerChartSampleStepChange={(chartId, step) => {
            setPerChartSampleStep(prev => {
              const next = { ...prev, [chartId]: step };
              if (simulationMetadata?.id && openCharts.length > 0) {
                persistChartsToSimJson(openCharts, { perChartSampleStep: next });
              }
              return next;
            });
          }}
          currentConfigName={currentConfigName}
          selectedRowIndices={selectedRowIndices}
          onSelectionChange={setSelectedRowIndices}
          onFocus={(e) => handlePanelFocus('charts', e)}
          isFocused={focusedPanel === 'charts'}
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

      {/* Upload Spinner Overlay */}
      {isUploading && (
        <div className="saving-overlay">
          <div className="saving-spinner-container">
            <div className="saving-spinner"></div>
            <div className="saving-text">Uploading...</div>
            <div className="saving-subtext">Please wait</div>
          </div>
        </div>
      )}

      {/* View Data Modal */}
      {viewModal && (
        <ViewDataModal
          simName={viewModal.simName}
          displayName={viewModal.displayName}
          data={viewModal.data}
          loading={viewModal.loading}
          onClose={() => setViewModal(null)}
        />
      )}
    </div>
  );
}

export default App;
