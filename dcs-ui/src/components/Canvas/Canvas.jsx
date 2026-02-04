import React, { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
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
  zoom,
  pan,
  onPan,
  mode,
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

            // Check if this connection is currently selected by the user
            const isSelected = selectedConnection?.id === conn.id;
            
            // ============================================================
            // POWER FLOW LOGIC - Is power flowing through this connection?
            // ============================================================
            // Power flows IF the upstream component (fromComp) is operational.
            // 
            // A component is operational when its status is 'normal':
            // - Turbine is online and generating
            // - Breaker is closed (not open or tripped)
            // - Transformer is operating
            // - etc.
            //
            // A component is NOT operational when status is:
            // - 'offline' (tripped turbine, failed equipment)
            // - 'tripped' (breaker fault)
            // - 'open' (manually opened breaker)
            //
            // In real power systems, this would be more complex (considering
            // multiple sources, parallel paths, etc.), but for our simulation
            // this simple rule works well.
            const isEnergized = fromComp.status === 'normal';
            
            // DEBUG: Log power flow status when hovering
            const handleConnectionHover = () => {
              console.log('⚡ Connection:', 
                fromComp.name, '→', toComp.name, 
                '| Energized:', isEnergized, 
                '| From status:', fromComp.status);
            };

            return (
              <g key={conn.id}>
                {/* ========================================================
                    THE CONNECTION LINE WITH POWER FLOW ANIMATION
                    ========================================================
                    This line gets CSS classes based on energization state:
                    - 'energized' class → animated flowing effect
                    - 'de-energized' class → static dashed line
                    
                    The CSS animation makes the dash pattern move, creating
                    a visual effect of electricity flowing from source to load!
                ======================================================== */}
                <line
                  x1={fromComp.position.x + 40}
                  y1={fromComp.position.y + 30}
                  x2={toComp.position.x + 40}
                  y2={toComp.position.y + 30}
                  stroke={
                    isEnergized 
                      ? '#4caf50'        // GREEN if power is flowing
                      : '#666'           // GREY if no power
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
                  x={(fromComp.position.x + toComp.position.x) / 2 + 40}
                  y={(fromComp.position.y + toComp.position.y) / 2 + 20}
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
          {connecting && connectingTo && (
            <line
              x1={components.find(c => c.id === connecting)?.position.x + 40}
              y1={components.find(c => c.id === connecting)?.position.y + 30}
              x2={connectingTo.x}
              y2={connectingTo.y}
              stroke="#00bcd4"
              strokeWidth="2"
              strokeDasharray="5,5"
              pointerEvents="none"
            />
          )}

          {/* Render components */}
          {components.map(component => {
            const isSelected = selectedComponent?.id === component.id;
            const isDragging = draggingComponent === component.id;

            return (
              <g
                key={component.id}
                transform={`translate(${component.position.x},${component.position.y})`}
                onMouseDown={(e) => handleComponentMouseDown(e, component)}
                onMouseUp={(e) => handleComponentMouseUp(e, component)}
                className={`canvas-component ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
                style={{ cursor: mode === 'design' ? 'move' : 'pointer' }}
              >
                {/* ========================================================
                    COMPONENT BOX (THE RECTANGLE)
                    ========================================================
                    This is the visual rectangle that represents the component
                    on the canvas. It's an SVG rect element.
                    
                    DYNAMIC STYLING BASED ON STATUS:
                    The stroke (border) color changes based on two things:
                    1. Is this component selected? → Cyan border
                    2. Is this component offline? → Red border
                    3. Otherwise → Grey border
                    
                    HOW THE COLOR LOGIC WORKS:
                    We use a "ternary operator" (? :) which is like a
                    mini if-else statement in JavaScript.
                    
                    Format: condition ? valueIfTrue : valueIfFalse
                    
                    We nest two ternary operators:
                    - First check: Is it selected?
                      - YES → cyan (#00bcd4)
                      - NO → Check second condition
                    - Second check: Is status 'offline'?
                      - YES → red (#d32f2f)
                      - NO → grey (#444)
                    
                    REACT CONCEPT - Dynamic Attributes:
                    stroke={...} means we're setting the stroke attribute
                    to a JavaScript value (not a static string). React
                    evaluates the expression and sets the result.
                    
                    BUG FIX: Made offline components have THICK bright red
                    borders so you can't miss them. Offline overrides selected.
                ======================================================== */}
                <rect
                  width="80"
                  height="60"
                  fill="#1a1a1a"
                  stroke={
                    component.status === 'offline'
                      ? '#ff0000'              // BRIGHT RED if offline (priority!)
                      : component.status === 'tripped'
                        ? '#ff0000'            // BRIGHT RED if tripped (breaker fault)
                      : component.status === 'open'
                        ? '#ff9800'            // ORANGE if open (breaker manually opened)
                      : isSelected 
                        ? '#00bcd4'            // Cyan if selected
                        : '#444'               // Grey if normal
                  }
                  strokeWidth={
                    component.status === 'offline' || component.status === 'tripped'
                      ? 4                      // THICK border for failures
                      : component.status === 'open'
                        ? 3                    // MEDIUM border for open breaker
                      : isSelected ? 3 : 2     // Normal borders
                  }
                  // DEBUG: Log component status when rendering
                  onMouseEnter={() => console.log('🖱️ Component:', component.name, 'Status:', component.status, 'Stroke:', 
                    component.status === 'offline' || component.status === 'tripped' ? 'RED 4px' : 
                    component.status === 'open' ? 'ORANGE 3px' : 'normal')}
                  rx="4"
                />
                
                {/* Component name */}
                <text
                  x="40"
                  y="25"
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
                  x="40"
                  y="40"
                  textAnchor="middle"
                  fill="#999"
                  fontSize="9"
                  pointerEvents="none"
                >
                  {component.rating > 0 ? `${component.rating} ${component.unit}` : ''}
                </text>
                
                {/* Status indicator dot (top-right corner)
                    Shows during simulation:
                    - RED: offline, tripped, or open (no power flowing)
                    - GREEN: normal (power flowing)
                */}
                {simulationRunning && (
                  <circle
                    cx="70"
                    cy="10"
                    r="4"
                    fill={
                      component.status === 'offline' || 
                      component.status === 'tripped' || 
                      component.status === 'open' 
                        ? '#f44336'    // Red for any non-operational state
                        : '#4caf50'    // Green for normal
                    }
                  />
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
        {mode === 'design' && (
          <div className="canvas-hint">
            💡 Drag components from library | Shift+Click to connect | Alt+Drag to pan
          </div>
        )}
      </div>
    </div>
  );
});

export default Canvas;
