import React, { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import ChartContextMenu from '../ChartContextMenu/ChartContextMenu';
import { getComponentVisualConfig, getComponentDimensions } from '../../data/componentVisuals';
import './Canvas.css';

const Canvas = forwardRef(({
  components,
  connections,
  selectedComponent,
  selectedConnection,
  onSelectComponent,
  onSelectConnection,
  onMoveComponent,
  onAddComponent,
  onAddConnection,
  onAssociateChart,
  onOpenChart,
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
    
    // IN SIMULATION MODE: Only allow selection, nothing else
    if (mode === 'simulation') {
      console.log('🖱️ Clicked in simulation mode:', component.name);
      onSelectComponent(component);  // Allow selecting
      return;  // But block dragging and connecting
    }
    
    // IN DESIGN MODE: Allow everything (drag, connect, select)
    
    if (e.shiftKey) {
      // Shift + click starts connection
      setConnecting(component.id);
      return;
    }

    // Start dragging the component
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
    
    console.log('🖱️ Right-click on component:', component.name);
    
    setContextMenu({
      component,
      position: {
        x: e.clientX,
        y: e.clientY
      }
    });
  };

  /**
   * Handle chart type selection from context menu
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

  const handleCanvasMouseDown = (e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle mouse or Alt+Left mouse for panning
      setPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    } else if (e.button === 0 && !draggingComponent) {
      // Left click on empty canvas deselects
      onSelectComponent(null);
      onSelectConnection(null);
    }
  };

  const handleCanvasMouseMove = (e) => {
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
            const fromVisual = getComponentVisualConfig(fromComp.type);
            const toVisual = getComponentVisualConfig(toComp.type);
            
            const fromCenterX = fromComp.position.x + (fromVisual.width / 2);
            const fromCenterY = fromComp.position.y + (fromVisual.height / 2);
            const toCenterX = toComp.position.x + (toVisual.width / 2);
            const toCenterY = toComp.position.y + (toVisual.height / 2);

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
            const fromCenterX = fromComp.position.x + (fromVisual.width / 2);
            const fromCenterY = fromComp.position.y + (fromVisual.height / 2);
            
            return (
              <line
                x1={fromCenterX}
                y1={fromCenterY}
                x2={connectingTo.x}
                y2={connectingTo.y}
                stroke="#00bcd4"
                strokeWidth="2"
                strokeDasharray="5,5"
                pointerEvents="none"
              />
            );
          })()}

          {/* Render components */}
          {components.map(component => {
            const isSelected = selectedComponent?.id === component.id;
            const isDragging = draggingComponent === component.id;
            
            // Get visual configuration for this component type
            const visualConfig = getComponentVisualConfig(component.type);
            const { width, height } = visualConfig;
            const centerX = width / 2;
            const centerY = height / 2;

            return (
              <g
                key={component.id}
                transform={`translate(${component.position.x},${component.position.y})`}
                onMouseDown={(e) => handleComponentMouseDown(e, component)}
                onMouseUp={(e) => handleComponentMouseUp(e, component)}
                onContextMenu={(e) => handleComponentContextMenu(e, component)}
                className={`canvas-component ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
                style={{ cursor: mode === 'design' ? 'move' : 'pointer' }}
              >
                {/* ========================================================
                    COMPONENT BOX - Dynamic size based on type
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
                        ? '#00bcd4'
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
            💡 Drag components from library | Shift+Click to connect | Alt+Drag to pan
          </div>
        )}
      </div>

      {/* Chart Context Menu */}
      {contextMenu && (
        <ChartContextMenu
          position={contextMenu.position}
          componentName={contextMenu.component.name}
          onClose={() => setContextMenu(null)}
          onSelectChartType={handleChartTypeSelected}
        />
      )}
    </div>
  );
});

export default Canvas;
