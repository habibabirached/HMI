import React, { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import ChartContextMenu from '../ChartContextMenu/ChartContextMenu';
import MultiComponentContextMenu from '../MultiComponentContextMenu/MultiComponentContextMenu';
import MultiComponentChartDialog from '../MultiComponentChartDialog/MultiComponentChartDialog';
import KeyboardShortcuts from './KeyboardShortcuts';
import CanvasBlock from './CanvasBlock';
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
  onUpdateComponent,
  onAssociateChart,
  onOpenChart,
  onCreateMultiComponentChart,
  canAddCharts,
  simulationColumns = [],
  simulationCsvName = '',
  zoom,
  pan,
  onPan,
  mode,
  viewMode,
  simulationRunning,
  simulationData = [],
  simulationTime = 0,
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
  const [multiChartType, setMultiChartType] = useState('multi-bar-chart'); // 'multi-bar-chart' | 'multi-line-chart'
  const [resizingComponent, setResizingComponent] = useState(null); // { id, handle: 'top'|'bottom'|'left'|'right' }
  const resizeStateRef = useRef(null); // holds latest components, pan, zoom for document-level resize

  resizeStateRef.current = { components, pan, zoom, onUpdateComponent, resizingComponent, canvasRef };

  // ========================================================================
  // HELPER: snapCenterToGrid – snap component CENTER to grid, return top-left
  // ========================================================================
  // Snaps the center of gravity to the 50x50 grid, not the corner.
  // ========================================================================
  const gridSize = 50;
  const snapCenterToGrid = (topLeftX, topLeftY, width, height) => {
    const centerX = topLeftX + width / 2;
    const centerY = topLeftY + height / 2;
    const snappedCenterX = Math.round(centerX / gridSize) * gridSize;
    const snappedCenterY = Math.round(centerY / gridSize) * gridSize;
    return {
      x: snappedCenterX - width / 2,
      y: snappedCenterY - height / 2
    };
  };

  // Handle drop of new component from library
  const handleDrop = (e) => {
    e.preventDefault();
    const componentData = e.dataTransfer.getData('component');
    if (!componentData) return;

    const component = JSON.parse(componentData);
    const rect = canvasRef.current.getBoundingClientRect();
    
    const rawX = (e.clientX - rect.left - pan.x) / zoom;
    const rawY = (e.clientY - rect.top - pan.y) / zoom;
    
    const { width, height } = getComponentDimensions(component.id);
    const snapped = snapCenterToGrid(rawX, rawY, width, height);

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
   * Handle chart type selection from multi-component context menu.
   * STEP 1: Gate – if not in a simulation, show instructive message and return.
   */
  const handleMultiComponentChartTypeSelected = (chartType) => {
    if (!canAddCharts) {
      alert('Run a simulation first to add or modify charts.\n\nClick a scenario button in the Simulation Controls panel.');
      setContextMenu(null);
      return;
    }
    if (contextMenu && contextMenu.components) {
      console.log('📊 Multi-component chart selected:', chartType, 'for', contextMenu.components.length, 'components');
      console.log('Selected components:', contextMenu.components.map(c => c.name).join(', '));
      
      if (chartType === 'animated-bar-chart') {
        setMultiChartType('multi-bar-chart');
        setMultiChartComponents(contextMenu.components);
        setShowMultiChartDialog(true);
      } else if (chartType === 'multi-line-plot') {
        setMultiChartType('multi-line-chart');
        setMultiChartComponents(contextMenu.components);
        setShowMultiChartDialog(true);
      } else {
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

    if (resizingComponent && onUpdateComponent) {
      const rect = canvasRef.current.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left - pan.x) / zoom;
      const canvasY = (e.clientY - rect.top - pan.y) / zoom;
      const comp = components.find(c => c.id === resizingComponent.id);
      if (!comp) return;
      const baseConfig = getComponentVisualConfig(comp.type);
      const currentWidth = comp.visualOverrides?.width ?? baseConfig.width;
      const currentHeight = comp.visualOverrides?.height ?? baseConfig.height;
      const vo = comp.visualOverrides || {};
      if (resizingComponent.handle === 'bottom') {
        const newHeight = Math.max(60, Math.min(800, canvasY - comp.position.y));
        if (Math.abs(newHeight - currentHeight) > 1) {
          onUpdateComponent(comp.id, { visualOverrides: { ...vo, height: Math.round(newHeight) } });
        }
      } else if (resizingComponent.handle === 'top') {
        const compBottom = comp.position.y + currentHeight;
        const newHeight = Math.max(60, Math.min(800, compBottom - canvasY));
        const newY = compBottom - newHeight;
        if (Math.abs(newHeight - currentHeight) > 1) {
          onUpdateComponent(comp.id, {
            position: { ...comp.position, y: newY },
            visualOverrides: { ...vo, height: Math.round(newHeight) }
          });
        }
      } else if (resizingComponent.handle === 'right') {
        const newWidth = Math.max(80, Math.min(600, canvasX - comp.position.x));
        if (Math.abs(newWidth - currentWidth) > 1) {
          onUpdateComponent(comp.id, { visualOverrides: { ...vo, width: Math.round(newWidth) } });
        }
      } else if (resizingComponent.handle === 'left') {
        const compRight = comp.position.x + currentWidth;
        const newWidth = Math.max(80, Math.min(600, compRight - canvasX));
        const newX = compRight - newWidth;
        if (Math.abs(newWidth - currentWidth) > 1) {
          onUpdateComponent(comp.id, {
            position: { ...comp.position, x: newX },
            visualOverrides: { ...vo, width: Math.round(newWidth) }
          });
        }
      }
      return;
    }
    
    if (draggingComponent) {
      const rect = canvasRef.current.getBoundingClientRect();
      const rawX = (e.clientX - rect.left - pan.x) / zoom - dragOffset.x;
      const rawY = (e.clientY - rect.top - pan.y) / zoom - dragOffset.y;

      const comp = components.find(c => c.id === draggingComponent);
      const { width, height } = comp ? getComponentDimensions(comp.type) : { width: 100, height: 60 };
      const snapped = snapCenterToGrid(rawX, rawY, width, height);

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
    if (resizingComponent) {
      setResizingComponent(null);
    }
    if (panning) {
      setPanning(false);
    }
  };

  // Document-level resize: keep resize working when mouse leaves canvas
  useEffect(() => {
    if (!resizingComponent || !onUpdateComponent) return;
    const onDocMove = (e) => {
      const s = resizeStateRef.current;
      if (!s?.resizingComponent || !s.canvasRef?.current) return;
      const rect = s.canvasRef.current.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left - s.pan.x) / s.zoom;
      const canvasY = (e.clientY - rect.top - s.pan.y) / s.zoom;
      const comp = s.components.find(c => c.id === s.resizingComponent.id);
      if (!comp) return;
      const baseConfig = getComponentVisualConfig(comp.type);
      const currentWidth = comp.visualOverrides?.width ?? baseConfig.width;
      const currentHeight = comp.visualOverrides?.height ?? baseConfig.height;
      const vo = comp.visualOverrides || {};
      const handle = s.resizingComponent.handle;
      if (handle === 'bottom') {
        const newHeight = Math.max(60, Math.min(800, canvasY - comp.position.y));
        if (Math.abs(newHeight - currentHeight) > 1) {
          s.onUpdateComponent(comp.id, { visualOverrides: { ...vo, height: Math.round(newHeight) } });
        }
      } else if (handle === 'top') {
        const compBottom = comp.position.y + currentHeight;
        const newHeight = Math.max(60, Math.min(800, compBottom - canvasY));
        const newY = compBottom - newHeight;
        if (Math.abs(newHeight - currentHeight) > 1) {
          s.onUpdateComponent(comp.id, {
            position: { ...comp.position, y: newY },
            visualOverrides: { ...vo, height: Math.round(newHeight) }
          });
        }
      } else if (handle === 'right') {
        const newWidth = Math.max(80, Math.min(600, canvasX - comp.position.x));
        if (Math.abs(newWidth - currentWidth) > 1) {
          s.onUpdateComponent(comp.id, { visualOverrides: { ...vo, width: Math.round(newWidth) } });
        }
      } else if (handle === 'left') {
        const compRight = comp.position.x + currentWidth;
        const newWidth = Math.max(80, Math.min(600, compRight - canvasX));
        const newX = compRight - newWidth;
        if (Math.abs(newWidth - currentWidth) > 1) {
          s.onUpdateComponent(comp.id, {
            position: { ...comp.position, x: newX },
            visualOverrides: { ...vo, width: Math.round(newWidth) }
          });
        }
      }
    };
    const onDocUp = () => setResizingComponent(null);
    document.addEventListener('mousemove', onDocMove);
    document.addEventListener('mouseup', onDocUp);
    return () => {
      document.removeEventListener('mousemove', onDocMove);
      document.removeEventListener('mouseup', onDocUp);
    };
  }, [resizingComponent, onUpdateComponent]);

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
            
            let fromCenterX = fromComp.position.x + (fromWidth / 2);
            let fromCenterY = fromComp.position.y + (fromHeight / 2);
            let toCenterX = toComp.position.x + (toWidth / 2);
            let toCenterY = toComp.position.y + (toHeight / 2);

            // Vertical bus: use edge connection so lines are horizontal at the bus
            const VERTICAL_BUS_TYPES = ['bus-hv-vertical'];
            const fromIsVerticalBus = VERTICAL_BUS_TYPES.includes(fromComp.type);
            const toIsVerticalBus = VERTICAL_BUS_TYPES.includes(toComp.type);
            if (fromIsVerticalBus) {
              const busLeft = fromComp.position.x;
              const busRight = fromComp.position.x + fromWidth;
              const busEdgeX = toCenterX < fromCenterX ? busLeft : busRight;
              fromCenterX = busEdgeX;
              fromCenterY = toCenterY;
            }
            if (toIsVerticalBus) {
              const busLeft = toComp.position.x;
              const busRight = toComp.position.x + toWidth;
              const busEdgeX = fromCenterX < toCenterX ? busRight : busLeft;
              toCenterX = busEdgeX;
              toCenterY = fromCenterY;
            }

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
          {components.map((component) => (
            <CanvasBlock
              key={component.id}
              component={component}
              isSelected={selectedComponent?.id === component.id}
              isMultiSelected={isComponentMultiSelected(component.id)}
              isDragging={draggingComponent === component.id}
              mode={mode}
              simulationRunning={simulationRunning}
              simulationData={simulationData}
              simulationTime={simulationTime}
              onMouseDown={handleComponentMouseDown}
              onMouseUp={handleComponentMouseUp}
              onContextMenu={handleComponentContextMenu}
              onOpenChart={onOpenChart}
              onUpdateComponent={onUpdateComponent}
              onResizeStart={setResizingComponent}
            />
          ))}
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
          chartType={multiChartType}
          components={multiChartComponents}
          onClose={() => setShowMultiChartDialog(false)}
          onCreateChart={handleCreateMultiChart}
          simulationColumns={simulationColumns}
          simulationCsvName={simulationCsvName}
        />
      )}
      
      {/* Keyboard Shortcuts Help */}
      {mode === 'design' && <KeyboardShortcuts />}
    </div>
  );
});

export default Canvas;
