# Data Center Power System HMI - Architecture & Structure

This document explains how the application is organized, how components communicate, and how data flows through the system.

---

## Component Hierarchy Tree

```
App.js (ROOT - Main orchestrator)
│
├── Toolbar
│   └── Controls: Mode toggle, Simulation start/stop, Zoom controls
│
├── ComponentLibrary
│   └── Left sidebar: Drag-and-drop component arsenal
│
├── Canvas
│   └── Center area: Visual workspace where components are placed and connected
│
├── PropertyPanel
│   └── Right sidebar (top): Edit selected component/connection properties
│
└── SimulationControls
    └── Right sidebar (bottom): Trigger failures and control simulation
```

---

## Component Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                            App.js                               │
│                                                                 │
│  STATE (Data stored here):                                      │
│  • mode: 'design' | 'simulation'                                │
│  • canvasComponents: [array of components on canvas]            │
│  • connections: [array of wires between components]             │
│  • selectedComponent: currently selected component              │
│  • zoom, pan: canvas viewport position                          │
│  • simulationRunning: boolean                                   │
│                                                                 │
│  FUNCTIONS (Actions):                                           │
│  • handleAddComponent()                                         │
│  • handleMoveComponent()                                        │
│  • handleUpdateComponent()                                      │
│  • handleDeleteComponent()                                      │
│  • handleAddConnection()                                        │
│  • handleTripComponent() ← NEW in Step 3!                       │
│  • handleToggleMode()                                           │
│  • handleStartSimulation()                                      │
│                                                                 │
└────┬────────────┬─────────────┬────────────────┬───────────────┘
     │            │             │                │
     ▼            ▼             ▼                ▼
┌─────────┐  ┌─────────┐  ┌──────────┐  ┌──────────────────┐
│ Toolbar │  │Component│  │ Canvas   │  │ PropertyPanel    │
│         │  │ Library │  │          │  │                  │
└─────────┘  └─────────┘  └──────────┘  └──────────────────┘
                                         ┌──────────────────┐
                                         │Simulation        │
                                         │Controls          │
                                         └──────────────────┘
```

---

## Data Flow: How Props Travel Down

### 1. **Toolbar Component**

**Purpose:** Top control bar with mode switching and zoom controls

**Props Received FROM App.js:**
```javascript
<Toolbar
  mode={mode}                           // Current mode: 'design' or 'simulation'
  onToggleMode={handleToggleMode}       // Function to switch modes
  simulationRunning={simulationRunning} // Is simulation active?
  onStartSimulation={handleStartSimulation}  // Start simulation
  onStopSimulation={handleStopSimulation}    // Stop simulation
  zoom={zoom}                           // Current zoom level (0.5 - 2.0)
  onZoomIn={function}                   // Increase zoom
  onZoomOut={function}                  // Decrease zoom
  onResetView={function}                // Reset zoom and pan
/>
```

**What it does:**
- Shows current mode badge
- Provides buttons to switch modes
- Controls simulation start/stop
- Adjusts canvas zoom level

---

### 2. **ComponentLibrary Component**

**Purpose:** Left sidebar with draggable power system components

**Props Received FROM App.js:**
```javascript
<ComponentLibrary
  onAddComponent={handleAddComponent}   // Callback when component dropped on canvas
  disabled={mode === 'simulation'}      // Lock library in simulation mode
/>
```

**What it does:**
- Displays 90+ components in 12 categories
- Allows drag-and-drop to canvas
- Locks when in simulation mode (can't add components during simulation)

---

### 3. **Canvas Component**

**Purpose:** Main visual workspace where you build power systems

**Props Received FROM App.js:**
```javascript
<Canvas
  ref={canvasRef}                       // Reference for direct DOM access
  components={canvasComponents}         // Array of all components on canvas
  connections={connections}             // Array of all connections (wires)
  selectedComponent={selectedComponent} // Currently selected component
  selectedConnection={selectedConnection} // Currently selected connection
  onSelectComponent={setSelectedComponent}     // Select a component
  onSelectConnection={setSelectedConnection}   // Select a connection
  onMoveComponent={handleMoveComponent}        // Move a component
  onAddComponent={handleAddComponent}          // Add new component
  onAddConnection={handleAddConnection}        // Add connection between components
  zoom={zoom}                           // Zoom level
  pan={pan}                             // Pan position {x, y}
  onPan={setPan}                        // Update pan position
  mode={mode}                           // Current mode
  simulationRunning={simulationRunning} // Simulation status
  systemState={systemState}             // Simulation state data
/>
```

**What it does:**
- Renders all components as SVG rectangles
- Draws connections as lines
- Handles dragging components to move them
- Handles dropping new components from library
- Supports pan (Alt+Drag) and zoom
- Changes component colors based on status:
  - **Cyan border** → Selected
  - **Red border** → Offline/Failed
  - **Grey border** → Normal

---

### 4. **PropertyPanel Component**

**Purpose:** Right sidebar (top) for editing component properties

**Props Received FROM App.js:**
```javascript
<PropertyPanel
  selectedComponent={selectedComponent}         // Component to edit
  selectedConnection={selectedConnection}       // Connection to edit
  onUpdateComponent={handleUpdateComponent}     // Save changes to component
  onDeleteComponent={handleDeleteComponent}     // Delete component
  onDeleteConnection={handleDeleteConnection}   // Delete connection
  onClose={function}                            // Close panel / deselect
  disabled={mode === 'simulation'}              // Lock editing in simulation mode
/>
```

**What it does:**
- Shows properties of selected component (rating, voltage, status)
- Allows editing in Design Mode
- Locks in Simulation Mode
- Provides delete button

---

### 5. **SimulationControls Component** ⭐ NEW!

**Purpose:** Right sidebar (bottom) for triggering failures and events

**Props Received FROM App.js:**
```javascript
<SimulationControls
  mode={mode}                           // Current mode
  selectedComponent={selectedComponent} // Which component is selected
  onTripComponent={handleTripComponent} // Function to trip/fail a component
/>
```

**What it does:**
- Only appears in **Simulation Mode**
- Shows different buttons based on component type:
  - **Turbines:** "Trip Turbine" / "Restart Turbine"
  - **Breakers:** "Open Breaker" / "Close Breaker" / "Trip Breaker"
  - **Batteries:** "Battery Failure" / "Enable Battery"
  - **Other:** "Take Offline" / "Bring Online"
- Calls `onTripComponent` when you click "Trip" or "Take Offline"

---

## Data Flow: User Clicks "Trip Turbine" Button

Let's trace what happens when you click the "Trip Turbine" button:

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: User clicks "Trip Turbine" button                      │
│  Location: SimulationControls.jsx                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: onClick handler fires                                  │
│  Code: onClick={() => onTripComponent(selectedComponent.id)}    │
│  This calls the function that was passed as a prop              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: onTripComponent is actually handleTripComponent        │
│  Location: App.js (line 156)                                    │
│  This function was passed down as a prop from parent            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: handleTripComponent updates state                      │
│  Code: setCanvasComponents(prev => ...)                         │
│  Finds the component by ID and changes:                         │
│    • status: 'normal' → 'offline'                               │
│    • state.power: [current] → 0                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: React detects state change                             │
│  React knows canvasComponents array changed                     │
│  React automatically re-renders all components that use it      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 6: Canvas re-renders with new data                        │
│  Canvas receives updated components array                       │
│  Checks: component.status === 'offline' ?                       │
│  Sets stroke color to red (#d32f2f)                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 7: User sees red turbine on screen! ✅                    │
└─────────────────────────────────────────────────────────────────┘
```

**Key Concept:** This is called **"lifting state up"** in React. The state lives in the parent (App.js), and children can request changes by calling callback functions. The parent updates the state, and React automatically updates all children that depend on that state.

---

## State Management in App.js

The App component is the "single source of truth" for all application data:

### Design-Time State
```javascript
canvasComponents: [
  {
    id: 'gas-turbine-lm2500-1643...',
    type: 'gas-turbine-lm2500',
    name: 'LM2500',
    position: { x: 100, y: 200 },
    status: 'normal',  // 'normal' | 'offline' | 'tripped'
    rating: 25,
    voltage: 13.8,
    unit: 'MW',
    state: {
      power: 0,
      voltage: 13.8,
      current: 0,
      frequency: 60
    }
  },
  // ... more components
]

connections: [
  {
    id: 'conn-1643...',
    from: 'gas-turbine-lm2500-1643...',
    to: 'breaker-hv-1643...',
    voltage: 13.8,
    type: 'AC',
    status: 'normal'
  },
  // ... more connections
]
```

### UI State
```javascript
mode: 'design' | 'simulation'  // Current app mode
selectedComponent: {...}        // Which component is selected
selectedConnection: {...}       // Which connection is selected
zoom: 1.0                       // Zoom level (0.5 - 2.0)
pan: { x: 0, y: 0 }            // Canvas pan offset
```

### Simulation State
```javascript
simulationRunning: false       // Is simulation active?
systemState: {                 // Simulation-specific state
  'turbine-1': {
    power: 25,
    status: 'normal'
  },
  // ... per-component simulation state
}
```

---

## File Structure

```
dcs-ui/src/
│
├── App.js ⭐ MAIN ORCHESTRATOR
│   • Manages all state
│   • Renders all child components
│   • Passes state and callbacks down as props
│
├── index.js
│   • Entry point - renders App into HTML
│
├── components/
│   ├── Toolbar.jsx
│   │   • Top control bar
│   │
│   ├── ComponentLibrary.jsx
│   │   • Left sidebar with draggable components
│   │
│   ├── Canvas.jsx ⭐ COMPLEX
│   │   • Main visual workspace
│   │   • Handles drag/drop, pan/zoom, connections
│   │   • Renders components and connections as SVG
│   │
│   ├── PropertyPanel.jsx
│   │   • Right sidebar (top) for editing properties
│   │
│   └── SimulationControls.jsx ⭐ NEW IN STEP 3!
│       • Right sidebar (bottom) for triggering failures
│       • Shows different buttons per component type
│       • Calls onTripComponent callback
│
├── data/
│   └── componentLibrary.js
│       • Defines 90+ power system components
│       • Organized in 12 categories
│
└── styles/
    ├── App.css
    ├── Toolbar.css
    ├── ComponentLibrary.css
    ├── Canvas.css
    ├── PropertyPanel.css
    └── SimulationControls.css ⭐ NEW!
```

---

## Key React Concepts Used

### 1. **State Management with useState**
```javascript
const [mode, setMode] = useState('design');
```
- State is data that can change over time
- When state changes, React re-renders the component
- `setMode('simulation')` triggers a re-render

### 2. **Props (Properties)**
- Data passed from parent to child
- Read-only (child cannot modify props directly)
- Used to pass data down and callbacks up

### 3. **Callbacks (Functions as Props)**
```javascript
<SimulationControls onTripComponent={handleTripComponent} />
```
- Parent passes a function to child
- Child calls that function when something happens
- This allows child to communicate back to parent

### 4. **useCallback Hook**
```javascript
const handleTripComponent = useCallback((id) => {...}, []);
```
- Prevents function from being recreated on every render
- Improves performance

### 5. **Immutability**
```javascript
setCanvasComponents(prev => prev.map(comp => 
  comp.id === id ? { ...comp, status: 'offline' } : comp
));
```
- Never modify state directly
- Create a new array/object with changes
- This is how React knows something changed

### 6. **Conditional Rendering**
```javascript
{mode === 'simulation' && <SimulationControls />}
```
- Show/hide components based on conditions
- SimulationControls only appears in simulation mode

---

## Current Implementation Status

### ✅ Completed (Steps 1-3)
- [x] Step 1: Simulation Controls panel container created
- [x] Step 2: Component-specific buttons displayed based on selection
- [x] Step 3: "Trip Turbine" and "Take Offline" buttons functional
  - Clicking the button changes component status to 'offline'
  - Component turns red on canvas
  - Console logs show the data flow

### 🚧 In Progress (Steps 4-8)
- [ ] Step 4: Make "Restart Turbine" / "Bring Online" work
- [ ] Step 5: Make breaker controls work (Open/Close/Trip)
- [ ] Step 6: Update power flow lines (grey when upstream is offline)
- [ ] Step 7: Add "Quick Scenarios" (Trip Random Turbine, etc.)
- [ ] Step 8: Add "Reset System" button

---

## Debug Console Logs

When you click "Trip Turbine" or "Take Offline", you'll see these logs:

```
🔴 Trip Turbine clicked for: LM2500 gas-turbine-lm2500-1643...
🔴 handleTripComponent called with ID: gas-turbine-lm2500-1643...
📋 Current components: [Array(5)]
✅ Found component to trip: LM2500 gas-turbine-lm2500-1643...
📋 Updated components: [Array(5)]
```

When you hover over a component:
```
🖱️ Component: LM2500 Status: offline
```

These logs help debug the data flow and verify the status is changing correctly.

---

## Next Steps

After completing the 8 simulation control steps, the system will be able to:
1. Trip components (turbines, breakers, batteries)
2. Restart components
3. Visualize power flow changes
4. Run quick failure scenarios
5. Reset the system to initial state

This creates a fully interactive "what-if" exploration tool for power system design!

---

**Last Updated:** Step 3 Complete (Trip functionality working)
