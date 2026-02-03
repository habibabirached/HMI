import React, { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import '../styles/Canvas.css';

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

  // Handle drop of new component from library
  const handleDrop = (e) => {
    e.preventDefault();
    const componentData = e.dataTransfer.getData('component');
    if (!componentData) return;

    const component = JSON.parse(componentData);
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    onAddComponent(component, { x, y });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  // Component dragging
  const handleComponentMouseDown = (e, component) => {
    if (mode === 'simulation') return;
    
    e.stopPropagation();
    
    if (e.shiftKey) {
      // Shift + click starts connection
      setConnecting(component.id);
      return;
    }

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
      const x = (e.clientX - rect.left - pan.x) / zoom - dragOffset.x;
      const y = (e.clientY - rect.top - pan.y) / zoom - dragOffset.y;
      onMoveComponent(draggingComponent, { x, y });
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

          {/* Render connections */}
          {connections.map(conn => {
            const fromComp = components.find(c => c.id === conn.from);
            const toComp = components.find(c => c.id === conn.to);
            if (!fromComp || !toComp) return null;

            const isSelected = selectedConnection?.id === conn.id;
            const isEnergized = simulationRunning && systemState[fromComp.id]?.status === 'energized';

            return (
              <g key={conn.id}>
                <line
                  x1={fromComp.position.x + 40}
                  y1={fromComp.position.y + 30}
                  x2={toComp.position.x + 40}
                  y2={toComp.position.y + 30}
                  stroke={isEnergized ? '#4caf50' : '#666'}
                  strokeWidth={isSelected ? 4 : 2}
                  strokeDasharray={isEnergized ? '0' : '5,5'}
                  className="connection-line"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectConnection(conn);
                  }}
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
                ======================================================== */}
                <rect
                  width="80"
                  height="60"
                  fill="#1a1a1a"
                  stroke={
                    isSelected 
                      ? '#00bcd4'              // Cyan if selected
                      : component.status === 'offline'
                        ? '#d32f2f'            // Red if offline
                        : '#444'               // Grey if normal
                  }
                  strokeWidth={isSelected ? 3 : 2}
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
                
                {/* Status indicator */}
                {simulationRunning && (
                  <circle
                    cx="70"
                    cy="10"
                    r="4"
                    fill={component.status === 'offline' ? '#f44336' : '#4caf50'}
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
