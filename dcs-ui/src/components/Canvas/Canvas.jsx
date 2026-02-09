import React, { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import ChartContextMenu from '../ChartContextMenu/ChartContextMenu';
import MultiComponentContextMenu from '../MultiComponentContextMenu/MultiComponentContextMenu';
import MultiComponentChartDialog from '../MultiComponentChartDialog/MultiComponentChartDialog';
import KeyboardShortcuts from './KeyboardShortcuts';
import { getComponentVisualConfig, getComponentDimensions } from '../../data/componentVisuals';
import './Canvas.css';

const Canvas = forwardRef(({
  components,
  connections,
  selectedComponent,
  selectedConnection,
  onSelectComponent,
  onSelectConnection,
  selectedComponents,
  onMultiSelect,
  onClearMultiSelection,
  isComponentMultiSelected,
  onMoveComponent,
  onAddComponent,
  onAddConnection,
  onAssociateChart,
  onOpenChart,
  onCreateMultiComponentChart,
  zoom,
  pan,
  onPan,
  mode,
  viewMode,
  simulationRunning,
  systemState
}, ref) => {
  const canvasRef = useRef(null);
  const [draggingComponent, setDraggingComponent] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [connecting, setConnecting] = useState(null);
  const [connectingTo, setConnectingTo] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { component, position }
  const [showMultiChartDialog, setShowMultiChartDialog] = useState(false);
  const [multiChartComponents, setMultiChartComponents] = useState([]);

  // ========================================================================
  // HELPER FUNCTION: snapToGrid
  // ========================================================================
  // Snaps a position (x, y) to the nearest grid point.
  // 
  // OUR GRID: 50x50 pixels (you can see the dots every 50 pixels)
  // 
  // HOW IT WORKS:
  // 1. Divide the position by grid size (50)
  // 2. Round to nearest integer (snaps to nearest grid line)
  // 3. Multiply back by grid size
  // 
  // EXAMPLE:
  // Position 127 → 127/50 = 2.54 → round to 3 → 3*50 = 150 (snapped!)
  // Position 23 → 23/50 = 0.46 → round to 0 → 0*50 = 0 (snapped!)
  // 
  // RESULT: Components align perfectly with grid dots!
  // ========================================================================
  const snapToGrid = (x, y) => {
    const gridSize = 50;  // Must match the grid pattern in CSS (50x50)
    return {
      x: Math.round(x / gridSize) * gridSize,
      y: Math.round(y / gridSize) * gridSize
    };
  };

  // Handle drop of new component from library
  const handleDrop = (e) => {
    e.preventDefault();
    const componentData = e.dataTransfer.getData('component');
    if (!componentData) return;

    const component = JSON.parse(componentData);
    const rect = canvasRef.current.getBoundingClientRect();
    
    // Calculate raw position
    const rawX = (e.clientX - rect.left - pan.x) / zoom;
    const rawY = (e.clientY - rect.top - pan.y) / zoom;
    
    // Snap to grid for perfect alignment
    const snapped = snapToGrid(rawX, rawY);
    
    console.log('📍 Drop position: raw(', rawX.toFixed(1), ',', rawY.toFixed(1), ') → snapped(', snapped.x, ',', snapped.y, ')');

    onAddComponent(component, snapped);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  // ========================================================================
  // FUNCTION: handleComponentMouseDown
  // ========================================================================
  // This handles when you click on a component on the canvas.
  // 
  // DIFFERENT BEHAVIORS BASED ON MODE:
  // • Design Mode: Can drag to move, Shift+Click to connect
  // • Simulation Mode: Can ONLY click to select (no dragging, no connecting)
  //
  // WHY: In simulation mode, we want to select components to see their
  // properties and trigger actions (like "Trip Turbine"), but we don't
  // want to allow moving them around or creating new connections.
  // ========================================================================
  const handleComponentMouseDown = (e, component) => {
    e.stopPropagation();
    
    // CRITICAL: Ignore right-click (button 2) - let contextmenu handler deal with it
    if (e.button === 2) {
      return;
    }
    
    // If context menu is open, ignore all mouse events
    if (contextMenu) {
      return;
    }
    
    // IN SIMULATION MODE: Only allow selection, nothing else
    if (mode === 'simulation') {
      console.log('🖱️ Clicked in simulation mode:', component.name);
      onSelectComponent(component);  // Allow selecting
      return;  // But block dragging and connecting
    }
    
    // IN DESIGN MODE: Allow everything (drag, connect, select, multi-select)
    
    // Shift + click = Multi-select
    if (e.shiftKey) {
      e.preventDefault(); // Prevent browser text selection
      console.log('🖱️ Shift+Click - Multi-selecting:', component.name);
      onMultiSelect(component.id, true);
      return;
    }
    
    // Ctrl/Cmd + click = Start connection
    if (e.ctrlKey || e.metaKey) {
      console.log('🔗 Ctrl+Click - Starting connection from:', component.name);
      setConnecting(component.id);
      return;
    }

    // Regular click = Start dragging and select (clears multi-selection)
    onMultiSelect(component.id, false); // Clear multi-selection
    setDraggingComponent(component.id);
    const rect = canvasRef.current.getBoundingClientRect();
    setDragOffset({
      x: (e.clientX - rect.left - pan.x) / zoom - component.position.x,
      y: (e.clientY - rect.top - pan.y) / zoom - component.position.y
    });
    onSelectComponent(component);
  };

  /**
   * Handle right-click on component to show chart association menu
   */
  const handleComponentContextMenu = (e, component) => {
    e.preventDefault();
    e.stopPropagation();
    
    // CRITICAL: Clear any dragging state when context menu opens
    setDraggingComponent(null);
    setConnecting(null);
    setConnectingTo(null);
    
    // Debug logging
    console.log('📋 Context Menu Debug:', {
      componentId: component.id,
      componentName: component.name,
      selectedComponentsLength: selectedComponents.length,
      selectedComponents: selectedComponents,
      isInSelection: isComponentMultiSelected(component.id)
    });
    
    // Check if this is a multi-selection scenario
    const isMultiSelect = selectedComponents.length > 1 && isComponentMultiSelected(component.id);
    
    console.log('🎯 isMultiSelect:', isMultiSelect);
    
    if (isMultiSelect) {
      // Multi-component context menu
      console.log('🖱️ Right-click on multi-selection:', selectedComponents.length, 'components');
      setContextMenu({
        type: 'multi-component',
        components: selectedComponents.map(id => components.find(c => c.id === id)).filter(Boolean),
        position: { x: e.clientX, y: e.clientY }
      });
    } else {
      // Single component context menu (existing behavior)
      console.log('🖱️ Right-click on component:', component.name);
      setContextMenu({
        type: 'single-component',
        component,
        position: { x: e.clientX, y: e.clientY }
      });
    }
  };

  /**
   * Handle chart type selection from context menu (single component)
   */
  const handleChartTypeSelected = (chartType) => {
    if (contextMenu && contextMenu.component) {
      console.log('📊 Selected chart type:', chartType, 'for', contextMenu.component.name);
      
      // Call parent handler to open CSV picker
      if (onAssociateChart) {
        onAssociateChart(contextMenu.component, chartType);
      }
    }
    setContextMenu(null);
  };

  /**
   * Handle chart type selection from multi-component context menu
   */
  const handleMultiComponentChartTypeSelected = (chartType) => {
    if (contextMenu && contextMenu.components) {
      console.log('📊 Multi-component chart selected:', chartType, 'for', contextMenu.components.length, 'components');
      console.log('Selected components:', contextMenu.components.map(c => c.name).join(', '));
      
      // Open the multi-component chart dialog
      if (chartType === 'animated-bar-chart') {
        setMultiChartComponents(contextMenu.components);
        setShowMultiChartDialog(true);
      } else {
        // Other chart types not yet implemented
        console.log('⚠️ Chart type not yet implemented:', chartType);
      }
    }
    setContextMenu(null);
  };

  /**
   * Handle multi-component chart creation from dialog
   */
  const handleCreateMultiChart = (chartConfig) => {
    console.log('✅ Multi-component chart created:', chartConfig);
    
    // TODO: In Step 9, we'll pass this to App.js to create the actual Plotly chart
    // For now, just log it
    if (onCreateMultiComponentChart) {
      onCreateMultiComponentChart(chartConfig);
    }
  };

  const handleCanvasMouseDown = (e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle mouse or Alt+Left mouse for panning
      setPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    } else if (e.button === 0 && !draggingComponent) {
      // Left click on empty canvas deselects
      onSelectComponent(null);
      onSelectConnection(null);
      onClearMultiSelection(); // Clear multi-selection
    }
  };

  const handleCanvasMouseMove = (e) => {
    // If context menu is open, block all mouse move behavior
    if (contextMenu) {
      return;
    }
    
    if (draggingComponent) {
      const rect = canvasRef.current.getBoundingClientRect();
      
      // Calculate raw position
      const rawX = (e.clientX - rect.left - pan.x) / zoom - dragOffset.x;
      const rawY = (e.clientY - rect.top - pan.y) / zoom - dragOffset.y;
      
      // Snap to grid for perfect alignment
      const snapped = snapToGrid(rawX, rawY);
      
      onMoveComponent(draggingComponent, snapped);
    } else if (panning) {
      onPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    } else if (connecting) {
      // Update connecting line
      const rect = canvasRef.current.getBoundingClientRect();
      setConnectingTo({
        x: (e.clientX - rect.left - pan.x) / zoom,
        y: (e.clientY - rect.top - pan.y) / zoom
      });
    }
  };

  const handleCanvasMouseUp = (e) => {
    if (draggingComponent) {
      setDraggingComponent(null);
    }
    if (panning) {
      setPanning(false);
    }
  };

  const handleComponentMouseUp = (e, component) => {
    if (connecting && connecting !== component.id) {
      // Complete connection
      onAddConnection(connecting, component.id);
      setConnecting(null);
      setConnectingTo(null);
    }
  };

  const handleCanvasClick = (e) => {
    if (connecting) {
      // Cancel connection on empty canvas click
      setConnecting(null);
      setConnectingTo(null);
    }
  };

  // Listen for add component events
  useEffect(() => {
    const handleAddComponent = (e) => {
      // This would come from the parent via event
    };
    window.addEventListener('addComponentToCanvas', handleAddComponent);
    return () => window.removeEventListener('addComponentToCanvas', handleAddComponent);
  }, []);
  
  // Enhanced keyboard shortcuts for multi-selection
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      // ESC - Clear selection and close context menu
      if (e.key === 'Escape') {
        onClearMultiSelection();
        setContextMenu(null);
        console.log('⌨️  Escape - Cleared selection');
      }
      
      // Ctrl/Cmd+A - Select all components (Design mode only)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && mode === 'design') {
        e.preventDefault();
        // Select all components
        components.forEach(comp => {
          onMultiSelect(comp.id, true);
        });
        console.log('⌨️  Ctrl+A - Selected all', components.length, 'components');
      }
      
      // DELETE - Delete selected components (Design mode only)
      if (e.key === 'Delete' && mode === 'design' && selectedComponents.length > 0) {
        e.preventDefault();
        console.log('⌨️  Delete -', selectedComponents.length, 'components');
        // TODO: Implement deletion in App.js
        // For now, just log
        alert(`Delete ${selectedComponents.length} components? (Not yet implemented)`);
      }
      
      // ARROW KEYS - Move selected components (Design mode only)
      if (mode === 'design' && selectedComponents.length > 0 && !e.shiftKey) {
        const gridSize = 50;
        let dx = 0, dy = 0;
        
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          dy = -gridSize;
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          dy = gridSize;
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          dx = -gridSize;
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          dx = gridSize;
        }
        
        if (dx !== 0 || dy !== 0) {
          // Move all selected components
          selectedComponents.forEach(compId => {
            const comp = components.find(c => c.id === compId);
            if (comp) {
              onMoveComponent(compId, {
                x: comp.position.x + dx,
                y: comp.position.y + dy
              });
            }
          });
          console.log('⌨️  Arrow keys - Moved', selectedComponents.length, 'components by', dx, dy);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClearMultiSelection, selectedComponents, components, mode, onMultiSelect, onMoveComponent]);
  
  // Click outside handler for multi-component context menu
  useEffect(() => {
    if (!contextMenu || contextMenu.type !== 'multi-component') return;
    
    const handleClickOutside = (e) => {
      // If clicking outside the context menu, close it
      const menuElement = document.querySelector('.multi-component-context-menu');
      if (menuElement && !menuElement.contains(e.target)) {
        setContextMenu(null);
      }
    };
    
    // Use a small delay to avoid closing immediately on the same click that opened it
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [contextMenu]);

  return (
    <div className="canvas-container">
      <svg
        ref={canvasRef}
        className="canvas-svg"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onClick={handleCanvasClick}
      >
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {/* Grid background */}
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#2a2a2a" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="10000" height="10000" fill="url(#grid)" />

          {/* ================================================================
              RENDER CONNECTIONS (Power Flow Lines)
              ================================================================
              This draws lines between components showing electrical connections.
              
              POWER FLOW VISUALIZATION:
              The lines change appearance based on whether power is flowing:
              
              GREEN SOLID LINE:
              - The upstream component (fromComp) is operational
              - Status is 'normal' (closed breaker, online turbine, etc.)
              - Power CAN flow through this connection
              
              GREY DASHED LINE:
              - The upstream component is NOT operational
              - Status is 'offline', 'tripped', or 'open'
              - NO power flows through this connection
              
              This creates a visual "energy map" - you can see at a glance
              which parts of your system have power and which don't!
          ================================================================ */}
          {connections.map(conn => {
            // Find the two components this connection links
            const fromComp = components.find(c => c.id === conn.from);
            const toComp = components.find(c => c.id === conn.to);
            
            // If either component doesn't exist, skip this connection
            if (!fromComp || !toComp) return null;

            // Get component dimensions for proper centering
            // IMPORTANT: Use overrides if they exist, otherwise use defaults
            const fromVisual = getComponentVisualConfig(fromComp.type);
            const toVisual = getComponentVisualConfig(toComp.type);
            
            const fromWidth = fromComp.visualOverrides?.width || fromVisual.width;
            const fromHeight = fromComp.visualOverrides?.height || fromVisual.height;
            const toWidth = toComp.visualOverrides?.width || toVisual.width;
            const toHeight = toComp.visualOverrides?.height || toVisual.height;
            
            const fromCenterX = fromComp.position.x + (fromWidth / 2);
            const fromCenterY = fromComp.position.y + (fromHeight / 2);
            const toCenterX = toComp.position.x + (toWidth / 2);
            const toCenterY = toComp.position.y + (toHeight / 2);

            // Check if this connection is currently selected by the user
            const isSelected = selectedConnection?.id === conn.id;
            
            // Power flow logic
            const isEnergized = fromComp.status === 'normal' || fromComp.status === 'online';
            
            // DEBUG: Log power flow status when hovering
            const handleConnectionHover = () => {
              console.log('⚡ Connection:', 
                fromComp.name, '→', toComp.name, 
                '| Energized:', isEnergized, 
                '| From status:', fromComp.status);
            };

            return (
              <g key={conn.id}>
                <line
                  x1={fromCenterX}
                  y1={fromCenterY}
                  x2={toCenterX}
                  y2={toCenterY}
                  stroke={
                    isEnergized 
                      ? '#4caf50'
                      : '#666'
                  }
                  strokeWidth={isSelected ? 4 : 2}
                  className={`connection-line ${isEnergized ? 'energized' : 'de-energized'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectConnection(conn);
                  }}
                  onMouseEnter={handleConnectionHover}
                  style={{ cursor: 'pointer' }}
                />
                {/* Connection voltage label */}
                <text
                  x={(fromCenterX + toCenterX) / 2}
                  y={(fromCenterY + toCenterY) / 2 + 15}
                  fill="#ff9800"
                  fontSize="10"
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  {conn.voltage > 0 ? `${conn.voltage} kV` : ''}
                </text>
              </g>
            );
          })}

          {/* Temporary connection line while connecting */}
          {connecting && connectingTo && (() => {
            const fromComp = components.find(c => c.id === connecting);
            if (!fromComp) return null;
            
            const fromVisual = getComponentVisualConfig(fromComp.type);
            const fromWidth = fromComp.visualOverrides?.width || fromVisual.width;
            const fromHeight = fromComp.visualOverrides?.height || fromVisual.height;
            const fromCenterX = fromComp.position.x + (fromWidth / 2);
            const fromCenterY = fromComp.position.y + (fromHeight / 2);
            
            return (
              <line
                x1={fromCenterX}
                y1={fromCenterY}
                x2={connectingTo.x}
                y2={connectingTo.y}
                stroke="#005E60"
                strokeWidth="2"
                strokeDasharray="5,5"
                pointerEvents="none"
              />
            );
          })()}

          {/* Render components */}
          {components.map(component => {
            const isSelected = selectedComponent?.id === component.id;
            const isMultiSelected = isComponentMultiSelected(component.id);
            const isDragging = draggingComponent === component.id;
            
            // Get visual configuration for this component type
            const visualConfig = getComponentVisualConfig(component.type);
            
            // Allow per-instance overrides for width, height, and rotation
            const width = component.visualOverrides?.width || visualConfig.width;
            const height = component.visualOverrides?.height || visualConfig.height;
            const rotation = component.visualOverrides?.rotation || 0; // degrees
            
            const centerX = width / 2;
            const centerY = height / 2;

            return (
              <g
                key={component.id}
                transform={`translate(${component.position.x},${component.position.y})`}
                onMouseDown={(e) => handleComponentMouseDown(e, component)}
                onMouseUp={(e) => handleComponentMouseUp(e, component)}
                onContextMenu={(e) => handleComponentContextMenu(e, component)}
                className={`canvas-component ${isSelected ? 'selected' : ''} ${isMultiSelected ? 'multi-selected' : ''} ${isDragging ? 'dragging' : ''}`}
                style={{ cursor: mode === 'design' ? 'move' : 'pointer' }}
              >
                {/* Wrapper group for rotation */}
                <g transform={`rotate(${rotation} ${centerX} ${centerY})`}>
                {/* ========================================================
                    COMPONENT BOX - Dynamic size based on type + overrides
                ======================================================== */}
                <rect
                  width={width}
                  height={height}
                  fill="#1a1a1a"
                  stroke={
                    component.status === 'idle'
                      ? '#666'
                      : component.status === 'offline'
                      ? '#ff0000'
                      : component.status === 'tripped'
                        ? '#ff0000'
                      : component.status === 'open'
                        ? '#ff9800'
                      : isSelected 
                        ? '#005E60'
                        : '#444'
                  }
                  strokeWidth={
                    component.status === 'offline' || component.status === 'tripped'
                      ? 4
                      : component.status === 'open'
                        ? 3
                      : isSelected ? 3 : 2
                  }
                  rx="4"
                />
                
                {/* Component icon - Large, prominent */}
                <text
                  x={centerX}
                  y={height * 0.28}
                  textAnchor="middle"
                  fill={visualConfig.color}
                  fontSize="24"
                  fontWeight="400"
                  pointerEvents="none"
                  opacity="0.9"
                >
                  {visualConfig.icon}
                </text>
                
                {/* Component name */}
                <text
                  x={centerX}
                  y={height * 0.52}
                  textAnchor="middle"
                  fill="#e0e0e0"
                  fontSize="11"
                  fontWeight="600"
                  pointerEvents="none"
                >
                  {component.name}
                </text>
                
                {/* Component rating */}
                <text
                  x={centerX}
                  y={height * 0.68}
                  textAnchor="middle"
                  fill="#999"
                  fontSize="10"
                  pointerEvents="none"
                >
                  {component.properties.rating > 0 ? `${component.properties.rating} ${component.properties.unit}` : ''}
                </text>
                
                {/* Status indicator dot (top-right corner) */}
                {simulationRunning && (
                  <circle
                    cx={width - 10}
                    cy="10"
                    r="4"
                    fill={
                      component.status === 'idle'
                        ? '#666'
                      : component.status === 'offline' || 
                      component.status === 'tripped' || 
                      component.status === 'open' 
                        ? '#f44336'
                        : '#4caf50'
                    }
                  />
                )}
                
                {/* Multi-selection checkmark badge (top-right corner) */}
                {isMultiSelected && (
                  <g>
                    {/* Badge background circle */}
                    <circle
                      cx={width - 10}
                      cy="10"
                      r="8"
                      fill="#0066ff"
                      stroke="#0099ff"
                      strokeWidth="2"
                    />
                    {/* Checkmark */}
                    <text
                      x={width - 10}
                      y="14"
                      textAnchor="middle"
                      fill="white"
                      fontSize="12"
                      fontWeight="bold"
                      pointerEvents="none"
                    >
                      ✓
                    </text>
                  </g>
                )}

                {/* Chart Buttons - Show if component has associated charts */}
                {component.charts && component.charts.length > 0 && (
                  <g>
                    {component.charts.map((chart, index) => {
                      const buttonY = height - 12 - ((component.charts.length - 1 - index) * 12);
                      const chartLabels = {
                        '2d': '2D',
                        'histogram': 'Hist',
                        'pie': 'Pie',
                        'bar': 'Bar',
                        '3d': '3D',
                        'heatmap': 'Heat',
                        'box': 'Box'
                      };
                      const label = chartLabels[chart.chartType] || chart.chartType;
                      
                      return (
                        <g 
                          key={chart.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenChart) {
                              onOpenChart(component, chart);
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          {/* Chart button background */}
                          <rect
                            x="4"
                            y={buttonY}
                            width="28"
                            height="10"
                            fill="rgba(255, 152, 0, 0.2)"
                            stroke="#ff9800"
                            strokeWidth="1"
                            rx="2"
                            className="chart-button"
                          />
                          {/* Chart button label */}
                          <text
                            x="18"
                            y={buttonY + 7}
                            textAnchor="middle"
                            fill="#ff9800"
                            fontSize="7"
                            fontWeight="700"
                            pointerEvents="none"
                          >
                            {label}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                )}
                </g> {/* Close rotation wrapper */}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Canvas info overlay */}
      <div className="canvas-info">
        <div>Zoom: {(zoom * 100).toFixed(0)}%</div>
        <div>Components: {components.length}</div>
        <div>Connections: {connections.length}</div>
        {mode === 'design' && viewMode === 'designer' && (
          <div className="canvas-hint">
            💡 Drag components from library | Shift+Click to multi-select | Ctrl+Click to connect | Alt+Drag to pan
          </div>
        )}
      </div>
      
      {/* Multi-selection counter overlay */}
      {selectedComponents.length > 0 && (
        <div className="multi-select-counter">
          <div className="multi-select-badge">
            <span className="multi-select-check">✓</span>
            <span className="multi-select-count">{selectedComponents.length} Selected</span>
          </div>
          <div className="multi-select-actions">
            <button 
              className="multi-select-btn clear-btn"
              onClick={onClearMultiSelection}
              title="Clear selection (Escape)"
            >
              Clear
            </button>
            <button 
              className="multi-select-btn chart-btn"
              onClick={(e) => {
                // This will be implemented in Step 7-8 (context menu for multi-select)
                console.log('📊 Chart button clicked for multi-selection');
              }}
              title="Create multi-component chart"
            >
              📊 Chart...
            </button>
          </div>
        </div>
      )}

      {/* Chart Context Menu */}
      {contextMenu && contextMenu.type === 'single-component' && (
        <ChartContextMenu
          position={contextMenu.position}
          componentName={contextMenu.component.name}
          onClose={() => setContextMenu(null)}
          onSelectChartType={handleChartTypeSelected}
        />
      )}
      
      {/* Multi-Component Context Menu */}
      {contextMenu && contextMenu.type === 'multi-component' && (
        <MultiComponentContextMenu
          position={contextMenu.position}
          components={contextMenu.components}
          onClose={() => setContextMenu(null)}
          onSelectChartType={handleMultiComponentChartTypeSelected}
        />
      )}
      
      {/* Multi-Component Chart Configuration Dialog */}
      {showMultiChartDialog && (
        <MultiComponentChartDialog
          components={multiChartComponents}
          onClose={() => setShowMultiChartDialog(false)}
          onCreateChart={handleCreateMultiChart}
        />
      )}
      
      {/* Keyboard Shortcuts Help */}
      {mode === 'design' && <KeyboardShortcuts />}
    </div>
  );
});

export default Canvas;
